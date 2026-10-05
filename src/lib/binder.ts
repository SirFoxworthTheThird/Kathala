/**
 * The binder: a book's chapters and scenes as a two-level tree, beside the
 * writing.
 *
 * Everything here is pure — which rows are showing, and what a key does on one
 * of them — so the behaviour a keyboard user depends on is tested without a
 * browser, and the component only has to draw it.
 *
 * The tree is **flat**: rows carry `aria-level` rather than being nested in
 * groups, which is one of the two structures the ARIA tree pattern allows, and
 * the one that lets a single list of rows drive both the keys and the drawing.
 */
import { compareByPosition } from '@/lib/fractionalOrder'

export interface BinderChapter {
  id: string
  number: number
  title: string
}

export interface BinderScene {
  id: string
  chapterId: string
  title: string
  sortOrder: number
}

export type BinderRow =
  | {
      kind: 'chapter'
      id: string
      chapterId: string
      number: number
      title: string
      expanded: boolean
      /** Scenes in the chapter, showing or not — for "3 scenes" beside a closed one. */
      sceneCount: number
      /** 1-based position among the chapters, for `aria-posinset`. */
      position: number
      setSize: number
    }
  | {
      kind: 'scene'
      id: string
      chapterId: string
      title: string
      /** 0-based index within its chapter — where a new scene after it goes. */
      index: number
      position: number
      setSize: number
    }

export interface BinderRowsOptions {
  /** Which chapters are open. */
  expanded: ReadonlySet<string>
  /**
   * Whether a chapter may be shown at all. Reading mode passes the reader's
   * gate, so the binder is not a table of contents for the rest of the book.
   *
   * There is no equivalent for scenes because none is needed: the scenes come
   * from `useWorldEvents`, which already stops at the reader's cursor. Filtering
   * them again here would be a second gate that nothing could tell was working.
   */
  showChapter?: (chapter: BinderChapter) => boolean
}

/** The rows a reader of the tree can see, top to bottom. */
export function binderRows(
  chapters: readonly BinderChapter[],
  scenes: readonly BinderScene[],
  { expanded, showChapter = () => true }: BinderRowsOptions,
): BinderRow[] {
  const visibleChapters = [...chapters].filter(showChapter).sort((a, b) => a.number - b.number)
  const byChapter = new Map<string, BinderScene[]>()
  for (const scene of scenes) {
    const list = byChapter.get(scene.chapterId) ?? []
    list.push(scene)
    byChapter.set(scene.chapterId, list)
  }

  const rows: BinderRow[] = []
  visibleChapters.forEach((chapter, ci) => {
    const own = (byChapter.get(chapter.id) ?? []).sort(compareByPosition)
    const open = expanded.has(chapter.id)
    rows.push({
      kind: 'chapter',
      id: chapter.id,
      chapterId: chapter.id,
      number: chapter.number,
      title: chapter.title,
      expanded: open,
      sceneCount: own.length,
      position: ci + 1,
      setSize: visibleChapters.length,
    })
    if (!open) return
    own.forEach((scene, si) => {
      rows.push({
        kind: 'scene',
        id: scene.id,
        chapterId: chapter.id,
        title: scene.title,
        index: si,
        position: si + 1,
        setSize: own.length,
      })
    })
  })
  return rows
}

export type BinderAction =
  | { type: 'focus'; id: string }
  | { type: 'expand'; chapterId: string }
  | { type: 'collapse'; chapterId: string; focus?: string }
  | { type: 'go'; row: BinderRow }
  /** A new scene at `index` of `chapterId` — the line below the row. */
  | { type: 'add'; chapterId: string; index: number }
  | { type: 'delete'; sceneId: string }
  /**
   * Move the row one place. A chapter goes to `toIndex` among the chapters; a
   * scene takes one step, crossing into the next chapter at an edge — see
   * `moveSceneStep`, which decides that from the book rather than the rows.
   */
  | { type: 'moveChapter'; chapterId: string; toIndex: number }
  | { type: 'moveScene'; sceneId: string; dir: 'up' | 'down' }

/**
 * What a key does on the focused row, or null for a key the tree leaves alone.
 *
 * The movement keys are the ARIA tree pattern's. The two that are not:
 *
 * - **Enter adds a scene on the line below** — below a chapter row that is its
 *   first scene, below a scene it is the next one. That is the outliner's Enter
 *   rather than the tree pattern's, because the tree's own Enter ("activate")
 *   is already Space and a click, and making a new scene is the thing this
 *   binder is for.
 * - **Delete removes a scene** — never a chapter, which takes every scene in
 *   it. The app's undo catches the scene; a chapter is a bigger thing to lose
 *   to a stray key.
 *
 * - **Alt+↑ / ↓ moves the row** — a chapter past its neighbour, a scene one
 *   step, out of its chapter at either edge. Alt, because plain arrows move
 *   the focus; it is the outliner's convention for moving the item itself.
 *
 * `editable` is false for a reader, who can move about and go to a scene but
 * not add, remove or move one.
 *
 * `key` is the event's key, prefixed `Alt+` when Alt was held.
 */
export function binderKey(
  rows: readonly BinderRow[],
  focusedId: string | null,
  key: string,
  editable = true,
): BinderAction | null {
  if (rows.length === 0) return null
  const at = rows.findIndex((r) => r.id === focusedId)
  const i = at === -1 ? 0 : at
  const row = rows[i]

  switch (key) {
    case 'ArrowDown':
      return i < rows.length - 1 ? { type: 'focus', id: rows[i + 1].id } : null
    case 'ArrowUp':
      return i > 0 ? { type: 'focus', id: rows[i - 1].id } : null
    case 'Home':
      return { type: 'focus', id: rows[0].id }
    case 'End':
      return { type: 'focus', id: rows[rows.length - 1].id }
    case 'ArrowRight':
      if (row.kind !== 'chapter') return null
      if (!row.expanded) return { type: 'expand', chapterId: row.chapterId }
      // Open already: step into it, if it has anything to step into.
      return rows[i + 1]?.kind === 'scene' ? { type: 'focus', id: rows[i + 1].id } : null
    case 'ArrowLeft':
      if (row.kind === 'chapter') return row.expanded ? { type: 'collapse', chapterId: row.chapterId } : null
      return { type: 'focus', id: row.chapterId }
    case ' ':
      return { type: 'go', row }
    case 'Enter':
      if (!editable) return { type: 'go', row }
      return row.kind === 'chapter'
        ? { type: 'add', chapterId: row.chapterId, index: 0 }
        : { type: 'add', chapterId: row.chapterId, index: row.index + 1 }
    case 'Delete':
    case 'Backspace':
      return editable && row.kind === 'scene' ? { type: 'delete', sceneId: row.id } : null
    case 'Alt+ArrowUp':
    case 'Alt+ArrowDown': {
      if (!editable) return null
      const dir = key === 'Alt+ArrowUp' ? 'up' : 'down'
      if (row.kind === 'scene') return { type: 'moveScene', sceneId: row.id, dir }
      // `position` is 1-based among the chapters showing, which for a writer is all of them.
      const toIndex = row.position - 1 + (dir === 'up' ? -1 : 1)
      return toIndex >= 0 && toIndex < row.setSize ? { type: 'moveChapter', chapterId: row.chapterId, toIndex } : null
    }
    default:
      return null
  }
}

/**
 * Where focus goes after a scene is deleted: the next scene in its chapter,
 * else the row above it. Never nowhere — a tree that loses focus on Delete
 * sends a keyboard user back to the top of the page.
 *
 * "The row above" is always something, because a scene always has its own
 * chapter's row above it at the very least.
 */
export function focusAfterDelete(rows: readonly BinderRow[], deletedId: string): string | null {
  const i = rows.findIndex((r) => r.id === deletedId)
  if (i === -1) return null
  const below = rows[i + 1]
  if (below?.kind === 'scene' && below.chapterId === rows[i].chapterId) return below.id
  return rows[i - 1]?.id ?? null
}

/** Where on a row a dragged row is being dropped. */
export type DropPlace = 'before' | 'after' | 'into'

export type BinderDrop =
  | { type: 'moveChapter'; chapterId: string; toIndex: number }
  /** `index` is among the chapter's scenes *without* the moved one — `moveEventOnBoard`'s. */
  | { type: 'moveScene'; sceneId: string; chapterId: string; index: number }

/**
 * Which place a drop lands on, from where on the target row the pointer is.
 *
 * A chapter dropped on a chapter goes before or after it, by which half of the
 * row the pointer is over. A scene dropped on a scene likewise. A scene dropped
 * on a chapter row goes *into* it, at the end — that row is the chapter's
 * handle, not a place between two scenes. A chapter cannot be dropped on a
 * scene.
 */
export function dropPlace(dragged: BinderRow, target: BinderRow, lowerHalf: boolean): DropPlace | null {
  if (dragged.kind === 'chapter') return target.kind === 'chapter' ? (lowerHalf ? 'after' : 'before') : null
  if (target.kind === 'chapter') return 'into'
  return lowerHalf ? 'after' : 'before'
}

/**
 * What dropping `dragged` at `place` on `target` does, or null when it would
 * leave everything where it is.
 *
 * The one piece of arithmetic worth writing down: dropping *after* a row below
 * the dragged one, in the same list, is one place less than it looks, because
 * the dragged row is no longer in the list it is dropped into.
 */
export function binderDrop(dragged: BinderRow, target: BinderRow, place: DropPlace): BinderDrop | null {
  if (dragged.id === target.id) return null
  if (dragged.kind === 'chapter') {
    if (target.kind !== 'chapter' || place === 'into') return null
    const from = dragged.position - 1
    let to = target.position - 1 + (place === 'after' ? 1 : 0)
    if (from < to) to -= 1
    return to === from ? null : { type: 'moveChapter', chapterId: dragged.chapterId, toIndex: to }
  }
  if (target.kind === 'chapter') {
    // Onto its own chapter's row: it is already in there.
    if (target.chapterId === dragged.chapterId) return null
    return { type: 'moveScene', sceneId: dragged.id, chapterId: target.chapterId, index: Number.MAX_SAFE_INTEGER }
  }
  let index = target.index + (place === 'after' ? 1 : 0)
  if (target.chapterId === dragged.chapterId) {
    if (dragged.index < index) index -= 1
    if (index === dragged.index) return null
  }
  return { type: 'moveScene', sceneId: dragged.id, chapterId: target.chapterId, index }
}

/**
 * Where the binder's **New scene** button adds a scene.
 *
 * It adds below the row Tab lands on, as Enter there does — and when that row
 * is a closed chapter, Enter on a chapter means "add it first". A chapter is
 * closed when the binder is reached from the navigation, so with the cursor on
 * a chapter's last scene the button put the new one at the top, three times in
 * a writer run. The scene the cursor is on is the place a writer means when it
 * is in that closed chapter: the new scene goes after it.
 */
export function newScenePlace(
  chapters: readonly BinderChapter[],
  scenes: readonly BinderScene[],
  options: BinderRowsOptions,
  rovingId: string | null,
  activeSceneId: string | null,
): { chapterId: string; index: number } | null {
  const rows = binderRows(chapters, scenes, options)
  const roving = rows.find((r) => r.id === rovingId)
  const active = scenes.find((s) => s.id === activeSceneId)
  const add = (list: BinderRow[], from: string | null) => {
    const action = binderKey(list, from, 'Enter', true)
    return action?.type === 'add' ? { chapterId: action.chapterId, index: action.index } : null
  }
  if (roving?.kind === 'chapter' && !roving.expanded && active?.chapterId === roving.chapterId) {
    const open = binderRows(chapters, scenes, { ...options, expanded: new Set([...options.expanded, roving.chapterId]) })
    return add(open, active.id)
  }
  return add(rows, rovingId)
}
