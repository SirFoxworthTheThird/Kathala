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
 */
export function hasAnyCharacterState(
  events: readonly CastEvent[],
  snapshots: readonly StateRecord[],
): boolean {
  return events.some(
    (e) => e.involvedCharacterIds.length > 0 || snapshots.some((s) => s.eventId === e.id),
  )
}
