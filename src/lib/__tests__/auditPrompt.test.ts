import { describe, it, expect } from 'vitest'
import { auditPrompt, auditBookFrom } from '@/lib/auditPrompt'
import type { WorldCalendar } from '@/types'

const calendar: WorldCalendar = { startYear: 300, yearSuffix: 'AL', months: [{ name: 'Firstwatch', days: 30 }, { name: 'Longdark', days: 30 }] }

const book = (timelines = [
  { id: 'tA', name: 'The Mercy', position: 0, createdAt: 0 },
  { id: 'tB', name: 'The Compact', position: 1, createdAt: 0 },
]) => auditBookFrom({
  world: { name: 'The Cold Choir', calendar },
  // Out of order, as the store may hold them.
  chapters: [
    { id: 'c2', number: 2, title: 'The Hall of Muster', timelineId: 'tB' },
    { id: 'c1', number: 1, title: 'Deceleration', timelineId: 'tA' },
  ],
  events: [
    { id: 'e2b', chapterId: 'c2', sortOrder: 2, title: 'The Roll' },
    { id: 'e2a', chapterId: 'c2', sortOrder: 1, title: 'The Hall' },
    { id: 'e1', chapterId: 'c1', sortOrder: 1, title: 'The Cold Rows' },
  ],
  sceneTexts: [
    { eventId: 'e1', text: 'The cold rows did not sing.' },
    { eventId: 'e2a', text: 'She found the dots on the fourth night.' },
    { eventId: 'e2b', text: 'Row and berth.' },
  ],
  timelines,
  facts: [
    { title: 'Ilse flew Deck Nine down', readerLearnsAtEventId: 'e2b' },
    { title: 'Not scheduled', readerLearnsAtEventId: null },
  ],
  characters: [{ name: 'Neve Castellan', birthDate: { year: 283, month: 1, day: 2 } }, { name: 'Hal Oduya' }],
  dayOf: (id) => ({ e1: 0, e2a: 40, e2b: 45 } as Record<string, number>)[id] ?? null,
})

describe('auditBookFrom', () => {
  it('gives the chapters in the book’s order, their scenes in order, each chapter’s era and dates', () => {
    const b = book()
    expect(b.title).toBe('The Cold Choir')
    expect(b.chapters.map((c) => [c.number, c.era, c.when, c.scenes.map((s) => s.title)])).toEqual([
      [1, 'The Mercy', '1 Firstwatch, 300 AL', ['The Cold Rows']],
      [2, 'The Compact', '11 Longdark, 300 AL – 16 Longdark, 300 AL', ['The Hall', 'The Roll']],
    ])
  })

  it('names no era in a book of one timeline', () => {
    expect(book([{ id: 'tA', name: 'Main', position: 0, createdAt: 0 }]).chapters.map((c) => c.era)).toEqual([null, null])
  })

  it('schedules each fact the reader learns at a scene by its chapter, and dates births on the calendar', () => {
    const b = book()
    expect(b.facts).toEqual([{ title: 'Ilse flew Deck Nine down', toldInChapter: 2 }])
    expect(b.births).toEqual([{ name: 'Neve Castellan', born: '2 Longdark, 283 AL' }])
  })
})

describe('auditPrompt', () => {
  const prompt = auditPrompt(book())

  it('holds the whole book, chapter by chapter, with era and date, and every scene’s prose', () => {
    expect(prompt).toContain('# Chapter 1: Deceleration · era: The Mercy · date: 1 Firstwatch, 300 AL')
    expect(prompt).toContain('## The Cold Rows\n\nThe cold rows did not sing.')
    expect(prompt.indexOf('The cold rows did not sing.')).toBeLessThan(prompt.indexOf('She found the dots'))
    expect(prompt).toContain('Row and berth.')
  })

  it('and the fact schedule and birth dates, which the prose does not say', () => {
    expect(prompt).toContain('- "Ilse flew Deck Nine down" — the reader learns it in chapter 2')
    expect(prompt).toContain('- Neve Castellan: born 2 Longdark, 283 AL')
  })

  it('asks for exact quotes on each side, in JSON, by the experiment’s rules', () => {
    expect(prompt).toContain('at least two quotes, copied character for character')
    expect(prompt).toContain("Do not count it: a character's estimate, rounding, rhetoric or belief")
    expect(prompt).toContain('"findings"')
  })
})
