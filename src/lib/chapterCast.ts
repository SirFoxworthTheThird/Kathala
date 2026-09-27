/**
 * Who a chapter's Character States panel is about (CD-1).
 *
 * The panel used to be built from the snapshots that happened to exist, which
 * meant a scene with five named characters and nothing recorded about them
 * showed nothing at all — and the world's other thirty-six characters, each
 * marked *no snapshot*, became the panel's dominant content. The writer's
 * question is "who is here and what state are they in", so the answer starts
 * from the scene's own cast; everyone else is folded away.
 */

interface CastEvent {
  id: string
  involvedCharacterIds: string[]
}

interface StateRecord {
  eventId: string
  characterId: string
}

interface Named {
  id: string
}

/**
 * Cast members of one scene with no state recorded there — a gap worth showing
 * rather than a reason to leave them out. Returned in the order the scene
 * lists them, skipping ids that no longer name a character.
 */
export function castWithoutState<T extends Named>(
  event: CastEvent,
  snapshots: readonly StateRecord[],
  characters: readonly T[],
): T[] {
  const withState = new Set(
    snapshots.filter((s) => s.eventId === event.id).map((s) => s.characterId),
  )
  return event.involvedCharacterIds
    .filter((id) => !withState.has(id))
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is T => !!c)
}

/** Everyone the chapter touches at all: named in a scene, or with state in one. */
export function charactersInChapter(
  events: readonly CastEvent[],
  snapshots: readonly StateRecord[],
): Set<string> {
  return new Set<string>([
    ...snapshots.map((s) => s.characterId),
    ...events.flatMap((e) => e.involvedCharacterIds),
  ])
}

/** The rest of the world's cast — ordinary, so folded away by default. */
export function charactersNotInChapter<T extends Named>(
  characters: readonly T[],
  events: readonly CastEvent[],
  snapshots: readonly StateRecord[],
): T[] {
  const inChapter = charactersInChapter(events, snapshots)
  return characters.filter((c) => !inChapter.has(c.id))
}

/**
 * Whether the panel has anything at all to say. False is the empty state
 * (EV-2), which used to be a blank column with no explanation in it.
 *
 * **Counting the ids is not asking the question.** A cast id outlives the
 * character it names: `deleteCharacter` sweeps snapshots, movements,
 * memberships, goals and relationships, and leaves the id sitting in every
 * scene that had them — as a world import or a merge can too.
 * `castWithoutState` resolves those ids and drops the ones that answer to
 * nobody, so the panel's *contents* were right while the gate in front of it
 * counted raw ids and said there was something to show. Delete the only
 * character a chapter names and the panel went back to being the unexplained
 * blank column this function exists to prevent.
 *
 * So it asks the same question the contents do, of the same list.
 */
export function hasAnyCharacterState<T extends Named>(
  events: readonly CastEvent[],
  snapshots: readonly StateRecord[],
  characters: readonly T[],
): boolean {
  const real = new Set(characters.map((c) => c.id))
  return events.some(
    (e) => e.involvedCharacterIds.some((id) => real.has(id))
      || snapshots.some((s) => s.eventId === e.id && real.has(s.characterId)),
  )
}
