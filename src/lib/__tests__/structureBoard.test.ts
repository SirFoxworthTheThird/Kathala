import { describe, it, expect } from 'vitest'
import { buildBeatSheet, CONVENTIONAL_ACT_SHARE } from '@/lib/structureBoard'
import { beatTemplateById, BEAT_TEMPLATES } from '@/lib/storyBeats'
import type { WorldEvent, Chapter } from '@/types'

const threeAct = beatTemplateById('three-act')!

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, structureBeat: string | null): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], tags: [],
    threadIds: [], motifIds: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]

describe('BEAT_TEMPLATES', () => {
  it('offers three templates with unique beat ids', () => {
    expect(BEAT_TEMPLATES.map((t) => t.id)).toEqual(['three-act', 'save-the-cat', 'heros-journey'])
    const allIds = BEAT_TEMPLATES.flatMap((t) => t.beats.map((b) => b.id))
    expect(new Set(allIds).size).toBe(allIds.length) // no id collisions
  })
})

describe('buildBeatSheet', () => {
  it('maps tagged events to their beat slots and counts coverage', () => {
    const events = [
      event('e1', 'c1', 0, 'hook'),
      event('e2', 'c1', 1, 'inciting-incident'),
      event('e3', 'c3', 0, 'climax'),
      event('e4', 'c1', 2, null), // untagged
    ]
    const sheet = buildBeatSheet({ template: threeAct, events, chapters })
    expect(sheet.total).toBe(7)
    expect(sheet.filled).toBe(3)
    const byBeat = Object.fromEntries(sheet.slots.map((s) => [s.beat.id, s.event?.id ?? null]))
    expect(byBeat['hook']).toBe('e1')
    expect(byBeat['inciting-incident']).toBe('e2')
    expect(byBeat['climax']).toBe('e3')
    expect(byBeat['midpoint']).toBeNull() // gap
    // Chapter number surfaced for a filled slot.
    expect(sheet.slots.find((s) => s.beat.id === 'climax')!.chapterNumber).toBe(3)
  })

  it('flags a beat whose event falls out of narrative order', () => {
    // Climax (a late beat) tagged to an early event; midpoint to a later one.
    const events = [
      event('e1', 'c1', 0, 'hook'),
      event('e2', 'c1', 1, 'climax'),     // pos 1,000,001
      event('e3', 'c3', 0, 'midpoint'),   // pos 3,000,000 — after climax's event
    ]
    const sheet = buildBeatSheet({ template: threeAct, events, chapters })
    const climax = sheet.slots.find((s) => s.beat.id === 'climax')!
    const midpoint = sheet.slots.find((s) => s.beat.id === 'midpoint')!
    // Template order is midpoint (act2) before climax (act3). Midpoint's event
    // (c3) comes after climax's event (c1), so climax reads out of order.
    expect(midpoint.outOfOrder).toBe(false)
    expect(climax.outOfOrder).toBe(true)
  })

  it('picks the earliest event when several share a beat', () => {
    const events = [
      event('late', 'c3', 0, 'hook'),
      event('early', 'c1', 0, 'hook'),
    ]
    const sheet = buildBeatSheet({ template: threeAct, events, chapters })
    expect(sheet.slots.find((s) => s.beat.id === 'hook')!.event?.id).toBe('early')
  })

  it('is all-empty when no events are tagged', () => {
    const sheet = buildBeatSheet({ template: threeAct, events: [event('e', 'c1', 0, null)], chapters })
    expect(sheet.filled).toBe(0)
    expect(sheet.slots.every((s) => s.event === null && !s.outOfOrder)).toBe(true)
  })

  it('works with the larger Save the Cat template', () => {
    const stc = beatTemplateById('save-the-cat')!
    const events = [event('e1', 'c1', 0, 'stc-catalyst'), event('e2', 'c2', 0, 'stc-midpoint')]
    const sheet = buildBeatSheet({ template: stc, events, chapters })
    expect(sheet.total).toBe(15)
    expect(sheet.filled).toBe(2)
  })
})

describe('proportion', () => {
  // Twenty-two chapters, the shape the board was failing to show: a two-chapter
  // Act 1, a twelve-chapter Act 2, and a climax and resolution both in Ch. 22.
  const long = Array.from({ length: 22 }, (_, i) => chapter(`c${i + 1}`, i + 1))
  const longEvents = [
    event('hook', 'c1', 0, 'hook'),
    event('inc', 'c1', 1, 'inciting-incident'),
    event('pp1', 'c2', 0, 'plot-point-1'),
    event('mid', 'c3', 0, 'midpoint'),      // Act 2 opens at Ch. 3
    event('pp2', 'c14', 0, 'plot-point-2'),
    event('clx', 'c15', 0, 'climax'),       // Act 3 opens at Ch. 15
    event('res', 'c22', 0, 'resolution'),
  ]

  it('divides the chapters between the acts using the placed beats', () => {
    const { proportion } = buildBeatSheet({ template: threeAct, events: longEvents, chapters: long })
    expect(proportion.reason).toBe('ok')
    expect(proportion.chapterCount).toBe(22)
    expect(proportion.spans).toEqual([
      { act: 1, startChapter: 1, endChapter: 2, chapterCount: 2, share: 2 / 22 },
      { act: 2, startChapter: 3, endChapter: 14, chapterCount: 12, share: 12 / 22 },
      { act: 3, startChapter: 15, endChapter: 22, chapterCount: 8, share: 8 / 22 },
    ])
    // The shares add up to the whole book — no chapter counted twice or dropped.
    expect(proportion.spans!.reduce((n, s) => n + s.chapterCount, 0)).toBe(22)
  })

  it('places a beat by its chapter, so two beats in one chapter coincide', () => {
    const events = [
      ...longEvents.filter((e) => e.id !== 'res'),
      event('res', 'c15', 1, 'resolution'), // resolution moved alongside the climax
    ]
    const sheet = buildBeatSheet({ template: threeAct, events, chapters: long })
    const at = (id: string) => sheet.slots.find((s) => s.beat.id === id)!.narrativeFraction
    expect(at('climax')).toBe(at('resolution'))
    expect(at('hook')).toBeCloseTo(0.5 / 22, 10)
    expect(at('climax')).toBeCloseTo(14.5 / 22, 10)
    // Unplaced beats have no position at all rather than a default one.
    const sparse = buildBeatSheet({ template: threeAct, events: [], chapters: long })
    expect(sparse.slots.every((s) => s.narrativeFraction === null)).toBe(true)
  })

  it('measures by chapter rank, so gaps in chapter numbers do not stretch an act', () => {
    // Chapters numbered 1, 2, 50, 51 — four chapters, not fifty-one.
    const sparse = [chapter('a', 1), chapter('b', 2), chapter('c', 50), chapter('d', 51)]
    const events = [
      event('hook', 'a', 0, 'hook'),
      event('mid', 'b', 0, 'midpoint'),
      event('clx', 'c', 0, 'climax'),
    ]
    const { proportion } = buildBeatSheet({ template: threeAct, events, chapters: sparse })
    expect(proportion.chapterCount).toBe(4)
    expect(proportion.spans!.map((s) => s.chapterCount)).toEqual([1, 1, 2])
    expect(proportion.spans![2]).toMatchObject({ startChapter: 50, endChapter: 51 })

    // The climax is in the third of four chapters, so it sits five-eighths along
    // — not off the end of the track, which is where its chapter number puts it.
    const sheet = buildBeatSheet({ template: threeAct, events, chapters: sparse })
    expect(sheet.slots.find((s) => s.beat.id === 'climax')!.narrativeFraction).toBeCloseTo(2.5 / 4, 10)
  })

  it('reports an act with no chapters of its own rather than borrowing one', () => {
    // Act 1 and Act 2 both open in Ch. 1, so Act 1 owns nothing.
    const events = [
      event('hook', 'c1', 0, 'hook'),
      event('mid', 'c1', 1, 'midpoint'),
      event('clx', 'c2', 0, 'climax'),
    ]
    const { proportion } = buildBeatSheet({ template: threeAct, events, chapters })
    expect(proportion.spans![0]).toEqual({
      act: 1, startChapter: null, endChapter: null, chapterCount: 0, share: 0,
    })
    expect(proportion.spans![1]).toMatchObject({ act: 2, chapterCount: 1 })
  })

  it('declines to measure until each act has a beat placed', () => {
    const events = [event('hook', 'c1', 0, 'hook'), event('mid', 'c2', 0, 'midpoint')]
    const { proportion } = buildBeatSheet({ template: threeAct, events, chapters })
    expect(proportion.spans).toBeNull()
    expect(proportion.reason).toBe('unplaced')
  })

  it('declines to measure when Act 3 opens before Act 2', () => {
    const events = [
      event('hook', 'c1', 0, 'hook'),
      event('clx', 'c1', 1, 'climax'),   // Act 3 in Ch. 1
      event('mid', 'c3', 0, 'midpoint'), // Act 2 in Ch. 3
    ]
    const { proportion } = buildBeatSheet({ template: threeAct, events, chapters })
    expect(proportion.spans).toBeNull()
    expect(proportion.reason).toBe('out-of-order')
  })

  it('has no measurement and no positions when there are no chapters', () => {
    const sheet = buildBeatSheet({ template: threeAct, events: [], chapters: [] })
    expect(sheet.proportion).toEqual({ chapterCount: 0, spans: null, reason: 'no-chapters' })
    expect(sheet.slots.every((s) => s.narrativeFraction === null)).toBe(true)
  })

  it('states a conventional shape that adds up to a whole book', () => {
    expect(CONVENTIONAL_ACT_SHARE.reduce((a, b) => a + b, 0)).toBe(1)
  })
})
