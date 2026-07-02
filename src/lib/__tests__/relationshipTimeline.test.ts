import { describe, it, expect } from 'vitest'
import { computeRelationshipTimeline } from '@/lib/relationshipTimeline'
import type { Relationship, RelationshipSnapshot, WorldEvent, Chapter } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, title = id): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder,
    travelDays: null, inWorldTime: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function rel(startEventId: string | null): Relationship {
  return {
    id: 'r1', worldId: 'w', characterAId: 'a', characterBId: 'b',
    label: 'allies', strength: 'moderate', sentiment: 'positive', description: '',
    isBidirectional: true, startEventId, createdAt: 0, updatedAt: 0,
  }
}
function snap(eventId: string, label: string, sentiment: RelationshipSnapshot['sentiment'], isActive = true): RelationshipSnapshot {
  return {
    id: `s-${eventId}`, worldId: 'w', relationshipId: 'r1', eventId, label,
    strength: 'moderate', sentiment, description: '', isActive, createdAt: 0, updatedAt: 0,
  }
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const events = [event('e1', 'c1', 0), event('e2', 'c2', 0), event('e3', 'c3', 0)]

describe('computeRelationshipTimeline', () => {
  it('leads with the base state then snapshots in narrative order', () => {
    const points = computeRelationshipTimeline({
      relationship: rel(null),
      snapshots: [snap('e3', 'reconciled', 'positive'), snap('e2', 'rivals', 'negative')],
      events, chapters,
    })
    expect(points.map((p) => p.label)).toEqual(['allies', 'rivals', 'reconciled'])
    expect(points[0].isBase).toBe(true)
    expect(points[1].chapterNumber).toBe(2)
    expect(points[2].sentiment).toBe('positive')
  })

  it('drops the base point when the first snapshot is already at the start event', () => {
    const points = computeRelationshipTimeline({
      relationship: rel('e1'),
      snapshots: [snap('e1', 'wary', 'complex')],
      events, chapters,
    })
    expect(points).toHaveLength(1)
    expect(points[0].isBase).toBe(false)
    expect(points[0].label).toBe('wary')
  })

  it('carries the isActive flag (an ended relationship)', () => {
    const points = computeRelationshipTimeline({
      relationship: rel(null),
      snapshots: [snap('e2', 'estranged', 'negative', false)],
      events, chapters,
    })
    expect(points.at(-1)?.isActive).toBe(false)
  })
})
