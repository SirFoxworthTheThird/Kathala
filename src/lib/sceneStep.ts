/**
 * Moving between scenes from inside one, without leaving the keyboard.
 *
 * The binder is driven by keys, but a writer is not in the binder: they are in
 * a scene's draft, and the next scene was a trip to the mouse. These are the
 * two rules behind the keys that make it one keystroke — which key does what,
 * and which scene is next — kept here so they can be tested without a browser.
 */

export type SceneShortcut = 'next' | 'previous' | 'new' | 'split'

/** The modifier state a key event carries; a DOM or React event will do. */
export interface ShortcutKey {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/**
 * What a key in a scene's draft asks for, if anything.
 *
 * - **Ctrl+Alt+↓ / ↑** (⌘⌥ on a Mac) — the next or previous scene.
 * - **Ctrl+Enter** (⌘Enter) — a new scene after this one.
 * - **Ctrl+Shift+Enter** (⌘⇧Enter) — split this scene at the caret.
 *
 * Ctrl or ⌘ is taken on either platform, as the app's undo and search already
 * do. Shift is refused with the arrows: Shift+Alt+arrow extends a selection by
 * a paragraph in a Mac text box, and a key that selected text on one machine
 * and left the scene on another would be a trap. With Enter it means nothing to
 * a text box, so it is free for the split.
 */
export function sceneShortcut(e: ShortcutKey): SceneShortcut | null {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return null
  if (e.shiftKey) return !e.altKey && e.key === 'Enter' ? 'split' : null
  if (e.altKey && e.key === 'ArrowDown') return 'next'
  if (e.altKey && e.key === 'ArrowUp') return 'previous'
  if (!e.altKey && e.key === 'Enter') return 'new'
  return null
}

interface StepChapter { id: string; number: number }
interface StepScene { id: string; chapterId: string; sortOrder: number }

/**
 * The scene before or after `sceneId` in reading order, or null at either end
 * of the book.
 *
 * Reading order is chapter number, then the scene's place in its chapter —
 * so the step crosses from the last scene of one chapter to the first of the
 * next, and a chapter with no scenes is passed over rather than stopped at.
 * Only the chapters given are walked: the caller passes the scene's own
 * timeline, and, while reading, only the scenes the reader has reached, so the
 * key cannot open a scene the book has not got to yet.
 */
export function adjacentScene<S extends StepScene>(
  chapters: StepChapter[],
  scenes: S[],
  sceneId: string,
  dir: 'next' | 'previous',
): S | null {
  const chapterAt = new Map(
    [...chapters]
      .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
      .map((c, i) => [c.id, i] as const),
  )
  const ordered = scenes
    .filter((s) => chapterAt.has(s.chapterId))
    .sort((a, b) =>
      chapterAt.get(a.chapterId)! - chapterAt.get(b.chapterId)!
      || a.sortOrder - b.sortOrder
      || a.id.localeCompare(b.id))
  const at = ordered.findIndex((s) => s.id === sceneId)
  if (at === -1) return null
  return ordered[dir === 'next' ? at + 1 : at - 1] ?? null
}

/**
 * Where the caret goes in a scene arrived at by key.
 *
 * Going forward you start at the top of the prose — after the bracket line
 * saying who is there, which is the scene's header rather than its first
 * sentence. Going back you land where you would have been had the two scenes
 * been one text: at its end.
 */
export function arrivalCaret(text: string, headerEnd: number | null, at: 'start' | 'end'): number {
  if (at === 'end') return text.length
  if (headerEnd === null) return 0
  let i = headerEnd
  while (i < text.length && text[i] === '\n') i++
  return i
}
