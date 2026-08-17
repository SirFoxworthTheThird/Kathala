import { importWorld, importWorldImages } from '@/lib/exportImport'

/**
 * The library: worlds published alongside the app that anyone can pull
 * straight into their browser.
 *
 * There is no backend. The catalogue is a static `index.json` served from the
 * same origin as the app, and downloading a world is a `fetch` into the very
 * same import path a user gets by picking a file. That keeps the app
 * local-first — nothing is uploaded, nothing needs an account, and a world once
 * downloaded is an ordinary world the reader fully owns.
 */

export interface LibraryEntry {
  /** Stable slug for the catalogue entry. */
  id: string
  /**
   * The world id inside the `.pwk`. Import reuses it and replaces any world
   * already under it, so this is both how "already downloaded" is detected and
   * the reason a second download has to be confirmed.
   */
  worldId: string
  title: string
  /** The author of the underlying work, always shown. */
  author: string
  blurb: string
  /** Path to the `.pwk`, relative to the library folder. */
  data: string
  dataBytes: number
  /** Optional `.pwb` image bundle — usually far larger than the data. */
  images?: string
  imagesBytes?: number
  counts?: {
    characters?: number
    chapters?: number
    events?: number
    locations?: number
  }
  /**
   * Required. These are unofficial references to someone else's work, and the
   * reader is told so on the card rather than in a footnote nobody reads.
   */
  notice: string
  /**
   * Cover art for the card, as an absolute URL.
   *
   * Only entries whose cover is a *linked* image can have one. Where the cover
   * is binary it lives in the `.pwb` bundle, which is tens of megabytes and the
   * one thing the reader has not agreed to download yet — so those cards stay
   * text, rather than the catalogue quietly pulling the very payload its own
   * "with images" button exists to make optional.
   *
   * **This is the exception to "no backend, same origin" above.** A cover is an
   * absolute URL to somebody else's host, so opening the Library asks that host
   * for an image and discloses the reader's IP to it. No world data goes with
   * it, and `LibraryCover` renders nothing when the request fails — but this is
   * the one place the catalogue reaches off-origin, and it is currently 23 of
   * 25 entries across Wikimedia, Gutenberg and a few commercial sites.
   *
   * Recorded rather than removed (**WRUN-13**): the alternatives are to bundle
   * the freely-licensed covers locally or to drop them, and both are decisions
   * about the catalogue's contents rather than about this code. `docs/GUIDE.md`
   * tells the reader what the request discloses.
   */
  cover?: string
}

export interface LibraryIndex {
  version: number
  entries: LibraryEntry[]
}

/** Where the catalogue lives, honouring the app's base path on GitHub Pages. */
export function libraryBaseUrl(base: string): string {
  return `${base.replace(/\/$/, '')}/library/`
}

/** Reject anything that isn't the shape we expect, rather than half-rendering it. */
export function parseLibraryIndex(raw: unknown): LibraryIndex {
  if (typeof raw !== 'object' || raw === null) throw new Error('Library index is not an object')
  const obj = raw as Record<string, unknown>
  if (typeof obj.version !== 'number') throw new Error('Library index is missing a version')
  if (!Array.isArray(obj.entries)) throw new Error('Library index is missing its entries')

  const entries = obj.entries.map((value, i) => {
    const e = value as Record<string, unknown>
    for (const field of ['id', 'worldId', 'title', 'author', 'blurb', 'data', 'notice'] as const) {
      if (typeof e[field] !== 'string' || !e[field]) {
        throw new Error(`Library entry ${i} is missing ${field}`)
      }
    }
    if (typeof e.dataBytes !== 'number') throw new Error(`Library entry ${i} is missing dataBytes`)
    // A cover is optional, but a malformed one is dropped rather than rendered:
    // an <img> pointing at a relative path or a javascript: string is not
    // something to hand to the browser because a catalogue file said so.
    if (e.cover !== undefined && !(typeof e.cover === 'string' && /^https?:\/\//i.test(e.cover))) {
      delete e.cover
    }
    return e as unknown as LibraryEntry
  })

  return { version: obj.version, entries }
}

export type Fetcher = (url: string) => Promise<Response>

export async function fetchLibraryIndex(
  baseUrl: string,
  fetcher: Fetcher = fetch,
): Promise<LibraryIndex> {
  const res = await fetcher(`${baseUrl}index.json`)
  if (!res.ok) throw new Error(`Could not load the library (${res.status})`)
  return parseLibraryIndex(await res.json())
}

export type DownloadStage = 'world' | 'images'

export interface DownloadOptions {
  /** Image bundles dwarf the data, so pulling them is a separate decision. */
  withImages?: boolean
  onStage?: (stage: DownloadStage) => void
  fetcher?: Fetcher
}

/**
 * Download one library world into the local database, returning its world id.
 *
 * Images are fetched only after the world itself is in, and a failure there is
 * swallowed deliberately: a reader with a complete world and no portraits has
 * something useful, while an error thrown at that point would leave them
 * staring at a failure over a world that had in fact arrived.
 */
export async function downloadLibraryWorld(
  baseUrl: string,
  entry: LibraryEntry,
  options: DownloadOptions = {},
): Promise<{ worldId: string; imagesFailed: boolean }> {
  const fetcher = options.fetcher ?? fetch

  options.onStage?.('world')
  const dataRes = await fetcher(`${baseUrl}${entry.data}`)
  if (!dataRes.ok) throw new Error(`Could not download “${entry.title}” (${dataRes.status})`)
  const worldFile = new File([await dataRes.blob()], entry.data, { type: 'application/json' })
  const worldId = await importWorld(worldFile)

  if (!options.withImages || !entry.images) return { worldId, imagesFailed: false }

  options.onStage?.('images')
  try {
    const imgRes = await fetcher(`${baseUrl}${entry.images}`)
    if (!imgRes.ok) throw new Error(String(imgRes.status))
    const imgFile = new File([await imgRes.blob()], entry.images, { type: 'application/json' })
    await importWorldImages(imgFile)
    return { worldId, imagesFailed: false }
  } catch {
    return { worldId, imagesFailed: true }
  }
}

/** Human-readable download size, so nobody starts a 15 MB fetch unaware. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
