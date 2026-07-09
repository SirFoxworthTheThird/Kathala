import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import {
  createFaction, updateFaction, deleteFaction,
  createFactionMembership, updateFactionMembership, deleteFactionMembership,
  createFactionRelationship, updateFactionRelationship, deleteFactionRelationship,
  getActiveMemberships,
} from '@/db/hooks/useFactions'
import type { FactionMembership } from '@/types'

const W = 'world-factions'

function newFaction(name: string) {
  return createFaction({ worldId: W, name, description: '', color: '#f00', coverImageId: null, tags: [] })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => {
  await db.delete()
})

describe('factions CRUD', () => {
  it('creates a faction with generated id and timestamps', async () => {
    const f = await newFaction('The Watch')
    expect(f.id).toBeTruthy()
    expect(f.createdAt).toBeGreaterThan(0)
    const stored = await db.factions.get(f.id)
    expect(stored).toBeDefined()
    expect(stored!.name).toBe('The Watch')
    expect(stored!.worldId).toBe(W)
  })

  it('updates a faction and bumps updatedAt', async () => {
    const f = await newFaction('Old Name')
    await updateFaction(f.id, { name: 'New Name' })
    const stored = await db.factions.get(f.id)
    expect(stored!.name).toBe('New Name')
    expect(stored!.updatedAt).toBeGreaterThanOrEqual(f.updatedAt)
  })

  it('deleting a faction cascades to its memberships and relationships', async () => {
    const a = await newFaction('A')
    const b = await newFaction('B')
    await createFactionMembership({ worldId: W, factionId: a.id, characterId: 'c1', role: null, startEventId: null, endEventId: null, notes: '' })
    // A is on either side of two relationships.
    await createFactionRelationship({ worldId: W, factionAId: a.id, factionBId: b.id, stance: 'hostile', notes: '' })
    await createFactionRelationship({ worldId: W, factionAId: b.id, factionBId: a.id, stance: 'allied', notes: '' })

    await deleteFaction(a.id)

    expect(await db.factions.get(a.id)).toBeUndefined()
    expect(await db.factionMemberships.where('factionId').equals(a.id).count()).toBe(0)
    expect(await db.factionRelationships.where('worldId').equals(W).count()).toBe(0)
    // The other faction is untouched.
    expect(await db.factions.get(b.id)).toBeDefined()
  })
})

describe('faction memberships CRUD', () => {
  it('creates, updates, and deletes a membership', async () => {
    const f = await newFaction('Guild')
    const m = await createFactionMembership({
      worldId: W, factionId: f.id, characterId: 'char-1', role: 'Recruit',
      startEventId: null, endEventId: null, notes: '',
    })
    expect((await db.factionMemberships.get(m.id))!.role).toBe('Recruit')

    await updateFactionMembership(m.id, { role: 'Master' })
    expect((await db.factionMemberships.get(m.id))!.role).toBe('Master')

    await deleteFactionMembership(m.id)
    expect(await db.factionMemberships.get(m.id)).toBeUndefined()
  })
})

describe('faction relationships CRUD', () => {
  it('creates, updates, and deletes a relationship', async () => {
    const a = await newFaction('A')
    const b = await newFaction('B')
    const rel = await createFactionRelationship({ worldId: W, factionAId: a.id, factionBId: b.id, stance: 'neutral', notes: '' })
    expect((await db.factionRelationships.get(rel.id))!.stance).toBe('neutral')

    await updateFactionRelationship(rel.id, { stance: 'allied' })
    expect((await db.factionRelationships.get(rel.id))!.stance).toBe('allied')

    await deleteFactionRelationship(rel.id)
    expect(await db.factionRelationships.get(rel.id)).toBeUndefined()
  })
})

describe('getActiveMemberships', () => {
  const eventSortKeyById = new Map([['e1', 1], ['e2', 2], ['e3', 3]])
  function m(id: string, startEventId: string | null, endEventId: string | null): FactionMembership {
    return { id, worldId: W, factionId: 'f', characterId: 'c', role: null, startEventId, endEventId, notes: '', createdAt: 0, updatedAt: 0 }
  }

  it('includes memberships whose window contains the cursor (start inclusive, end exclusive)', () => {
    const ms = [m('bounded', 'e1', 'e3'), m('open', null, null)]
    expect(getActiveMemberships(ms, 2, eventSortKeyById).map((x) => x.id).sort()).toEqual(['bounded', 'open'])
    // At the end event the bounded one has lapsed (exclusive), open stays.
    expect(getActiveMemberships(ms, 3, eventSortKeyById).map((x) => x.id)).toEqual(['open'])
    // At the start event the bounded one is already active (inclusive).
    expect(getActiveMemberships(ms, 1, eventSortKeyById).map((x) => x.id).sort()).toEqual(['bounded', 'open'])
  })
})
