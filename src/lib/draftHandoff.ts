/**
 * What the unsaved-draft slot should hold once a save has landed.
 *
 * The scene editor keeps `draft === null` to mean "show the stored value" and a
 * string to mean "unsaved edits". Saving used to `await` the write and then
 * clear the slot unconditionally — so anything typed *during* the write was
 * thrown away, and the box snapped back to the text that had just been saved.
 * The keystrokes were gone: no undo entry, no revision, nothing.
 *
 * The window is small — the save runs on blur — but it is not theoretical. It
 * is also reachable without blurring: the Focus button saves while the editor
 * stays open and keeps taking input.
 *
 * It surfaced as an intermittent test failure rather than a report, which by
 * now is the usual way these are found: the spec typed a second draft the
 * instant the first was stored, lost it to this, and then waited for a revision
 * that could never be captured.
 */
export function draftAfterSave(current: string | null, saved: string): string | null {
  // Untouched since the save began — fall back to the freshly stored value.
  if (current === saved) return null
  // Typed during the write. Those keystrokes are newer than what was stored,
  // so they stay, and the next save will carry them.
  return current
}
