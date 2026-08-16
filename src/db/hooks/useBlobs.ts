import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { BlobEntry } from '@/types'
import { generateId } from '@/lib/id'

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

/** Resolve a blob entry to a usable image URL — its external link, or an object
 *  URL for uploaded binary data. */
export function blobEntryUrl(entry: BlobEntry | undefined): string | undefined {
  if (!entry) return undefined
  if (entry.url) return entry.url
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
