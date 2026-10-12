import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createRelationship, recordRelationshipChanges } from '@/db/hooks/useRelationships'
import { upsertRelationshipSnapshot } from '@/db/hooks/useRelationshipSnapshots'
import { sceneRelations } from '@/lib/sceneHeader'

/**
 * The Relationships line in a scene's header (docs/records/scene-header-block-plan.md,
 * part 5): relationships it makes, states it records, and states it takes back.
 */

const now = Date.now()
const none = { create: [], relabel: [], state: [], unstate: [] }
let rel = ''

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (const [id, sortOrder] of [['e1', 1], ['e2', 2], ['e3', 3]] as const) {
    await db.events.add({
      id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }
  rel = (await createRelationship({
    worldId: 'w', characterAId: 'sab', characterBId: 'idris', label: 'Partners',
    strength: 'strong', sentiment: 'positive', description: 'Ten years on the river.', isBidirectional: true, startEventId: null,
  })).id
})
afterAll(async () => { await db.delete() })

const drawn = async (eventId: string) => sceneRelations(eventId, await db.relationships.toArray(), await db.relationshipSnapshots.toArray())

describe('the Relationships line, written', () => {
  it('two people with none get one, starting here and drawn here only', async () => {
    await recordRelationshipChanges('w', 'e2', { ...none, create: [{ characterAId: 'pell', characterBId: 'sab', label: 'Debt' }] })
    const made = (await db.relationships.toArray()).find((r) => r.characterAId === 'pell')
    expect(made).toMatchObject({ characterBId: 'sab', label: 'Debt', startEventId: 'e2', isBidirectional: true })
    expect(await drawn('e2')).toEqual([{ relationshipId: made!.id, label: 'Debt', ended: false, startsHere: true }])
    expect(await drawn('e3')).toEqual([])
  })

  it('a state here carries strength, sentiment and description from the state before it', async () => {
    await upsertRelationshipSnapshot({ worldId: 'w', relationshipId: rel, eventId: 'e1', label: 'Partners', strength: 'bond', sentiment: 'complex', description: 'Since the fire.', isActive: true })
    await recordRelationshipChanges('w', 'e2', { ...none, state: [{ relationshipId: rel, label: 'Estranged', isActive: true }] })
    expect(await db.relationshipSnapshots.where('[relationshipId+eventId]').equals([rel, 'e2']).first())
      .toMatchObject({ label: 'Estranged', strength: 'bond', sentiment: 'complex', description: 'Since the fire.', isActive: true })
    await recordRelationshipChanges('w', 'e3', { ...none, state: [{ relationshipId: rel, label: '', isActive: false }] })
    // S-3: `:ended` says it is over, not what it was; the state keeps the label it ended as.
    expect(await db.relationshipSnapshots.where('[relationshipId+eventId]').equals([rel, 'e3']).first())
      .toMatchObject({ label: 'Estranged', isActive: false })
    expect(await drawn('e3')).toEqual([{ relationshipId: rel, label: 'Estranged', ended: true, startsHere: false }])
  })

  it('an ending with no state before it keeps the relationship’s own label', async () => {
    await recordRelationshipChanges('w', 'e2', { ...none, state: [{ relationshipId: rel, label: '', isActive: false }] })
    expect(await db.relationshipSnapshots.where('[relationshipId+eventId]').equals([rel, 'e2']).first())
      .toMatchObject({ label: 'Partners', isActive: false })
  })

  it('and from the relationship itself when there is no state before it', async () => {
    await recordRelationshipChanges('w', 'e2', { ...none, state: [{ relationshipId: rel, label: 'Estranged', isActive: true }] })
    expect(await db.relationshipSnapshots.where('[relationshipId+eventId]').equals([rel, 'e2']).first())
      .toMatchObject({ label: 'Estranged', strength: 'strong', sentiment: 'positive', description: 'Ten years on the river.' })
  })

  it('a state taken back is gone from this scene only; a relabel is the relationship’s own', async () => {
    await recordRelationshipChanges('w', 'e2', { ...none, state: [{ relationshipId: rel, label: 'Estranged', isActive: true }] })
    await recordRelationshipChanges('w', 'e3', { ...none, state: [{ relationshipId: rel, label: 'Reconciled', isActive: true }] })
    await recordRelationshipChanges('w', 'e2', { ...none, unstate: [rel], relabel: [{ relationshipId: rel, label: 'Old partners' }] })
    expect((await db.relationshipSnapshots.toArray()).map((s) => s.eventId)).toEqual(['e3'])
    expect(await db.relationships.get(rel)).toMatchObject({ label: 'Old partners' })
  })

  it('is one act, for undo', async () => {
    await recordRelationshipChanges('w', 'e2', { ...none, create: [{ characterAId: 'pell', characterBId: 'sab', label: 'Debt' }], state: [{ relationshipId: rel, label: 'Estranged', isActive: true }] })
    const ops = (await db.operations.orderBy('seq').toArray()).filter((o) => o.groupLabel === 'Relationships at this scene')
    expect(ops).toHaveLength(2)
    expect(new Set(ops.map((o) => o.groupId)).size).toBe(1)
  })
})
