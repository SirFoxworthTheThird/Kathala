import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { journalCreate, journalUpdate, journalDelete } from './useOperations'
import type { Relationship, RelationshipStrength, RelationshipSentiment } from '@/types'
import { generateId } from '@/lib/id'

export function useRelationships(worldId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () => (worldId ? db.relationships.where('worldId').equals(worldId).toArray() : []),
    [worldId],
    []
  )
  // A relationship names both of its characters, and often what passes between
  // them. It waits for both to be met, and for the moment it begins — otherwise
  // a reader who has met three people is told the book holds sixty-one bonds,
  // which gives away the size of the cast if nothing else.
  return useMemo(
    () => all.filter((r) => gate.linksRevealed([r.characterAId, r.characterBId]) && gate.hasReached(r.startEventId)),
    [all, gate],
  )
}

/**
 * One character's relationships, held to the same gate as the world's.
 *
 * This was a raw query. `useRelationships` above it is gated and says why in
 * its own comment, which is most of how the omission survived: the file reads
 * as though relationships were handled. A blind reader run found the result on
 * a character page at chapter 7 of *The Count of Monte Cristo* — rows whose
 * counterpart was redacted to "Unknown", because the person had not been met,
 * sitting beside a description that named them.
 *
 * Gating here rather than at the three call sites — the Relationships tab, the
 * character page's tab counts, and the map's character panel — because a fourth
 * would otherwise start ungated, and because the counts and the rows have to
 * agree about what exists.
 */
export function useCharacterRelationships(characterId: string | null) {
  const gate = useGate()
  const all = useLiveQuery(
    () =>
      characterId
        ? db.relationships
            .filter((r) => r.characterAId === characterId || r.characterBId === characterId)
            .toArray()
        : [],
    [characterId],
    []
  )
  return useMemo(
    () => all.filter((r) => gate.linksRevealed([r.characterAId, r.characterBId]) && gate.hasReached(r.startEventId)),
    [all, gate],
  )
}

export async function createRelationship(data: {
  worldId: string
  characterAId: string
  characterBId: string
  label: string
  strength: RelationshipStrength
  sentiment: RelationshipSentiment
  description: string
  isBidirectional: boolean
  startEventId?: string | null
}): Promise<Relationship> {
  const now = Date.now()
  const rel: Relationship = {
    id: generateId(),
    startEventId: null,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('relationship', db.relationships, rel)
}

export async function updateRelationship(id: string, data: Partial<Omit<Relationship, 'id' | 'createdAt'>>) {
  await journalUpdate('relationship', db.relationships, id, { ...data, updatedAt: Date.now() })
}

export async function deleteRelationship(id: string) {
  await journalDelete('relationship', db.relationships, id, async () => {
    await db.relationships.delete(id)
    await db.relationshipSnapshots.where('relationshipId').equals(id).delete()
  }, [db.relationshipSnapshots])
}
