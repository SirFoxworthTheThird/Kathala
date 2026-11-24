import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return
    const el = ref.current

    /*
      Only what Tab can land on. The trap wraps when focus is on the last of
      these, so one Tab cannot reach — a hidden file input, a button inside a
      folded section, `tabindex="-1"`, anything under `inert` (the Library's
      catalogue behind its confirm) — is a last that focus never sits on, and
      Tab walked out past it: from the Library, Help and Focus mode alike
      (UX-1-5, UX-3-14, UX-2-12).
    */
    function getFocusable() {
      return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((f) => f.tabIndex >= 0 && !f.closest('[inert]') && f.getClientRects().length > 0 && getComputedStyle(f).visibility !== 'hidden')
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, ref])
}
