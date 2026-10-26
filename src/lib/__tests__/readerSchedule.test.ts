import { describe, it, expect } from 'vitest'
import { knownBy, readerSchedule } from '@/lib/readerSchedule'
import type { Chapter, KnowledgeFact, Timeline, WorldEvent } from '@/types'
import coldChoir from '../../../e2e/fixtures/cold-choir.pwk?raw'

/**
 * Part E2: what the reader knows, chapter by chapter in reading order, and
 * which strand told them. Run 10's case: the Compact, three centuries on,
 * naming the Opener in chapter 11 when the Mercy was to reveal it in 19.
 */

const chapter = (id: string, number: number, timelineId: string) => ({ id, number, timelineId, title: `Ch ${number}` }) as Chapter
const scene = (id: string, chapterId: string, timelineId: string) => ({ id, chapterId, timelineId, sortOrder: 1 }) as WorldEvent
const fact = (id: string, title: string, spoilerWords: string[], readerLearnsAtEventId: string | null) =>
  ({ id, title, spoilerWords, tags: [], readerLearnsAtEventId }) as unknown as KnowledgeFact

const chapters = [chapter('m1', 1, 'mercy'), chapter('c11', 11, 'compact'), chapter('c12', 12, 'compact'), chapter('m19', 19, 'mercy')]
const events = [scene('e1', 'm1', 'mercy'), scene('e11', 'c11', 'compact'), scene('e12', 'c12', 'compact'), scene('e19', 'm19', 'mercy')]
const texts = new Map([
  ['e1', 'The Mercy left port.'],
  ['e11', 'In the archive, the Opener was only a name.'],
  ['e12', 'They spoke of the Opener again.'],
  ['e19', 'Ilse was the Opener.'],
])
const facts = [
  fact('opener', 'Ilse is the Opener', ['the Opener'], 'e19'),
  fact('port', 'The Mercy left port', ['port'], 'e1'),
  // No reveal scene: not on the reader's schedule.
  fact('loose', 'A loose end', ['archive'], null),
]

describe('the reader’s schedule', () => {
  const schedule = readerSchedule({ facts, events, chapters, sceneTextByEvent: texts })

  it('places each fact at its reveal, in reading order, and every earlier chapter that gives it away', () => {
    expect(schedule.chapters.map((c) => c.number)).toEqual([1, 11, 12, 19])
    expect(schedule.rows.map((r) => r.fact.id)).toEqual(['port', 'opener'])
    const opener = schedule.rows[1]
    expect(opener.reveal).toEqual({ eventId: 'e19', chapterId: 'm19', timelineId: 'mercy' })
    // Eight chapters early, by the Compact; and seven.
    expect(opener.leaks.map((l) => [l.chapterId, l.timelineId, l.chaptersEarly, l.term])).toEqual([
      ['c11', 'compact', 8, 'the Opener'],
      ['c12', 'compact', 7, 'the Opener'],
    ])
    // Told where it should be: nothing early.
    expect(schedule.rows[0].leaks).toEqual([])
  })

  it('says what the reader knows at a point, and the strand that told them first', () => {
    // Before anything gives it away: only what the first chapter tells.
    expect(knownBy(schedule, 'e1', events, chapters).map((k) => k.row.fact.id)).toEqual(['port'])
    // In chapter 12 the reader already knows the Opener — from the Compact, early.
    const at12 = knownBy(schedule, 'e12', events, chapters).find((k) => k.row.fact.id === 'opener')!
    expect([at12.told.chapterId, at12.told.timelineId, at12.early]).toEqual(['c11', 'compact', true])
    // Without the leak, it would not be known until its reveal.
    const clean = readerSchedule({ facts, events, chapters, sceneTextByEvent: new Map([...texts, ['e11', ''], ['e12', '']]) })
    expect(knownBy(clean, 'e12', events, chapters).map((k) => k.row.fact.id)).toEqual(['port'])
    expect(knownBy(clean, 'e19', events, chapters).find((k) => k.row.fact.id === 'opener')).toMatchObject({ early: false, told: { chapterId: 'm19' } })
  })
})

/*
  The plan's measure for Part E, on run 10's own book: with Part 3's spoiler
  word added to the fact, the schedule shows what the judges found — the
  Opener named in chapters 11 (the Compact) and 12 (the Quiet), eight and seven
  chapters before the Mercy reveals it in 19. The word is earlier still, in the
  Compact's chapter 2, which the judges did not single out; by the check's rule
  that is where a reader first meets it.
*/
describe('run 10’s book: the judges’ case', () => {
  const book = JSON.parse(coldChoir) as {
    events: WorldEvent[]; chapters: Chapter[]; timelines: Timeline[]; knowledgeFacts: KnowledgeFact[]
    sceneTexts: Array<{ eventId: string; text: string }>
  }
  const TITLE = 'Ilse Varga flew Deck Nine down to Ninefold'
  const facts = book.knowledgeFacts.map((f) => (f.title === TITLE ? { ...f, spoilerWords: ['Opener'] } : f))
  const texts = new Map(book.sceneTexts.map((t) => [t.eventId, t.text]))
  const schedule = readerSchedule({ facts, events: book.events, chapters: book.chapters, sceneTextByEvent: texts })
  const name = new Map(book.timelines.map((t) => [t.id, t.name]))
  const number = new Map(book.chapters.map((c) => [c.id, c.number]))

  it('shows the later strands giving it away in chapters 11 and 12, before the Mercy’s 19', () => {
    const row = schedule.rows.find((r) => r.fact.title === TITLE)!
    expect([number.get(row.reveal.chapterId), name.get(row.reveal.timelineId)]).toEqual([19, 'The Mercy'])
    const early = row.leaks.map((l) => [number.get(l.chapterId), name.get(l.timelineId), l.chaptersEarly])
    expect(early).toEqual(expect.arrayContaining([[11, 'The Compact', 8], [12, 'The Quiet', 7]]))
    // Every one of them in another strand than the reveal's.
    expect(row.leaks.every((l) => l.timelineId !== row.reveal.timelineId)).toBe(true)
    // Without the word, nothing to see: the schedule is the check's, not a guess.
    const bare = readerSchedule({ facts: book.knowledgeFacts, events: book.events, chapters: book.chapters, sceneTextByEvent: texts })
    expect(bare.rows.find((r) => r.fact.title === TITLE)!.leaks).toEqual([])
  })

  it('has a reader in chapter 12 knowing it already, from the Compact’s chapter 2', () => {
    const inTwelve = book.events.find((e) => number.get(e.chapterId) === 12)!
    const known = knownBy(schedule, inTwelve.id, book.events, book.chapters).find((k) => k.row.fact.title === TITLE)!
    expect([known.early, number.get(known.told.chapterId), name.get(known.told.timelineId)]).toEqual([true, 2, 'The Compact'])
  })
})
