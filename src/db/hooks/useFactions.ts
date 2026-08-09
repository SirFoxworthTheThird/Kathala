import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import { generateId } from '@/lib/id'
import type { ReadingGate } from '@/db/hooks/useReading'
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
  await journalCreate('faction', db.factions, faction)
  return faction
}

export async function updateFaction(id: string, data: Partial<Omit<Faction, 'id' | 'createdAt'>>) {
  await journalUpdate('faction', db.factions, id, { ...data, updatedAt: Date.now() })
}

export async function deleteFaction(id: string) {
  await journalDelete('faction', db.factions, id, async () => {
    await db.factionMemberships.where('factionId').equals(id).delete()
    await db.factionRelationships.where('factionAId').equals(id).delete()
    await db.factionRelationships.where('factionBId').equals(id).delete()
    await db.factions.delete(id)
  }, [db.factionMemberships, db.factionRelationships])
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
  await journalCreate('factionMembership', db.factionMemberships, membership)
  return membership
}

export async function updateFactionMembership(id: string, data: Partial<Omit<FactionMembership, 'id' | 'createdAt'>>) {
  await journalUpdate('factionMembership', db.factionMemberships, id, { ...data, updatedAt: Date.now() })
}

export async function deleteFactionMembership(id: string) {
  await journalDelete('factionMembership', db.factionMemberships, id, async () => {
    await db.factionMemberships.delete(id)
  })
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
  await journalCreate('factionRelationship', db.factionRelationships, rel)
  return rel
}

export async function updateFactionRelationship(id: string, data: Partial<Omit<FactionRelationship, 'id' | 'createdAt'>>) {
  await journalUpdate('factionRelationship', db.factionRelationships, id, { ...data, updatedAt: Date.now() })
}

export async function deleteFactionRelationship(id: string) {
  await journalDelete('factionRelationship', db.factionRelationships, id, async () => {
    await db.factionRelationships.delete(id)
  })
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

/**
 * Which factions the reader has met, by the rule search already used: a faction
 * is known once they have met somebody in it, and one with no members recorded
 * has no basis to be withheld on.
 *
 * Shared so the roster and the search palette cannot disagree — they did, and
 * the same faction could be hidden in search while listed on the Factions page
 * at the same cursor.
 */
export function useFactionReveal(worldId: string | null, gate: ReadingGate) {
  const memberships = useFactionMemberships(worldId)
  return useMemo(() => {
    if (!gate.active) return { has: () => true }
    const withMembers = new Set<string>()
    const revealed = new Set<string>()
    for (const m of memberships ?? []) {
      withMembers.add(m.factionId)
      if (gate.isRevealed(m.characterId) && gate.hasReached(m.startEventId)) revealed.add(m.factionId)
    }
    return { has: (id: string) => !withMembers.has(id) || revealed.has(id) }
  }, [memberships, gate])
}
