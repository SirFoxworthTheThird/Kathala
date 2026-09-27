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
 * `editable` is false for a reader, who can move about and go to a scene but
 * not add or remove one.
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
