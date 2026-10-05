import { describe, it, expect } from 'vitest'
import { binderDrop, binderKey, binderRows, dropPlace, focusAfterDelete, newScenePlace, type BinderChapter, type BinderRow, type BinderScene } from '@/lib/binder'

const chapters: BinderChapter[] = [
  { id: 'c2', number: 2, title: 'The Hut' },
  { id: 'c1', number: 1, title: 'The Glass' },
]
const scenes: BinderScene[] = [
  { id: 's2', chapterId: 'c1', title: 'A letter', sortOrder: 2 },
  { id: 's1', chapterId: 'c1', title: 'The snake', sortOrder: 1 },
  { id: 's3', chapterId: 'c2', title: 'The rock', sortOrder: 1 },
]
const ids = (rows: ReturnType<typeof binderRows>) => rows.map((r) => r.id)

describe('binderRows', () => {
  it('lists chapters in book order with the open ones showing their scenes', () => {
    const rows = binderRows(chapters, scenes, { expanded: new Set(['c1']) })
    expect(ids(rows)).toEqual(['c1', 's1', 's2', 'c2'])
    // Closed chapters still say how much is in them.
    expect(rows.find((r) => r.id === 'c2')).toMatchObject({ kind: 'chapter', expanded: false, sceneCount: 1 })
  })

  it('orders scenes by position, ties broken by id, the same as everywhere else', () => {
    const tied: BinderScene[] = [
      { id: 'b', chapterId: 'c1', title: 'B', sortOrder: 1 },
      { id: 'a', chapterId: 'c1', title: 'A', sortOrder: 1 },
    ]
    expect(ids(binderRows(chapters, tied, { expanded: new Set(['c1']) }))).toEqual(['c1', 'a', 'b', 'c2'])
  })

  it('gives each row its place in its own set, for a screen reader', () => {
    const rows = binderRows(chapters, scenes, { expanded: new Set(['c1', 'c2']) })
    expect(rows.map((r) => `${r.id}:${r.position}/${r.setSize}`))
      .toEqual(['c1:1/2', 's1:1/2', 's2:2/2', 'c2:2/2', 's3:1/1'])
  })

  it('leaves out a chapter a reader has not reached, and keeps the one they have', () => {
    // The absence and the presence in one call. Scenes are not filtered here —
    // `useWorldEvents` has already stopped them at the cursor.
    const rows = binderRows(chapters, scenes, {
      expanded: new Set(['c1', 'c2']),
      showChapter: (c) => c.number <= 1,
    })
    expect(ids(rows)).toEqual(['c1', 's1', 's2'])
  })
})

describe('binderKey', () => {
  const open = binderRows(chapters, scenes, { expanded: new Set(['c1']) })

  it('moves up and down the visible rows, and stops at the ends', () => {
    expect(binderKey(open, 'c1', 'ArrowDown')).toEqual({ type: 'focus', id: 's1' })
    expect(binderKey(open, 's2', 'ArrowDown')).toEqual({ type: 'focus', id: 'c2' })
    expect(binderKey(open, 'c2', 'ArrowDown')).toBeNull()
    expect(binderKey(open, 'c1', 'ArrowUp')).toBeNull()
    expect(binderKey(open, 'c2', 'Home')).toEqual({ type: 'focus', id: 'c1' })
    expect(binderKey(open, 'c1', 'End')).toEqual({ type: 'focus', id: 'c2' })
  })

  it('opens and closes chapters with the arrows, and steps in and out of them', () => {
    expect(binderKey(open, 'c2', 'ArrowRight')).toEqual({ type: 'expand', chapterId: 'c2' })
    expect(binderKey(open, 'c1', 'ArrowRight')).toEqual({ type: 'focus', id: 's1' })
    expect(binderKey(open, 'c1', 'ArrowLeft')).toEqual({ type: 'collapse', chapterId: 'c1' })
    expect(binderKey(open, 's2', 'ArrowLeft')).toEqual({ type: 'focus', id: 'c1' })
    // A closed chapter has nowhere further left to go, and a scene nowhere right.
    expect(binderKey(open, 'c2', 'ArrowLeft')).toBeNull()
    expect(binderKey(open, 's1', 'ArrowRight')).toBeNull()
  })

  it('does not step into an open chapter with nothing in it', () => {
    const empty = binderRows([{ id: 'c9', number: 9, title: 'Empty' }], [], { expanded: new Set(['c9']) })
    expect(binderKey(empty, 'c9', 'ArrowRight')).toBeNull()
  })

  it('adds a scene on the line below: first in a chapter, next after a scene', () => {
    expect(binderKey(open, 'c1', 'Enter')).toEqual({ type: 'add', chapterId: 'c1', index: 0 })
    expect(binderKey(open, 's1', 'Enter')).toEqual({ type: 'add', chapterId: 'c1', index: 1 })
    expect(binderKey(open, 's2', 'Enter')).toEqual({ type: 'add', chapterId: 'c1', index: 2 })
  })

  it('goes to a row with Space', () => {
    expect(binderKey(open, 's2', ' ')).toMatchObject({ type: 'go', row: { id: 's2' } })
  })

  it('deletes a scene, and never a chapter, which takes every scene in it', () => {
    expect(binderKey(open, 's1', 'Delete')).toEqual({ type: 'delete', sceneId: 's1' })
    expect(binderKey(open, 's1', 'Backspace')).toEqual({ type: 'delete', sceneId: 's1' })
    expect(binderKey(open, 'c1', 'Delete')).toBeNull()
  })

  it('lets a reader move about and go somewhere, but not add or remove', () => {
    // The pair, in one test: the same keys that edit for a writer.
    expect(binderKey(open, 's1', 'Enter', true)).toMatchObject({ type: 'add' })
    expect(binderKey(open, 's1', 'Enter', false)).toMatchObject({ type: 'go', row: { id: 's1' } })
    expect(binderKey(open, 's1', 'Delete', true)).toMatchObject({ type: 'delete' })
    expect(binderKey(open, 's1', 'Delete', false)).toBeNull()
    expect(binderKey(open, 's1', 'ArrowDown', false)).toEqual({ type: 'focus', id: 's2' })
  })

  it('ignores keys it has no meaning for', () => {
    expect(binderKey(open, 's1', 'a')).toBeNull()
    expect(binderKey([], null, 'ArrowDown')).toBeNull()
  })

  it('moves the focused row with Alt and an arrow', () => {
    expect(binderKey(open, 's1', 'Alt+ArrowDown')).toEqual({ type: 'moveScene', sceneId: 's1', dir: 'down' })
    expect(binderKey(open, 's2', 'Alt+ArrowUp')).toEqual({ type: 'moveScene', sceneId: 's2', dir: 'up' })
    // A chapter goes to the next place among the chapters…
    expect(binderKey(open, 'c1', 'Alt+ArrowDown')).toEqual({ type: 'moveChapter', chapterId: 'c1', toIndex: 1 })
    expect(binderKey(open, 'c2', 'Alt+ArrowUp')).toEqual({ type: 'moveChapter', chapterId: 'c2', toIndex: 0 })
    // …and nowhere past either end.
    expect(binderKey(open, 'c1', 'Alt+ArrowUp')).toBeNull()
    expect(binderKey(open, 'c2', 'Alt+ArrowDown')).toBeNull()
  })

  it('moves nothing for a reader', () => {
    expect(binderKey(open, 's1', 'Alt+ArrowDown', false)).toBeNull()
    expect(binderKey(open, 'c1', 'Alt+ArrowDown', false)).toBeNull()
  })
})

describe('focusAfterDelete', () => {
  const open = binderRows(chapters, scenes, { expanded: new Set(['c1', 'c2']) })

  it('takes the next scene in the same chapter', () => {
    expect(focusAfterDelete(open, 's1')).toBe('s2')
  })

  it('takes the row above when the scene was its chapter’s last', () => {
    expect(focusAfterDelete(open, 's2')).toBe('s1')
    // An only scene: above it is its own chapter, not the next chapter's row.
    expect(focusAfterDelete(open, 's3')).toBe('c2')
  })

  it('does not cross into the next chapter', () => {
    // s2 is followed by c2's row — a different chapter, so not taken.
    expect(focusAfterDelete(open, 's2')).not.toBe('c2')
  })
})

describe('dropping a row', () => {
  const three: BinderChapter[] = [
    { id: 'c1', number: 1, title: 'One' },
    { id: 'c2', number: 2, title: 'Two' },
    { id: 'c3', number: 3, title: 'Three' },
  ]
  const many: BinderScene[] = [
    { id: 'a', chapterId: 'c1', title: 'a', sortOrder: 1 },
    { id: 'b', chapterId: 'c1', title: 'b', sortOrder: 2 },
    { id: 'c', chapterId: 'c1', title: 'c', sortOrder: 3 },
    { id: 'd', chapterId: 'c2', title: 'd', sortOrder: 1 },
  ]
  const rows = binderRows(three, many, { expanded: new Set(['c1', 'c2']) })
  const row = (id: string) => rows.find((r) => r.id === id) as BinderRow

  it('names the place by the row and the half the pointer is over', () => {
    expect(dropPlace(row('c1'), row('c2'), false)).toBe('before')
    expect(dropPlace(row('c1'), row('c2'), true)).toBe('after')
    expect(dropPlace(row('c1'), row('a'), true)).toBeNull()      // a chapter onto a scene
    expect(dropPlace(row('a'), row('c2'), false)).toBe('into')   // a scene onto a chapter
    expect(dropPlace(row('a'), row('d'), true)).toBe('after')
  })

  it('moves a chapter before or after another, counting the gap it leaves', () => {
    expect(binderDrop(row('c3'), row('c1'), 'before')).toEqual({ type: 'moveChapter', chapterId: 'c3', toIndex: 0 })
    expect(binderDrop(row('c1'), row('c3'), 'after')).toEqual({ type: 'moveChapter', chapterId: 'c1', toIndex: 2 })
    expect(binderDrop(row('c1'), row('c3'), 'before')).toEqual({ type: 'moveChapter', chapterId: 'c1', toIndex: 1 })
    // Onto its own edges: nowhere to go.
    expect(binderDrop(row('c1'), row('c2'), 'before')).toBeNull()
    expect(binderDrop(row('c2'), row('c1'), 'after')).toBeNull()
  })

  it('moves a scene within its chapter, counting the gap it leaves', () => {
    expect(binderDrop(row('a'), row('c'), 'after')).toEqual({ type: 'moveScene', sceneId: 'a', chapterId: 'c1', index: 2 })
    expect(binderDrop(row('a'), row('c'), 'before')).toEqual({ type: 'moveScene', sceneId: 'a', chapterId: 'c1', index: 1 })
    expect(binderDrop(row('c'), row('a'), 'before')).toEqual({ type: 'moveScene', sceneId: 'c', chapterId: 'c1', index: 0 })
    expect(binderDrop(row('a'), row('b'), 'before')).toBeNull()
    expect(binderDrop(row('b'), row('a'), 'after')).toBeNull()
  })

  it('moves a scene into another chapter, beside a scene or onto the chapter', () => {
    expect(binderDrop(row('a'), row('d'), 'before')).toEqual({ type: 'moveScene', sceneId: 'a', chapterId: 'c2', index: 0 })
    expect(binderDrop(row('a'), row('d'), 'after')).toEqual({ type: 'moveScene', sceneId: 'a', chapterId: 'c2', index: 1 })
    expect(binderDrop(row('a'), row('c3'), 'into')).toMatchObject({ type: 'moveScene', sceneId: 'a', chapterId: 'c3' })
    // Onto its own chapter's row it is already in there.
    expect(binderDrop(row('a'), row('c1'), 'into')).toBeNull()
  })
})

describe('newScenePlace — the New scene button', () => {
  it('in a closed chapter holding the scene the cursor is on, adds after that scene', () => {
    // c1 closed, as the binder is when reached from the navigation; the cursor on its last scene.
    expect(newScenePlace(chapters, scenes, { expanded: new Set() }, 'c1', 's2')).toEqual({ chapterId: 'c1', index: 2 })
    expect(newScenePlace(chapters, scenes, { expanded: new Set() }, 'c1', 's1')).toEqual({ chapterId: 'c1', index: 1 })
  })

  it('a closed chapter with the cursor elsewhere is still "first in the chapter", as Enter on it is', () => {
    expect(newScenePlace(chapters, scenes, { expanded: new Set() }, 'c1', 's3')).toEqual({ chapterId: 'c1', index: 0 })
  })

  it('an open tree adds below the row Tab lands on, unchanged', () => {
    expect(newScenePlace(chapters, scenes, { expanded: new Set(['c1']) }, 's1', 's2')).toEqual({ chapterId: 'c1', index: 1 })
    expect(newScenePlace(chapters, scenes, { expanded: new Set(['c1']) }, 'c1', 's2')).toEqual({ chapterId: 'c1', index: 0 })
  })
})
