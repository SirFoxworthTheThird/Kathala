/**
 * Which of five things is true about a map layer's picture.
 *
 * The Maps screen already told two of these apart — a layer with no `imageId`
 * at all, and one naming a blob that is not in the store (a library world
 * downloaded without its `.pwb`). A reader run found a third that neither
 * covers: *The Woman in White*'s layers name blobs that **are** present, whose
 * records hold a `url` pointing at `upload.wikimedia.org`. Every image in the
 * Library is stored that way. On a train the record resolves, the screen draws
 * its whole frame — sidebar, markers, zoom controls, scale bar — and the canvas
 * behind them is blank, with nothing said. Three explanations are then
 * available to the reader and two of them are the app's fault.
 *
 * The decision is here rather than inline because getting `loading` and
 * `unreachable` the wrong way round flashes "could not be loaded" on every map
 * before it draws, and that is invisible in a screenshot.
 */
export type MapImageState =
  /** The layer has no picture and never had one. */
  | 'no-image'
  /** It names a picture whose record is not in this database. */
  | 'not-downloaded'
  /** The record is here and points at the web, which did not answer. */
  | 'unreachable'
  /** Nothing has failed yet and there is nothing to draw yet. */
  | 'loading'
  /** Draw the map. */
  | 'ready'

/** How far a browser has got with fetching a picture. */
export type ImageLoad = 'loading' | 'ok' | 'failed'

export function mapImageState(input: {
  /** Whether the layer names a picture at all. */
  hasImageId: boolean
  /** The blob record was asked for and is genuinely absent. */
  missing: boolean
  /** The resolved address, once the record has been read. */
  url: string | undefined
  /** Only meaningful once there is a `url` to have tried. */
  load: ImageLoad
}): MapImageState {
  if (!input.hasImageId) return 'no-image'
  if (input.missing) return 'not-downloaded'
  // No address yet means the record has not been read, not that it is absent —
  // `missing` above is the only thing that says absent.
  if (!input.url) return 'loading'
  if (input.load === 'failed') return 'unreachable'
  if (input.load === 'loading') return 'loading'
  return 'ready'
}

/**
 * The address to probe, or `null` for one that cannot be a dead link.
 *
 * Only `http(s)` is probed, and that is not an optimisation. A blob holding
 * uploaded bytes is resolved with `URL.createObjectURL`, which mints a **new**
 * string on every call, so anything keyed on the url of an uploaded image
 * re-runs on every render and never settles. `useImageLoad` did exactly that
 * in its first form and left every map on its spinner — 77 e2e failures, every
 * one a canvas that never drew.
 *
 * Local bytes also cannot fail the way a link can: if they are not there, the
 * record is absent, and `mapImageState` answers `not-downloaded` first.
 */
export function probeableAddress(url: string | undefined): string | null {
  if (!url) return null
  return /^https?:/i.test(url) ? url : null
}
