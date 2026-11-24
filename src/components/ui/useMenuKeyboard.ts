import * as React from 'react'

/** Every focusable item currently in the popup, in DOM order. */
function itemsOf(el: HTMLElement | null): HTMLElement[] {
  if (!el) return []
  return Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'))
}

/**
 * What a menu owes the keyboard, for `Menu` and for the two menus drawn by hand
 * that cannot be it: the world card's split button, whose items carry a second
 * line, and the map's toolbar, whose items are grouped under headings (UX-1-10,
 * UX-3-5). Its items are `[role="menuitem"]`.
 *
 * - ↓ or ↑ on the trigger opens the menu with focus on its first item; a click
 *   opens it with focus where it was.
 * - ↓ ↑ Home End move between items, wrapping.
 * - Escape closes it and gives focus back to the trigger. It is taken on the
 *   window in the capture phase, before a dialog's own Escape on `document`
 *   can close the dialog too.
 * - Tab closes it and lets the Tab go on.
 * - A pointer press outside closes it.
 */
export function useMenuKeyboard({ open, setOpen, rootRef, triggerRef, popupRef }: {
  open: boolean
  setOpen: (open: boolean) => void
  rootRef: React.RefObject<HTMLElement | null>
  triggerRef: React.RefObject<HTMLElement | null>
  popupRef: React.RefObject<HTMLElement | null>
}) {
  // Set when the menu is opened from the keyboard, so focus lands on an item
  // rather than staying on the trigger. A pointer user gets neither.
  const focusFirstRef = React.useRef(false)

  const close = React.useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [setOpen, triggerRef])

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      e.preventDefault()
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, close, rootRef, setOpen])

  React.useEffect(() => {
    if (!open || !focusFirstRef.current) return
    focusFirstRef.current = false
    itemsOf(popupRef.current)[0]?.focus()
  }, [open, popupRef])

  const onPopupKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const items = itemsOf(popupRef.current)
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[i < 0 || i === items.length - 1 ? 0 : i + 1].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[i <= 0 ? items.length - 1 : i - 1].focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0].focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1].focus()
    } else if (e.key === 'Tab') {
      // Tabbing away is a decision to leave, so the menu goes with it — and
      // without restoring focus, which would fight the Tab.
      close(false)
    }
  }, [close, popupRef])

  const onTriggerKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    focusFirstRef.current = true
    setOpen(true)
  }, [setOpen])

  return { close, onPopupKeyDown, onTriggerKeyDown }
}

