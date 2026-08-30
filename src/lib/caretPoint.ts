/**
 * Where the caret is, in viewport coordinates.
 *
 * A textarea gives no way to ask this, so the standard answer is a mirror: an
 * off-screen div with the same text, the same font and the same width, with a
 * marker at the caret's offset. `FocusMode` already does it inline for its
 * typewriter scroll; this builds the mirror from the textarea's own computed
 * style so any caller can use it without owning a mirror element.
 *
 * Needed because the scene draft's `@`-mention list opened downward from the
 * bottom of the textarea, which auto-grows. On a scene longer than the screen
 * the list was painted below the fold — measured at rows 859, 887 and 915 in a
 * 900px viewport, with `new place` off-screen entirely. Anchoring to the caret
 * puts it where the writer is looking instead of where the box happens to end.
 *
 * Returns null when the browser gives no layout to measure (jsdom, a detached
 * node), so a caller can fall back rather than position at zero.
 */

/** Properties that change where a character lands, copied onto the mirror. */
const COPIED = [
  'boxSizing', 'width', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'letterSpacing', 'lineHeight', 'textTransform', 'textIndent', 'wordSpacing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
] as const

export interface CaretPoint {
  /** Top of the caret's line, in viewport coordinates. */
  top: number
  /** Left edge of the caret, in viewport coordinates. */
  left: number
  /** Height of one line, so a caller can clear the line it sits on. */
  lineHeight: number
}

export function caretPoint(ta: HTMLTextAreaElement): CaretPoint | null {
  const rect = ta.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null

  const style = window.getComputedStyle(ta)
  const mirror = document.createElement('div')
  for (const prop of COPIED) mirror.style[prop] = style[prop]
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'

  const caret = ta.selectionStart ?? ta.value.length
  mirror.textContent = ta.value.slice(0, caret)
  const marker = document.createElement('span')
  // A zero-width space, so the marker occupies a position without a glyph.
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const top = marker.offsetTop
  const left = marker.offsetLeft
  const lineHeight = marker.offsetHeight || parseFloat(style.lineHeight) || 16
  document.body.removeChild(mirror)

  if (!Number.isFinite(top) || !Number.isFinite(left)) return null

  return {
    top: rect.top + top - ta.scrollTop,
    left: rect.left + left - ta.scrollLeft,
    lineHeight,
  }
}

/**
 * Place a panel of `size` next to `point` so that all of it is on screen.
 *
 * Below the caret's line when it fits, above when it does not, and clamped to
 * the viewport when neither does — which is the case a very tall list in a
 * short window produces. Pure, so the arithmetic is testable without a browser.
 */
export function placePanel(
  point: CaretPoint,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { top: number; left: number } {
  const below = point.top + point.lineHeight + 4
  const above = point.top - size.height - 4

  let top: number
  if (below + size.height <= viewport.height - margin) top = below
  else if (above >= margin) top = above
  else top = below

  /*
    Clamp whichever branch was taken, not just the last one. Flipping above a
    caret that is itself below the fold still lands past the bottom — a caret at
    899 in a 900px window put an 84px list at 811, so its last row ended at 895.
    The point of this function is that every row is reachable, so the clamp
    applies to all three answers.
  */
  top = Math.min(top, viewport.height - size.height - margin)
  top = Math.max(margin, top)

  let left = point.left
  if (left + size.width > viewport.width - margin) left = viewport.width - size.width - margin
  if (left < margin) left = margin

  return { top, left }
}
