import { useMemo } from 'react'
import { useActiveEventId } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useKinRelationships } from '@/db/hooks/useKinship'
import { useBestRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useBestSnapshots } from '@/db/hooks/useSnapshots'
import { useStory } from '@/db/hooks/useStory'
import { familyAt, forReader, type FamilyAt, type PersonStatus } from '@/lib/family'
import type { Relationship } from '@/types'

/**
 * The family at the cursor (issue #702), as the one looking may see it.
 *
 * A writer sees everyone in it, the not-yet-born faded (D-2). A reader sees
 * only whom they have met, links they have reached, and no one not yet born
 * (D-6); after a reveal, Hyde's family is Jekyll's, as every other screen has it.
 */
export function useFamily(bookId: string | null | undefined): {
  family: FamilyAt
  /** Each person's state for a succession: hidden people are null. */
  status: PersonStatus
  /** Everyone the book shows, kin or not, by id, for names and pickers. */
  people: ReturnType<typeof useCharacters>
  /** The kinship relationships, as the one looking may see them. */
  relationships: Relationship[]
} {
  const gate = useGate()
  const cursor = useActiveEventId()
  const people = useCharacters(bookId ?? null)
  const raw = useKinRelationships(bookId)
  const story = useStory(bookId ?? null)
  const states = useBestSnapshots(bookId ?? null, cursor)
  const partnerStates = useBestRelationshipSnapshots(bookId ?? null, cursor)

  const relationships = useMemo((): Relationship[] => {
    if (!gate.active) return raw
    // Both ends met and the link reached; then each named as the reader knows them (Part 2b), the parent too.
    return raw
      .filter((r) => gate.linksRevealed([r.characterAId, r.characterBId]) && gate.hasReached(r.startEventId))
      .flatMap((r): Relationship[] => {
        const a = gate.identityOf(r.characterAId), b = gate.identityOf(r.characterBId)
        if (a === b) return []
        const kinship = r.kinship?.kind === 'parent' ? { ...r.kinship, parentId: gate.identityOf(r.kinship.parentId) } : r.kinship
        return [{ ...r, characterAId: a, characterBId: b, kinship }]
      })
  }, [raw, gate])

  return useMemo(() => {
    const here = cursor ? story.position(cursor) : null
    const reached = (eventId: string) => here === null || (story.position(eventId) !== -1 && story.position(eventId) <= here)
    const aliveById = new Map(states.map((s) => [gate.identityOf(s.characterId), s.isAlive]))
    const fallback = new Map(people.map((p) => [p.id, p.isAlive]))
    const alive = (id: string) => aliveById.get(id) ?? fallback.get(id) ?? true
    const byRel = new Map(partnerStates.map((s) => [s.relationshipId, s]))
    const whole = familyAt({
      people: people.map((p) => ({ id: p.id, name: p.name, offStage: p.offStage })),
      relationships,
      reached,
      alive,
      partnerState: (id) => byRel.get(id),
    })
    const family = gate.active ? forReader(whole, (id) => gate.isRevealed(id)) : whole
    // `people` is the cast as the one looking may see it: anyone else is hidden. Born or not is the whole family's word.
    const known = new Set(people.map((p) => p.id))
    const status: PersonStatus = (id) => {
      if (!known.has(id)) return null
      const p = whole.people.get(id)
      return p ? { born: p.born, alive: p.alive } : { born: true, alive: alive(id) }
    }
    return { family, status, people, relationships }
  }, [cursor, story, states, partnerStates, people, relationships, gate])
}
