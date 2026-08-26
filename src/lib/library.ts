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
   * Cover art for the card: an absolute URL, or a path to a file this app ships.
   *
   * Only entries whose cover is a *linked* image can have one. Where the cover
   * is binary it lives in the `.pwb` bundle, which is tens of megabytes, and
   * opening the catalogue is not asking for it — so those cards stay text
   * rather than pulling a bundle down to decorate a card the reader may scroll
   * straight past. (The bundle does come with the book once they press
   * Download; that is a different act, and the button says the size.)
   *
   * **An off-origin cover is the exception to "no backend, same origin" above.**
   * Such a cover is an absolute URL to somebody else's host, so opening the
   * Library asks that host
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
/**
 * Whether a catalogue cover is one we are willing to put in an `<img>`.
 *
 * Absolute http(s), or a file under `library/` that this app ships. A path is
 * checked for traversal explicitly rather than by resolving it, because the
 * value is data from a file and the answer should not depend on where the
 * document happens to be.
 */
function isAllowedCover(cover: string): boolean {
  if (/^https?:\/\//i.test(cover)) return true
  if (!cover.startsWith('library/')) return false
  return !cover.includes('..') && !cover.includes('\\') && !/^[a-z][a-z0-9+.-]*:/i.test(cover)
}

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
    /*
      A cover is optional, and a malformed one is dropped rather than rendered:
      a `javascript:` string, or a path that could climb out of the library, is
      not something to hand to the browser because a catalogue file said so.

      Two shapes are allowed. An **absolute http(s) URL** is somebody else's
      host, which is the disclosure described above. A path under **`library/`**
      is a file this app ships and serves itself — W23-7 moved the project's own
      artwork there from `raw.githubusercontent.com`, so admitting it is what
      lets a cover stop leaving the origin at all. Nothing else: no scheme, no
      leading slash, no `..`, no backslash.
    */
    if (e.cover !== undefined && !(typeof e.cover === 'string' && isAllowedCover(e.cover))) {
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

/**
 * What pressing **Download** on a catalogue card will actually fetch.
 *
 * Four of the thirty worlds ship a `.pwb` image bundle, and it dwarfs the data
 * — the Fellowship is 587 KB of story against 15 MB of pictures. That used to
 * be a second button the reader could decline; it now comes with the book, so
 * the number on the one button has to be the whole of it. A card still quoting
 * the `.pwk` alone would be the old promise with the old button removed.
 *
 * `imagesBytes` is optional in the index while `images` is the file that
 * decides, so a bundle whose size was never recorded adds nothing rather than
 * turning the label into `NaN`.
 */
export function downloadBytes(entry: LibraryEntry): number {
  return entry.dataBytes + (entry.images ? entry.imagesBytes ?? 0 : 0)
}

/** Human-readable download size, so nobody starts a 15 MB fetch unaware. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
