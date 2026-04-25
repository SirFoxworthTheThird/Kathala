import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { generateId } from '@/lib/id'
import type { Faction, FactionMembership, FactionRelationship } from '@/types'

// ── Factions ──────────────────────────────────────────────────────────────────

export function useFactions(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.factions.where('worldId').equals(worldId).sortBy('createdAt') : [],
    [worldId],
    [] as Faction[]
  )
}

export function useFaction(factionId: string | null) {
  return useLiveQuery(
    () => factionId ? db.factions.get(factionId) : undefined,
    [factionId]
  )
}

export async function createFaction(data: Omit<Faction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Faction> {
  const now = Date.now()
  const faction: Faction = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.factions.add(faction)
  return faction
}

export async function updateFaction(id: string, data: Partial<Omit<Faction, 'id' | 'createdAt'>>) {
  await db.factions.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteFaction(id: string) {
  await db.transaction('rw', [db.factions, db.factionMemberships, db.factionRelationships], async () => {
    await db.factionMemberships.where('factionId').equals(id).delete()
    await db.factionRelationships.where('factionAId').equals(id).delete()
    await db.factionRelationships.where('factionBId').equals(id).delete()
    await db.factions.delete(id)
  })
}

// ── Faction Memberships ───────────────────────────────────────────────────────

export function useFactionMemberships(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.factionMemberships.where('worldId').equals(worldId).toArray() : [],
    [worldId],
    [] as FactionMembership[]
  )
}

export function useMembershipsForFaction(factionId: string | null) {
  return useLiveQuery(
    () => factionId ? db.factionMemberships.where('factionId').equals(factionId).toArray() : [],
    [factionId],
    [] as FactionMembership[]
  )
}

export function useMembershipsForCharacter(characterId: string | null) {
  return useLiveQuery(
    () => characterId ? db.factionMemberships.where('characterId').equals(characterId).toArray() : [],
    [characterId],
    [] as FactionMembership[]
  )
}

export async function createFactionMembership(
  data: Omit<FactionMembership, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FactionMembership> {
  const now = Date.now()
  const membership: FactionMembership = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.factionMemberships.add(membership)
  return membership
}

export async function updateFactionMembership(id: string, data: Partial<Omit<FactionMembership, 'id' | 'createdAt'>>) {
  await db.factionMemberships.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteFactionMembership(id: string) {
  await db.factionMemberships.delete(id)
}

// ── Faction Relationships ─────────────────────────────────────────────────────

export function useFactionRelationships(worldId: string | null) {
  return useLiveQuery(
    () => worldId ? db.factionRelationships.where('worldId').equals(worldId).toArray() : [],
    [worldId],
    [] as FactionRelationship[]
  )
}

export async function createFactionRelationship(
  data: Omit<FactionRelationship, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FactionRelationship> {
  const now = Date.now()
  const rel: FactionRelationship = { ...data, id: generateId(), createdAt: now, updatedAt: now }
  await db.factionRelationships.add(rel)
  return rel
}

export async function updateFactionRelationship(id: string, data: Partial<Omit<FactionRelationship, 'id' | 'createdAt'>>) {
  await db.factionRelationships.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteFactionRelationship(id: string) {
  await db.factionRelationships.delete(id)
}

// ── Active membership helper ──────────────────────────────────────────────────

/** Returns memberships active at the given event's sortKey (inclusive start, exclusive end). */
export function getActiveMemberships(
  memberships: FactionMembership[],
  activeEventSortKey: number,
  eventSortKeyById: Map<string, number>
): FactionMembership[] {
  return memberships.filter((m) => {
    const start = m.startEventId ? (eventSortKeyById.get(m.startEventId) ?? 0) : 0
    const end = m.endEventId ? (eventSortKeyById.get(m.endEventId) ?? Infinity) : Infinity
    return start <= activeEventSortKey && activeEventSortKey < end
  })
}
