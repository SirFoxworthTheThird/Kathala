import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertRelationshipSnapshot } from '@/db/hooks/useRelationshipSnapshots'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function setup() {
  const tl = await createTimeline({ worldId: 'w', name: 'T', description: '', color: '#000' })
  const ch = await createChapter({ worldId: 'w', timelineId: tl.id, number: 1, title: 'Ch 1', synopsis: '' })
  const ev1 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev1', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  const ev2 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev2', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
  })
  const ev3 = await createEvent({
    worldId: 'w', timelineId: tl.id, chapterId: ch.id,
    title: 'Ev3', description: '', locationMarkerId: null,
    involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 2,
  })
  return { ev1, ev2, ev3 }
}

const BASE = {
  worldId: 'w',
  relationshipId: 'rel-1',
  label: 'Friends',
  strength: 'moderate' as const,
  sentiment: 'positive' as const,
  description: '',
  isActive: true,
}

describe('upsertRelationshipSnapshot — deduplication', () => {
  it('skips write when all fields equal the prior snapshot', async () => {
    const { ev1, ev2 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id })
    const result = await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id })

    expect(await db.relationshipSnapshots.count()).toBe(1)
    expect(result.eventId).toBe(ev1.id)
  })

  it('writes new record when sentiment changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, sentiment: 'positive' })
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id, sentiment: 'negative' })

    expect(await db.relationshipSnapshots.count()).toBe(2)
  })

  it('writes new record when strength changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, strength: 'moderate' })
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id, strength: 'bond' })

    expect(await db.relationshipSnapshots.count()).toBe(2)
  })

  it('writes new record when label changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, label: 'Friends' })
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id, label: 'Rivals' })

    expect(await db.relationshipSnapshots.count()).toBe(2)
  })

  it('writes new record when isActive changes', async () => {
    const { ev1, ev2 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, isActive: true })
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id, isActive: false })

    expect(await db.relationshipSnapshots.count()).toBe(2)
  })

  it('updates in-place when same (relationshipId + eventId) is upserted again', async () => {
    const { ev1 } = await setup()

    const first = await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, label: 'Initial' })
    await new Promise(r => setTimeout(r, 5))
    const second = await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, label: 'Updated' })

    expect(second.id).toBe(first.id)
    expect(second.label).toBe('Updated')
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(await db.relationshipSnapshots.count()).toBe(1)
  })

  it('only deduplicates against the most recent prior, not an older one', async () => {
    const { ev1, ev2, ev3 } = await setup()

    await upsertRelationshipSnapshot({ ...BASE, eventId: ev1.id, sentiment: 'positive' })
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev2.id, sentiment: 'negative' })
    // ev3 reverts to positive — same as ev1 but different from ev2 → should write
    await upsertRelationshipSnapshot({ ...BASE, eventId: ev3.id, sentiment: 'positive' })

    expect(await db.relationshipSnapshots.count()).toBe(3)
  })
})
