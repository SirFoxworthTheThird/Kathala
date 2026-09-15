/**
 * How the book is set, as the reader wants it.
 *
 * The reading screen had one fixed setting — 15px, `leading-relaxed`, the
 * theme's prose face — and nothing a reader could do about it. That is the one
 * control every tool people read in for hours offers, and its absence is felt
 * by exactly the readers who feel it most: anyone whose eyes want larger type,
 * anyone who reads on a laptop at arm's length, anyone who gets on better with
 * a sans face.
 *
 * A preference, not a property of the book: it belongs to the person, so it is
 * stored once and applies to every book they open.
 *
 * The defaults are today's appearance exactly. Nobody's book changes until they
 * ask it to.
 */

/** The sizes offered, in px. The first is what the screen has always used. */
export const TEXT_SIZES = [15, 17, 19, 22, 26] as const

/** Line spacing, named for what it does rather than for its number. */
export const LEADINGS = { snug: 1.45, relaxed: 1.625, airy: 1.9 } as const
export type Leading = keyof typeof LEADINGS

/**
 * Which face the prose is set in.
 *
 * `book` is the theme's own `--font-prose`, which several themes override — a
 * gothic world is not set in the same face as a cyberpunk one, and that is the
 * world author's decision. `sans` is the reader overruling it for legibility,
 * which is theirs.
 */
export type Face = 'book' | 'sans'

export interface ReadingType {
  size: number
  leading: Leading
  face: Face
}

/** Today's appearance, so the default changes nothing. */
export const DEFAULT_READING_TYPE: ReadingType = { size: 15, leading: 'relaxed', face: 'book' }

/**
 * Move up or down the size ladder, stopping at the ends.
 *
 * Works from the nearest offered size rather than from the stored number, so a
 * value that predates a change to `TEXT_SIZES` — or one a reader hand-edited in
 * storage — still steps somewhere sensible instead of sticking.
 */
export function stepSize(size: number, direction: 1 | -1): number {
  const nearest = TEXT_SIZES.reduce((best, s) =>
    Math.abs(s - size) < Math.abs(best - size) ? s : best, TEXT_SIZES[0])
  const i = TEXT_SIZES.indexOf(nearest)
  const next = i + direction
  if (next < 0 || next >= TEXT_SIZES.length) return nearest
  return TEXT_SIZES[next]
}

/** The CSS the prose column is set in. */
export function typeStyle(t: ReadingType): {
  fontSize: string
  lineHeight: number
  fontFamily: string
} {
  return {
    fontSize: `${t.size}px`,
    lineHeight: LEADINGS[t.leading] ?? LEADINGS.relaxed,
    fontFamily: t.face === 'sans'
      ? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
      : 'var(--font-prose)',
  }
}

/**
 * Make sense of whatever came out of storage.
 *
 * The value is persisted, so a build that changes the ladder or the leadings
 * will meet readers holding the old ones. Anything unrecognised falls back to
 * the default field by field rather than throwing the whole preference away,
 * because a reader who set the largest type and nothing else should keep it.
 */
export function coerceReadingType(raw: unknown): ReadingType {
  const v = (raw ?? {}) as Partial<ReadingType>
  const size = typeof v.size === 'number' && Number.isFinite(v.size)
    ? Math.min(TEXT_SIZES[TEXT_SIZES.length - 1], Math.max(TEXT_SIZES[0], v.size))
    : DEFAULT_READING_TYPE.size
  const leading = typeof v.leading === 'string' && v.leading in LEADINGS
    ? v.leading as Leading
    : DEFAULT_READING_TYPE.leading
  const face: Face = v.face === 'sans' || v.face === 'book' ? v.face : DEFAULT_READING_TYPE.face
  return { size, leading, face }
}
