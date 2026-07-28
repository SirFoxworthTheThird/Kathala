/** Geometry for placing a popover (like a Select dropdown) so it stays on screen. */

export interface AnchorRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface Viewport {
  width: number
  height: number
}

export interface SelectPosition {
  /** Whether the panel opens below the trigger or flips above it. */
  placement: 'below' | 'above'
  left: number
  width: number
  /** Cap so the panel never runs past the edge it grows toward; it scrolls inside. */
  maxHeight: number
  /** Fixed-position offset from the top of the viewport (placement === 'below'). */
  top?: number
  /** Fixed-position offset from the bottom of the viewport (placement === 'above'). */
  bottom?: number
}

/**
 * Position a dropdown panel relative to its trigger so it always fits within the
 * viewport. Opens below by default; flips above when there's meaningfully more
 * room up top (e.g. a trigger near the bottom of a phone screen). The height is
 * capped to the available space so no options end up off-screen — the panel
 * scrolls internally instead — and the horizontal position is clamped so it
 * never spills off the left or right edge.
 */
export function computeSelectPosition(
  rect: AnchorRect,
  viewport: Viewport,
  opts: { margin?: number; gap?: number; maxHeight?: number } = {},
): SelectPosition {
  const margin = opts.margin ?? 8
  const gap = opts.gap ?? 4
  const cap = opts.maxHeight ?? 256

  const spaceBelow = viewport.height - rect.bottom - margin
  const spaceAbove = rect.top - margin
  // Prefer below unless it's cramped and above genuinely has more room.
  const below = spaceBelow >= Math.min(cap, 160) || spaceBelow >= spaceAbove
  const avail = below ? spaceBelow : spaceAbove
  const maxHeight = Math.max(0, Math.min(cap, avail))

  const width = Math.min(rect.width, Math.max(0, viewport.width - margin * 2))
  const left = Math.min(Math.max(margin, rect.left), Math.max(margin, viewport.width - width - margin))

  return below
    ? { placement: 'below', left, width, maxHeight, top: rect.bottom + gap }
    : { placement: 'above', left, width, maxHeight, bottom: viewport.height - rect.top + gap }
}
