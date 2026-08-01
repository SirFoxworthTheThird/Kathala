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

export function useCharacterRelationships(characterId: string | null) {
  return useLiveQuery(
    () =>
      characterId
        ? db.relationships
            .filter((r) => r.characterAId === characterId || r.characterBId === characterId)
            .toArray()
        : [],
    [characterId],
    []
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
