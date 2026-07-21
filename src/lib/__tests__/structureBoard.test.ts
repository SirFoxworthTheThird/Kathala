import { describe, it, expect } from 'vitest'
import { buildBeatSheet } from '@/lib/structureBoard'
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
