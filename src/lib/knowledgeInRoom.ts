import type { KnowledgeFact, KnowledgeReveal } from '@/types'

/**
 * The Writer's Brief's "Knowledge in the room": for each fact, who in the
 * room knows it by now.
 *
 * The room is the scene's own people — its cast and its point of view — and
 * only the living. It used to be everyone with a recorded state by the cursor,
 * so a writer run found Tobias, dead two chapters before and nowhere near the
 * scene, listed as knowing what was said in it (writer run 5, S4).
 */
export function knowledgeInRoom(args: {
  facts: readonly KnowledgeFact[]
  reveals: readonly KnowledgeReveal[]
  /** Who is in the room. */
  room: ReadonlySet<string>
  /** Whether a reveal at this scene has happened by the cursor. */
  knownAt: (eventId: string) => boolean
  nameOf: (characterId: string) => string | undefined
}): Array<{ fact: KnowledgeFact; knowers: string[] }> {
  const { facts, reveals, room, knownAt, nameOf } = args
  return facts
    .map((fact) => ({
      fact,
      knowers: [...new Set(reveals
        .filter((r) => r.factId === fact.id && room.has(r.characterId) && knownAt(r.eventId))
        .map((r) => r.characterId))]
        .flatMap((id) => nameOf(id) ?? []),
    }))
    .filter((x) => x.knowers.length > 0)
}

/** The room at a scene: its cast and point of view, less anybody dead by then. */
export function roomAt(
  scene: { involvedCharacterIds: readonly string[]; povCharacterId?: string | null },
  isDead: (characterId: string) => boolean,
): Set<string> {
  const room = new Set([...scene.involvedCharacterIds, ...(scene.povCharacterId ? [scene.povCharacterId] : [])])
  for (const id of room) if (isDead(id)) room.delete(id)
  return room
}
