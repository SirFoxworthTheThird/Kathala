import { describe, it, expect } from 'vitest'
import { noteRows, openCount, authorLabel, readerFilter, DEFAULT_NOTE_FILTER, answeredIn, answeredSentence, replyDate } from '@/lib/noteList'
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

  it('a note on the title page is first, and one on a chapter’s heading is before the notes in that chapter, not with the unplaced (round-trip-plan-3.md, T9.4)', () => {
    const outside = [
      ...notes,
      note('n20', 's3', { outside: 'heading' }), // on c2's heading
      note('n21', 's2', { outside: 'title page' }),
      note('n22', 's9', { outside: 'heading' }), // its chapter's scene deleted
    ]
    const p = new Map<string, NotePlace | null>([...places, ['n20', null], ['n21', null], ['n22', null]])
    const rows = noteRows(outside, p, chapterOf, order, DEFAULT_NOTE_FILTER)
    expect(rows.map((r) => r.note.id)).toEqual(['n21', 'n3', 'n2', 'n5', 'n20', 'n1', 'n8', 'n9', 'n6', 'n7', 'n22'])
    // The heading's note is in its chapter's filter; the title page's is in no chapter's, though the scene it names is in c1.
    expect(noteRows(outside, p, chapterOf, order, { ...DEFAULT_NOTE_FILTER, chapterId: 'c2' }).map((r) => r.note.id)).toEqual(['n20', 'n1', 'n8', 'n9'])
    expect(noteRows(outside, p, chapterOf, order, { ...DEFAULT_NOTE_FILTER, chapterId: 'c1' }).map((r) => r.note.id)).toEqual(['n3', 'n2', 'n5', 'n7'])
    expect(rows.find((r) => r.note.id === 'n21')).toMatchObject({ sceneId: null, chapterId: null })
  })
})

describe('openCount and authorLabel', () => {
  it('count the open notes, and name who wrote one', () => {
    expect(openCount([note('n1', 's1'), note('n2', 's1', { status: 'resolved' })])).toBe(1)
    expect(authorLabel({ kind: 'me' })).toBe('Me')
    expect(authorLabel({ kind: 'editor', name: 'Ana' })).toBe('Ana (editor)')
  })
})

/*
  What an edited file answered (round-trip-plan-3.md, T9.5). Six of the second
  loop's seven replies sat in threads the editor had resolved, which Notes
  hides by default, and the dialog spoke only of changes and new comments.
*/
describe('the threads an edited file answered', () => {
  const reply = (id: string, broughtIn?: string) => ({ id, author: { kind: 'editor' as const, name: 'Ana' }, body: id, createdAt: 0, ...(broughtIn ? { broughtIn } : {}) })
  const notes = [
    note('a1', 's1', { replies: [reply('r1', 'F2')] }), // answered in F2, still open
    note('a2', 's2', { status: 'resolved', resolvedIn: 'F2', replies: [reply('r2', 'F2')] }), // answered and resolved in F2
    note('a3', 's3', { status: 'resolved', resolvedIn: 'F2' }), // resolved in F2, no reply
    note('a4', 's1', { replies: [reply('r4', 'F1')] }), // answered in an earlier file
    note('a5', 's2', { status: 'resolved', replies: [reply('r5')] }), // resolved by hand, the writer's reply
    note('a6', 's3'),
  ]
  const places = new Map<string, NotePlace | null>(notes.map((n, i) => [n.id, at(n.eventId, i)]))
  const ids = (f: Parameters<typeof noteRows>[4]) => noteRows(notes, places, chapterOf, order, f).map((r) => r.note.id)

  it('is the threads it replied in or resolved, open and resolved alike, in reading order', () => {
    expect(notes.filter((n) => answeredIn(n, 'F2')).map((n) => n.id)).toEqual(['a1', 'a2', 'a3'])
    const fromFile = { importId: 'F2', name: 'ledger-2.docx' }
    // Whatever the status filter says: most of what a file answers, it also resolves.
    for (const status of ['open', 'resolved', 'all'] as const) expect(ids({ ...DEFAULT_NOTE_FILTER, status, fromFile }), status).toEqual(['a1', 'a2', 'a3'])
    // Another file's are its own.
    expect(ids({ ...DEFAULT_NOTE_FILTER, fromFile: { importId: 'F1', name: 'ledger-1.docx' } })).toEqual(['a4'])
    // And without it, the status filter as before: the open ones only.
    expect(ids(DEFAULT_NOTE_FILTER)).toEqual(['a1', 'a4', 'a6'])
    // The other filters still narrow it.
    expect(ids({ ...DEFAULT_NOTE_FILTER, chapterId: 'c1', fromFile })).toEqual(['a1', 'a2'])
  })

  it('says what it did: replies added, threads resolved, either or both, each agreeing with its count', () => {
    expect(answeredSentence(7, 1)).toBe('7 replies were added to your notes, and 1 thread was resolved.')
    expect(answeredSentence(1, 2)).toBe('1 reply was added to your notes, and 2 threads were resolved.')
    expect(answeredSentence(1, 0)).toBe('1 reply was added to your notes.')
    expect(answeredSentence(0, 1)).toBe('1 thread was resolved.')
    expect(answeredSentence(0, 0)).toBeNull()
  })

  it('a reply’s date: the day and the month named, and the year where it is not this year', () => {
    const now = Date.UTC(2026, 10, 13, 12)
    const day = (s: string) => s.replace(/[^0-9A-Za-z ]/g, '').split(' ').filter(Boolean)
    expect(day(replyDate(Date.UTC(2026, 10, 8, 12), now)).sort()).toEqual(['8', 'Nov'].sort())
    expect(day(replyDate(Date.UTC(2025, 10, 8, 12), now)).sort()).toEqual(['2025', '8', 'Nov'].sort())
  })
})
