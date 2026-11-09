import { describe, it, expect } from 'vitest'
import { noteRows, openCount, authorLabel, readerFilter, DEFAULT_NOTE_FILTER } from '@/lib/noteList'
import type { NotePlace } from '@/lib/noteAnchor'
import type { ProseNote } from '@/types'

const note = (id: string, eventId: string, over: Partial<ProseNote> = {}): ProseNote => ({
  id, worldId: 'w', eventId, quote: 'q', prefix: '', suffix: '', kind: 'note', author: { kind: 'me' },
  body: id, status: 'open', replies: [], createdAt: Number(id.replace(/\D/g, '')), updatedAt: 0, ...over,
})
const at = (eventId: string, from: number): NotePlace => ({ eventId, from, to: from + 1, exact: true })

// Two chapters: c1 holds s1, s2; c2 holds s3. Reading order s1, s2, s3.
const CHAPTER: Record<string, string> = { s1: 'c1', s2: 'c1', s3: 'c2' }
const chapterOf = (s: string) => CHAPTER[s] ?? null
const order = (s: string) => ['s1', 's2', 's3'].indexOf(s)

describe('noteRows', () => {
  const notes = [
    note('n1', 's3'),
    note('n2', 's1'),
    note('n3', 's1'),
    note('n4', 's2', { status: 'resolved' }),
    note('n5', 's2', { author: { kind: 'editor', name: 'Ana' } }),
    note('n6', 's9'), // its scene deleted
    note('n7', 's1'), // unplaced, its scene still there
    note('n8', 's3', { author: { kind: 'reader', name: 'Ines' } }),
    note('n9', 's3', { author: { kind: 'reader', name: 'Tomas' } }),
  ]
  const places = new Map<string, NotePlace | null>([
    ['n1', at('s3', 0)], ['n2', at('s1', 40)], ['n3', at('s1', 5)], ['n4', at('s2', 0)], ['n5', at('s2', 9)],
    ['n6', null], ['n7', null], ['n8', at('s3', 5)], ['n9', at('s3', 9)],
  ])
  const ids = (f = DEFAULT_NOTE_FILTER) => noteRows(notes, places, chapterOf, order, f).map((r) => r.note.id)

  it('lists the open notes in reading order, down each scene, the unplaced after them', () => {
    expect(ids()).toEqual(['n3', 'n2', 'n5', 'n1', 'n8', 'n9', 'n6', 'n7'])
  })

  it('filters by status, chapter and who wrote it, and keeps an unplaced note in the chapter it was made in', () => {
    expect(ids({ ...DEFAULT_NOTE_FILTER, status: 'resolved' })).toEqual(['n4'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, status: 'all' })).toEqual(['n3', 'n2', 'n4', 'n5', 'n1', 'n8', 'n9', 'n6', 'n7'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, chapterId: 'c1' })).toEqual(['n3', 'n2', 'n5', 'n7'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, chapterId: 'c2' })).toEqual(['n1', 'n8', 'n9'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, author: 'editor' })).toEqual(['n5'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, author: 'me' })).toEqual(['n3', 'n2', 'n1', 'n6', 'n7'])
    // Each beta reader is a filter of their own, as well as readers together.
    expect(ids({ ...DEFAULT_NOTE_FILTER, author: 'reader' })).toEqual(['n8', 'n9'])
    expect(ids({ ...DEFAULT_NOTE_FILTER, author: readerFilter('Ines') })).toEqual(['n8'])
  })

  it('says where each is: the scene it is found in, else the one it was made in, if that is still there', () => {
    const rows = noteRows(notes, new Map([...places, ['n1', at('s2', 3)]]), chapterOf, order, { ...DEFAULT_NOTE_FILTER, status: 'all' })
    const of = (id: string) => rows.find((r) => r.note.id === id)!
    // n1 was made in s3, and its words are in s2 now.
    expect([of('n1').sceneId, of('n1').chapterId]).toEqual(['s2', 'c1'])
    expect([of('n7').sceneId, of('n7').chapterId]).toEqual(['s1', 'c1'])
    expect([of('n6').sceneId, of('n6').chapterId]).toEqual([null, null])
  })
})

describe('openCount and authorLabel', () => {
  it('count the open notes, and name who wrote one', () => {
    expect(openCount([note('n1', 's1'), note('n2', 's1', { status: 'resolved' })])).toBe(1)
    expect(authorLabel({ kind: 'me' })).toBe('Me')
    expect(authorLabel({ kind: 'editor', name: 'Ana' })).toBe('Ana (editor)')
  })
})
