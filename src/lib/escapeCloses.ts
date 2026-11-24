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
