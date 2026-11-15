import { describe, it, expect } from 'vitest'
import { markedPlan, APP_SIGNER } from '@/lib/markedDocx'
import { compileDocx } from '@/lib/manuscriptExport'
import { buildManuscript, type BuiltManuscript } from '@/lib/manuscriptCompile'
import { readStoredZip } from '@/lib/zip'
import type { DraftBook } from '@/lib/bookDraft'
import type { Chapter, WorldEvent } from '@/types'

/*
  Whose name and which date (round-trip-plan-4.md, T17; loop-2026-11-14.md,
  findings 5 and 6). All 203 marks of the third loop's round 2 were dated
  19:18:35, the export's moment, and the lines *On words since rewritten* were
  signed by the writer, dated with the export, and listed before replies made
  earlier. "In Word they look like your words" (the editor's F-3).
*/

const A = 'The ninth bell had already gone when she climbed the back stair of the Customs House.'
const B = 'Somewhere below, a door was shut with more care than a door needs.'
const C = 'Low water was at a quarter past, and the whole city knew it.'
const EXPORT = '2026-11-14T19:18:35.000Z'
const at = (iso: string) => Date.parse(iso)

type Ch = { id: string; number: number; title: string; updatedAt?: number; scenes: Array<{ id: string; title: string; text: string; writtenAt?: number }> }
const draft = (chapters: Ch[]): DraftBook => ({ version: 1, chapters: chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, timelineId: 't', scenes: c.scenes.map((s) => ({ id: s.id, title: s.title, text: s.text })) })) })
const built = (chapters: Ch[]): BuiltManuscript => ({
  totalWords: 0, totalScenes: 0, writtenScenes: 0,
  chapters: chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
    ...(c.updatedAt !== undefined ? { updatedAt: c.updatedAt } : {}),
    scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 1, written: true, status: 'draft' as const, ...(s.writtenAt !== undefined ? { writtenAt: s.writtenAt } : {}) })) })),
})

/** Each tracked change in the file: what it holds, as one line of text, and its date. */
function marks(bytes: Uint8Array) {
  const doc = new TextDecoder().decode(readStoredZip(bytes).get('word/document.xml'))
  return [...doc.matchAll(/<w:(ins|del) [^>]*w:date="([^"]*)"[^>]*>(.*?)<\/w:\1>/g)]
    .map((m) => [`${m[1] === 'ins' ? '+' : '-'}${m[3].replace(/<[^>]+>/g, '')}`, m[2]])
}

function exported(base: Ch[], now: Ch[], notes: Parameters<typeof markedPlan>[0]['notes'] = [], when = EXPORT) {
  const plan = markedPlan({ sentBack: { id: 'B' }, base: draft(base), scenes: now.flatMap((c) => c.scenes.map((s) => ({ eventId: s.id, text: s.text, chapterId: c.id }))), chapters: now, notes, author: 'Tamsin Hale', now: at(when) })
  const index = new Map(now.flatMap((c) => c.scenes).map((s, i) => [s.id, i]))
  return compileDocx(built(now), { forEditing: { draftId: 'D', worldId: 'W', sceneIndex: (id) => index.get(id), marked: plan.marked } })
}

describe('a change is dated when its scene was last written (T17.2, D-13)', () => {
  const base: Ch[] = [
    { id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: [A, B, C].join('\n\n') }] },
    { id: 'c2', number: 2, title: 'Low Water', scenes: [{ id: 'e3', title: 'Three', text: C }] },
  ]
  const now: Ch[] = [
    // Split, its first half edited; the second half new at the split.
    { id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [
      { id: 'e1', title: 'One', text: A.replace('back stair', 'front stair'), writtenAt: at('2026-11-13T08:01:02Z') },
      { id: 'e2', title: 'Two', text: [B, C].join('\n\n'), writtenAt: at('2026-11-13T09:30:00Z') },
    ] },
    // Renamed, and its scene added to.
    { id: 'c2', number: 2, title: 'High Water', updatedAt: at('2026-11-12T17:00:00Z'), scenes: [{ id: 'e3', title: 'Three', text: `${C} Now.`, writtenAt: at('2026-11-14T07:45:10Z') }] },
  ]

  it('each scene’s changes, the break before it, and a heading’s by its chapter', () => {
    expect(marks(exported(base, now))).toEqual([
      ['-back', '2026-11-13T08:01:02Z'],
      ['+front', '2026-11-13T08:01:02Z'],
      // The split's break: put in when the scene after it was made.
      ['+* * *', '2026-11-13T09:30:00Z'],
      ['-Ch. 2 — Low Water', '2026-11-12T17:00:00Z'],
      ['+Ch. 2 — High Water', '2026-11-12T17:00:00Z'],
      ['+ Now.', '2026-11-14T07:45:10Z'],
    ])
  })

  it('where nothing says when, the export’s, as before: a scene with no date, a heading with no chapter date and no scene’s', () => {
    const undated = now.map((c) => ({ ...c, updatedAt: undefined, scenes: c.scenes.map((s) => (s.id === 'e3' ? { ...s, writtenAt: undefined } : s)) }))
    expect(marks(exported(base, undated)).filter(([, d]) => d === EXPORT).map(([m]) => m)).toEqual(['-Ch. 2 — Low Water', '+Ch. 2 — High Water', '+ Now.'])
    // A heading with no chapter date takes its first scene's.
    const scened = now.map((c) => ({ ...c, updatedAt: undefined }))
    expect(marks(exported(base, scened)).filter(([m]) => m.includes('Water')).map(([, d]) => d)).toEqual(['2026-11-14T07:45:10Z', '2026-11-14T07:45:10Z'])
  })

  it('buildManuscript carries when each scene was written and each chapter changed', () => {
    const chapter = { id: 'c1', worldId: 'W', timelineId: 't', number: 1, title: 'C', synopsis: '', notes: '', wordGoal: null, createdAt: 1, updatedAt: 500 } as Chapter
    const event = { id: 'e1', worldId: 'W', chapterId: 'c1', title: 'S', sortOrder: 0, status: 'draft' } as WorldEvent
    const m = buildManuscript({ chapters: [chapter], events: [event, { ...event, id: 'e2', sortOrder: 1 }], sceneTextByEvent: new Map([['e1', { text: 'Words.', wordCount: 1, updatedAt: 700 }]]) })
    expect(m.chapters[0].updatedAt).toBe(500)
    expect(m.chapters[0].scenes.map((s) => s.writtenAt)).toEqual([700, undefined])
  })
})

describe('the app’s line, signed by the app and dated with its comment (T17.1, D-12)', () => {
  const base: Ch[] = [{ id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: [A, C].join('\n\n') }] }]
  const now: Ch[] = [{ id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: 'Nobody climbed anything.', writtenAt: at('2026-11-13T08:00:00Z') }] }]
  const note = {
    id: 'n1', worldId: 'W', eventId: 'e1', quote: 'the back stair', prefix: 'when she climbed ', suffix: ' of the Customs House.', body: 'Which stair?', kind: 'note' as const, status: 'open' as const,
    author: { kind: 'editor' as const, name: 'Ana Editor' }, createdAt: at('2026-11-10T11:12:13Z'), updatedAt: 0,
    replies: [{ id: 'r1', body: 'The back one.', author: { kind: 'me' as const }, createdAt: at('2026-11-11T09:00:00Z') }],
  }
  const comments = (when = EXPORT) => new TextDecoder().decode(readStoredZip(exported(base, now, [note] as never, when)).get('word/comments.xml'))
  const listed = (xml: string) => [...xml.matchAll(/<w:comment [^>]*w:author="([^"]*)" w:date="([^"]*)" w:initials="([^"]*)">(.*?)<\/w:comment>/g)].map((m) => [m[1], m[2], m[3], m[4].replace(/<[^>]+>/g, '')])

  it('under the editor’s comment, by Kathala, with that comment’s date; then the writer’s reply with its own', () => {
    expect(listed(comments())).toEqual([
      ['Ana Editor', '2026-11-10T11:12:13Z', 'AE', 'Which stair?'],
      [APP_SIGNER, '2026-11-10T11:12:13Z', 'K', 'On words since rewritten: “the back stair”'],
      ['Tamsin Hale', '2026-11-11T09:00:00Z', 'TH', 'The back one.'],
    ])
    expect(APP_SIGNER).toBe('Kathala')
  })

  it('the same in every export: nothing in it is the export’s', () => {
    expect(comments('2026-11-20T08:00:00.000Z')).toBe(comments())
    expect(comments()).not.toContain(EXPORT.replace(/\.\d{3}Z$/, ''))
  })
})
