import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { BlobEntry } from '@/types'
import { generateId } from '@/lib/id'
import { hostOf } from '@/lib/localiseImages'

/** Returns a stable map of blobId → object URL for all blobs in a world.
 *  The Map reference only changes when the underlying Dexie data changes. */
export function useWorldBlobUrls(worldId: string | null): Map<string, string> {
  const entries = useLiveQuery(
    () => (worldId ? db.blobs.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      const url = blobEntryUrl(e)
      if (url) map.set(e.id, url)
    }
    return map
  }, [entries])
}

/**
 * A blob `url` that names a file this app ships, rather than one on the web.
 *
 * W23-7: four library books referenced their own artwork as
 * `https://raw.githubusercontent.com/…/development/public/library/<book>/…` —
 * **246 URLs** pointing at a branch of a public repository, for 146 MB of files
 * that are already in `dist/` and already served by the app at that very path.
 * A commit fixing GitHub Pages did it, because a root-absolute `/library/…`
 * breaks under a Pages subpath. But `vite.config.ts` already sets
 * `base: './'`, so the fix was to resolve against the base rather than to leave
 * the site and come back.
 *
 * Offline, every one of them failed, and the map said so — *"This map's picture
 * could not be loaded — it is kept on the web rather than in the book"*. That
 * banner is right about what it was told and wrong about the book: the picture
 * **is** in the book, in the folder beside the `.pwk` the app had just read.
 *
 * A stored url is a bundled asset when it has no scheme and no leading slash.
 * Third-party links (DEC-1) are absolute and untouched by this.
 */
function isBundledAsset(url: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('/')
}

/**
 * Where a bundled asset is actually served from.
 *
 * On the web this is the document's own base, and a stored `library/…` path
 * resolves against the site that served the page — same origin, exactly as
 * W23-7 intended.
 *
 * The desktop build sets `VITE_ASSET_BASE_URL` instead, because a packaged app
 * loads over `file://` and "resolve against the document" then means "a file
 * inside the installer". Shipping the artwork to satisfy that put **1,045 MB**
 * of pictures into every download — and silently broke the Windows installer,
 * whose 32-bit packager cannot embed a payload that size (v1.1.0 shipped a
 * `Setup.exe` containing nothing at all). Pointing the desktop build at a CDN
 * copy of the same files removes the weight rather than compressing it.
 *
 * The stored paths never change, so this is the only place that knows.
 */
function assetBaseUrl(): string {
  return import.meta.env.VITE_ASSET_BASE_URL || import.meta.env.BASE_URL
}

/**
 * Join an asset base to a stored path.
 *
 * The slash-collapsing leaves `https://` alone: `[^:]` cannot match the colon
 * before it, and the character before *that* colon is not followed by a slash.
 */
export function resolveBundledAsset(url: string, base: string): string {
  return `${base}${url}`.replace(/([^:]\/)\/+/g, '$1')
}

/** Resolve a blob entry to a usable image URL — a file this app ships, its
 *  external link, or an object URL for uploaded binary data. */
export function blobEntryUrl(entry: BlobEntry | undefined): string | undefined {
  if (!entry) return undefined
  if (entry.url) {
    return isBundledAsset(entry.url)
      ? resolveBundledAsset(entry.url, assetBaseUrl())
      : entry.url
  }
  if (entry.data) return URL.createObjectURL(entry.data)
  return undefined
}

export function useBlobUrl(id: string | null): string | undefined {
  const entry = useLiveQuery(() => (id ? db.blobs.get(id) : undefined), [id])
  return blobEntryUrl(entry)
}

/**
 * A blob url, and whether the record it was asked for is genuinely **absent**.
 *
 * `useBlobUrl` cannot tell those apart: `useLiveQuery` returns `undefined`
 * before its first result, and `db.blobs.get` returns `undefined` for an id
 * that is not there, so a caller sees the same value for *still loading* and
 * *never coming*. The Maps screen showed the consequence — a library world
 * downloaded without its image bundle has map layers whose `imageId` points at
 * blobs in the undownloaded `.pwb`, so the screen sat on a spinner forever
 * rather than saying anything at all.
 *
 * Resolving to `null` rather than `undefined` for a miss is what separates the
 * two: `undefined` is the query not having answered yet.
 */
export function useBlobUrlState(id: string | null): { url: string | undefined; missing: boolean } {
  const entry = useLiveQuery(async () => (id ? (await db.blobs.get(id)) ?? null : null), [id])
  return blobLookupState(id, entry)
}

/**
 * The decision `useBlobUrlState` makes, on its own so it can be tested.
 *
 * Three states off two values, and getting them backwards is invisible in a
 * screenshot: `undefined` is *the query has not answered*, `null` is *asked and
 * absent*, an entry is *here*. Treating loading as missing would flash "this
 * image isn't here" on every map before it drew — which is what a mutation of
 * the inline version did without failing a single browser test.
 */
export function blobLookupState(
  id: string | null,
  entry: BlobEntry | null | undefined,
): { url: string | undefined; missing: boolean } {
  return { url: blobEntryUrl(entry ?? undefined), missing: !!id && entry === null }
}

async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.88,
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  // Skip compression for SVG and non-image files
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    const dims = await getImageDimensions(file)
    return { blob: file, ...dims, mimeType: file.type }
  }

  const bitmap = await createImageBitmap(file)
  const srcW = bitmap.width
  const srcH = bitmap.height
  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH))
  const width = Math.round(srcW * scale)
  const height = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve({ blob: blob ?? file, width, height, mimeType: 'image/jpeg' }),
      'image/jpeg',
      quality,
    )
  })
}

export async function storeBlob(
  worldId: string,
  file: File,
): Promise<BlobEntry & { width: number; height: number }> {
  const { blob, width, height, mimeType } = await compressImage(file)
  const entry: BlobEntry = {
    id: generateId(),
    worldId,
    mimeType,
    data: blob,
    createdAt: Date.now(),
  }
  await db.blobs.add(entry)
  return { ...entry, width, height }
}

/** Store a linked (external-URL) image as a blob entry with no binary data.
 *  Loads the image first to validate it and read its natural dimensions. */
export async function storeImageLink(
  worldId: string,
  url: string,
): Promise<BlobEntry & { width: number; height: number }> {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) throw new Error('Enter a full image URL (http:// or https://).')
  const { width, height } = await getImageDimensionsFromUrl(trimmed)
  const entry: BlobEntry = {
    id: generateId(),
    worldId,
    mimeType: guessMimeType(trimmed),
    url: trimmed,
    createdAt: Date.now(),
  }
  await db.blobs.add(entry)
  return { ...entry, width, height }
}

function guessMimeType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'webp': return 'image/webp'
    case 'svg': return 'image/svg+xml'
    default: return 'image/*'
  }
}

/**
 * Take a copy of a linked picture, so it no longer needs the site it came from.
 *
 * `BlobEntry` holds *either* `data` or `url`, and everything that shows a
 * picture reads it through the same id — so this is one field on one record and
 * nothing that references the blob changes. The `url` is cleared rather than
 * kept: leaving both would make "exactly one of data / url is set" untrue, and
 * a later reader would have to guess which one the app meant.
 *
 * It throws rather than returning false on failure, and the callers turn that
 * into a count. A linked picture is drawn by the browser as an `<img>`, which
 * needs no permission; reading its *bytes* needs `fetch`, which needs the site
 * to send CORS headers. Many do not, and that is not a bug in this app or a
 * thing a retry fixes.
 */
export async function saveImageLocally(id: string): Promise<number> {
  const entry = await db.blobs.get(id)
  if (!entry) throw new Error('That picture is no longer here.')
  if (!entry.url) return 0 // already local; saving again would be a no-op

  const res = await fetch(entry.url, { mode: 'cors' })
  if (!res.ok) throw new Error(`The site answered ${res.status}.`)
  const data = await res.blob()
  if (data.size === 0) throw new Error('The site returned an empty file.')

  await db.blobs.update(id, {
    data,
    // `undefined` deletes the key in Dexie, which is what keeps the "exactly
    // one of these" invariant true rather than merely mostly true.
    url: undefined,
    mimeType: data.type || entry.mimeType,
  })
  return data.size
}

/** Every picture in a world that is still a link rather than bytes. */
export async function linkedBlobs(worldId: string): Promise<BlobEntry[]> {
  const all = await db.blobs.where('worldId').equals(worldId).toArray()
  return all.filter((b) => !!b.url && !b.data)
}

/**
 * Take a copy of every linked picture in a world, reporting what could not be
 * taken.
 *
 * Sequential rather than parallel, deliberately: this is somebody else's
 * bandwidth and a writer's browser, and forty simultaneous image fetches is the
 * kind of thing that gets an IP rate-limited. `onProgress` exists so the screen
 * can say where it has got to rather than freezing on a spinner.
 */
export async function saveWorldImagesLocally(
  worldId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: number; failed: Array<{ host: string; reason: string }>; bytes: number }> {
  const linked = await linkedBlobs(worldId)
  const failed: Array<{ host: string; reason: string }> = []
  let saved = 0
  let bytes = 0

  for (const [i, entry] of linked.entries()) {
    try {
      bytes += await saveImageLocally(entry.id)
      saved += 1
    } catch (err) {
      failed.push({
        host: hostOf(entry.url ?? ''),
        reason: err instanceof Error ? err.message : String(err),
      })
    }
    onProgress?.(i + 1, linked.length)
  }
  return { saved, failed, bytes }
}

export async function deleteBlob(id: string) {
  await db.blobs.delete(id)
}

export async function getBlobUrl(id: string): Promise<string | undefined> {
  const entry = await db.blobs.get(id)
  return blobEntryUrl(entry)
}

export function getImageDimensionsFromUrl(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Could not load that image URL. Make sure it links directly to an image.'))
    img.src = url
  })
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = reject
    img.src = url
  })
}
