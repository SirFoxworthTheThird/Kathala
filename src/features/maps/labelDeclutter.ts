/**
 * Which location markers get to show their name at a given zoom.
 *
 * A marker's label is a pill roughly 120x34 pixels wide anchored at the pin, so
 * on a crowded map they pile up: the shipped Fellowship opened with 9
 * overlapping pairs out of 11 markers, several names completely buried. The map
 * already had a per-marker dot-only mode built into its icon, and a filter that
 * turned *every* label off at once — nothing in between, so the only way to read
 * a crowded map was to lose every name on it.
 *
 * This keeps as many labels as actually fit. Markers are considered in a stable
 * order and a label is kept when its pill clears every pill kept so far; the
 * rest fall back to a dot, which still shows position and still opens on click.
 * Zooming in spreads the pins apart and the names come back on their own.
 *
 * Pure so it can be tested without a map: `CRS.Simple` scales by `2^zoom`, which
 * is all the geometry this needs.
 */

export interface DeclutterMarker {
  id: string
  name?: string | null
  x: number
  y: number
}

/** Matches the pill built in `makeLocationIcon`. */
const PILL_HEIGHT = 34
const ICON_WIDTH = 28
/** Label width grows with the name, same formula the icon uses. */
const labelWidth = (name: string | null | undefined) => Math.max(88, (name?.length ?? 0) * 8 + 16)
/**
 * Slack around each pill, because the estimate is not the rendered width: a
 * marker whose status is not "active" appends a badge, and the text itself can
 * run a little wider than the character-count guess. Erring wide costs a label
 * that would just have fitted; erring narrow puts two names back on top of each
 * other, which is the thing being fixed.
 */
const PADDING = 8

interface Box { left: number; right: number; top: number; bottom: number }

function pillBox(m: DeclutterMarker, scale: number): Box {
  const px = m.x * scale
  const py = m.y * scale
  // The pin sits at the diamond's centre and the label runs to its right.
  const left = px - ICON_WIDTH / 2
  return {
    left: left - PADDING,
    right: left + ICON_WIDTH + 1 + labelWidth(m.name) + 2 + PADDING,
    top: py - PILL_HEIGHT / 2 - PADDING,
    bottom: py + PILL_HEIGHT / 2 + PADDING,
  }
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * The ids whose labels should be drawn. Everything not in the set draws as a dot.
 *
 * `keepIds` are exempt from decluttering — a marker the reader has selected or
 * searched for keeps its name even in a crowd, because that is the one they
 * asked about.
 */
export function labelledMarkers(
  markers: readonly DeclutterMarker[],
  zoom: number,
  keepIds: readonly string[] = [],
): Set<string> {
  const scale = Math.pow(2, zoom)
  const forced = new Set(keepIds)
  // Stable order, so panning does not make labels swap places. Forced markers
  // are placed first so they never lose to an arbitrary neighbour.
  const ordered = [...markers].sort((a, b) => {
    const fa = forced.has(a.id) ? 0 : 1
    const fb = forced.has(b.id) ? 0 : 1
    if (fa !== fb) return fa - fb
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  const kept: Box[] = []
  const out = new Set<string>()
  for (const m of ordered) {
    const box = pillBox(m, scale)
    if (!forced.has(m.id) && kept.some((k) => overlaps(k, box))) continue
    kept.push(box)
    out.add(m.id)
  }
  return out
}
