import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useFocusTrap } from './useFocusTrap'

/** What had focus before the element that has it now, for an overlay whose field took focus as it opened. */
let focusedNow: HTMLElement | null = null
let focusedBefore: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    focusedBefore = focusedNow
    focusedNow = e.target as HTMLElement
  }, true)
}

const FIRST = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * What the shared `Dialog` gives a keyboard user, for an overlay drawn by hand
 * (ux-expert-fixes-plan.md, Part 2: the Library, Focus mode, Help and the
 * narrow navigation drawer — UX-1-5, UX-2-12, UX-3-14, UX-1-11).
 *
 * Each opened with focus left on the button behind it, so the first Tab walked
 * the page the overlay covered: Shift+Tab from the Library reached *New World*
 * under its backdrop, and Tab in Focus mode went to the top bar under the page.
 *
 * - Opening moves focus in: to `initial` if given, else to the first control,
 *   unless something inside already took it (a field with `autoFocus`).
 * - Tab and Shift+Tab stay inside (`useFocusTrap`).
 * - Closing gives focus back to what had it before, unless focus has already
 *   gone somewhere real outside the overlay.
 */
export function useOverlayFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  initial?: RefObject<HTMLElement | null>,
) {
  useFocusTrap(ref, open)
  // Whatever had focus as it opened. A field inside with `autoFocus` may have
  // taken it by the time any effect runs, and then it is the one before.
  const openerRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement as HTMLElement | null
    // <body> is no opener: a tool picked in the drawer opens Help as the drawer, and the button, go.
    openerRef.current = !active || active === document.body || ref.current?.contains(active) ? focusedBefore : active
  }, [open, ref])

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (el && !el.contains(document.activeElement)) {
      const target = initial?.current ?? el.querySelector<HTMLElement>(FIRST) ?? el
      target.focus({ preventScroll: true })
    }
    return () => {
      const active = document.activeElement as HTMLElement | null
      const lost = !active || active === document.body || !active.isConnected || (el?.contains(active) ?? false)
      const opener = openerRef.current
      if (lost && opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, ref, initial])
}
