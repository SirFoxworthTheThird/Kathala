import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useGate } from './ReadingGateContext'
import { resolvePairs } from '@/lib/characterIdentity'
import { journalCreate, journalUpdate, journalDelete, journalGroup } from './useOperations'
import type { Relationship, RelationshipStrength, RelationshipSentiment } from '@/types'
import { generateId } from '@/lib/id'
import { computeSortKey } from '@/lib/sortKey'
import { upsertRelationshipSnapshot, deleteRelationshipSnapshot } from './useRelationshipSnapshots'
import type { RelationPlan } from '@/lib/sceneHeader'

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
  // For a reader past a reveal, an edge to Hyde is an edge to Jekyll, and one between them is not drawn (Part 2b).
  return useMemo(
    () => resolvePairs(all.filter((r) => gate.linksRevealed([r.characterAId, r.characterBId]) && gate.hasReached(r.startEventId)), gate.identityOf),
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
  // For a reader, the whole person's: Jekyll's tab has Hyde's bonds too, resolved to Jekyll (Part 2b).
  const selves = characterId ? gate.selves(characterId) : []
  const key = selves.join(',')
  const all = useLiveQuery(
    () =>
      selves.length > 0
        ? db.relationships
            .filter((r) => selves.includes(r.characterAId) || selves.includes(r.characterBId))
            .toArray()
        : [],
    [key],
    []
  )
  return useMemo(
    () => resolvePairs(all.filter((r) => gate.linksRevealed([r.characterAId, r.characterBId]) && gate.hasReached(r.startEventId)), gate.identityOf),
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

/**
 * Write what a header's Relationships line asks for (`planHeader`), as one
 * undo step. A relationship made here starts here, both ways and of moderate
 * strength, with nothing said of how they feel: the label is what the line
 * says, and the rest is the relationship's page to set. A state recorded here
 * carries its strength, sentiment and description from the state before it.
 */
export async function recordRelationshipChanges(worldId: string, eventId: string, plan: RelationPlan): Promise<void> {
  if (!plan.create.length && !plan.relabel.length && !plan.state.length && !plan.unstate.length) return
  await journalGroup(async () => {
    for (const relationshipId of plan.unstate) {
      const here = await db.relationshipSnapshots.where('[relationshipId+eventId]').equals([relationshipId, eventId]).first()
      if (here) await deleteRelationshipSnapshot(here.id)
    }
    for (const { characterAId, characterBId, label } of plan.create) {
      await createRelationship({
        worldId, characterAId, characterBId, label,
        strength: 'moderate', sentiment: 'neutral', description: '', isBidirectional: true, startEventId: eventId,
      })
    }
    for (const { relationshipId, label } of plan.relabel) await updateRelationship(relationshipId, { label })
    if (plan.state.length) {
      const sortKey = await computeSortKey(eventId)
      for (const { relationshipId, label, isActive } of plan.state) {
        const rel = await db.relationships.get(relationshipId)
        if (!rel) continue
        const before = (await db.relationshipSnapshots.where('relationshipId').equals(relationshipId).toArray())
          .filter((s) => (s.sortKey ?? 0) < sortKey)
          .sort((a, b) => (b.sortKey ?? 0) - (a.sortKey ?? 0))[0]
        await upsertRelationshipSnapshot({
          worldId,
          relationshipId,
          eventId,
          label,
          strength: before?.strength ?? rel.strength,
          sentiment: before?.sentiment ?? rel.sentiment,
          description: before?.description ?? rel.description,
          isActive,
        })
      }
    }
  }, { label: 'Relationships at this scene' })
}
