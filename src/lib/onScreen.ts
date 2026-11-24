import { useLayoutEffect, type RefObject } from 'react'

/**
 * How far to move a box sideways so it sits within the screen, `margin` from
 * each edge, or 0 if it already does. A box wider than the screen keeps its left
 * edge on screen, since that is where reading starts.
 */
export function onScreenShift(box: { left: number; right: number }, viewportWidth: number, margin = 8): number {
  const width = box.right - box.left
  if (width > viewportWidth - margin * 2) return margin - box.left
  if (box.left < margin) return margin - box.left
  if (box.right > viewportWidth - margin) return viewportWidth - margin - box.right
  return 0
}

/**
 * Keep a popover anchored to its button but on the screen (UX-1-3): the sprint
 * menu is anchored by its right edge, which is right beside the Page's toolbar
 * and 139px off the left of a phone when its button sits in *Book tools*. It is
 * measured as it opens, before it is painted, and moved by the shift.
 */
export function useKeepOnScreen(ref: RefObject<HTMLElement | null>, open: boolean, margin = 8) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    el.style.translate = ''
    const shift = onScreenShift(el.getBoundingClientRect(), document.documentElement.clientWidth, margin)
    if (shift) el.style.translate = `${shift}px 0`
  }, [open, ref, margin])
}
