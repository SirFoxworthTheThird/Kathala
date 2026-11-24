import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import { mendTimelineRelationship } from '../timelineRelationshipShape'
import type { TimelineRelationship } from '@/types'

/** The Odyssey's relationship, as its file stores it. */
const ODYSSEY = {
  worldId: 'odyssey-world', createdAt: 1, updatedAt: 1, id: 'odyssey-timeline-rel-embedded',
  fromTimelineId: 'odyssey-timeline-present', toTimelineId: 'odyssey-timeline-wanderings', type: 'flashback',
  label: 'Odysseus recounts his wanderings at Scheria', fromEventId: 'odyssey-event-019', toEventId: 'odyssey-event-020',
} as unknown as TimelineRelationship

const WHOLE: TimelineRelationship = {
  id: 'r', worldId: 'w', sourceTimelineId: 'a', targetTimelineId: 'b', type: 'alternate',
  anchors: [{ kind: 'character', entityId: 'c' }], syncPoints: [], label: 'L', description: '', createdAt: 1, updatedAt: 1,
}

/** Every field the panel and the bar read, of the type it reads. */
function readable(r: TimelineRelationship) {
  expect(Array.isArray(r.anchors)).toBe(true)
  expect(Array.isArray(r.syncPoints)).toBe(true)
  expect(typeof r.sourceTimelineId).toBe('string')
  expect(typeof r.targetTimelineId).toBe('string')
  expect(['frame_narrative', 'historical_echo', 'embedded_fiction', 'alternate']).toContain(r.type)
  expect(typeof r.label).toBe('string')
  expect(typeof r.description).toBe('string')
}

describe('mendTimelineRelationship', () => {
  it('reads the Odyssey’s older shape as the one the app reads', () => {
    const r = mendTimelineRelationship(ODYSSEY)
    readable(r)
    expect(r).toMatchObject({
      sourceTimelineId: 'odyssey-timeline-present', targetTimelineId: 'odyssey-timeline-wanderings',
      type: 'frame_narrative', anchors: [], description: '',
      syncPoints: [{ outerEventId: 'odyssey-event-019', innerEventId: 'odyssey-event-020' }],
      label: 'Odysseus recounts his wanderings at Scheria',
    })
    expect(r).not.toHaveProperty('fromTimelineId')
    expect(r).not.toHaveProperty('fromEventId')
  })

  it('leaves a whole record as it is, the same object', () => {
    expect(mendTimelineRelationship(WHOLE)).toBe(WHOLE)
  })

  it('fills only what is missing, and keeps what is there', () => {
    const noLists = { ...WHOLE, anchors: undefined, syncPoints: undefined } as unknown as TimelineRelationship
    expect(mendTimelineRelationship(noLists)).toMatchObject({ anchors: [], syncPoints: [], sourceTimelineId: 'a', type: 'alternate', label: 'L' })
    const unknownType = { ...WHOLE, type: 'sideways' } as unknown as TimelineRelationship
    expect(mendTimelineRelationship(unknownType).type).toBe('alternate')
    // Two scenes are a sync point only for a frame: an echo's are not a telling.
    const echo = { ...ODYSSEY, type: 'echo' } as unknown as TimelineRelationship
    expect(mendTimelineRelationship(echo)).toMatchObject({ type: 'historical_echo', syncPoints: [] })
  })
})

/*
  The Library's six books with a timeline relationship, as staged: each reads
  whole once mended. Only where the Library is to hand (KATHALA_LIBRARY), since
  it is not part of this repository.
*/
const LIBRARY = process.env.KATHALA_LIBRARY ? path.join(process.env.KATHALA_LIBRARY, 'library') : ''
describe.skipIf(!LIBRARY || !existsSync(LIBRARY))('the staged Library books', () => {
  it('every timeline relationship reads whole once mended, and only the Odyssey needed it', () => {
    const needed: string[] = []
    let seen = 0
    for (const f of readdirSync(LIBRARY).filter((n) => n.endsWith('.pwk'))) {
      let data: { timelineRelationships?: TimelineRelationship[] }
      try { data = JSON.parse(readFileSync(path.join(LIBRARY, f), 'utf8')) } catch { continue }
      for (const rel of data.timelineRelationships ?? []) {
        seen++
        const mended = mendTimelineRelationship(rel)
        readable(mended)
        if (mended !== rel) needed.push(f)
      }
    }
    expect(seen).toBeGreaterThanOrEqual(6)
    expect(needed).toEqual(['the-odyssey.pwk'])
  })
})
