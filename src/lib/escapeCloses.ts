/**
 * Whether an Escape should close the panel it was pressed in (UX-3-7).
 *
 * Not from inside a text field: a panel's fields save as they lose focus, and
 * closing the panel unmounts the field without that blur, so Escape there would
 * throw the words away. There, Escape is the field's (a tag box clears itself
 * on it). Not when something nearer took the key first, a list or a menu, which
 * marks it handled.
 */
export function escapeCloses(e: Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'target'>): boolean {
  if (e.key !== 'Escape' || e.defaultPrevented) return false
  const t = e.target as HTMLElement | null
  if (!t || typeof t.closest !== 'function') return true
  return !t.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea, select, [contenteditable="true"]')
}

/**
 * Whether something above the panel has the Escape: a modal (a dialog, the
 * full-size picture), or an open list or menu.
 *
 * A panel listens on the window in the capture phase, which hears the key before
 * any of them does, while they are still in the page. Listening after them did
 * not work: the full-size picture closed on its own Escape, React drew the page
 * without it between one listener and the next, and the map's character panel
 * under it then closed too.
 */
export function somethingAbove(doc: Pick<Document, 'querySelector'> = document): boolean {
  return doc.querySelector('[aria-modal="true"], [role="listbox"], [role="menu"]') !== null
}
