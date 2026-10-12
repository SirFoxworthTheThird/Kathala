/**
 * How each relationship stands at a moment: every relationship begun by then,
 * with its last recorded state at or before it — or, where none has been
 * recorded, as it began.
 *
 * The chapter panel's "Relationship States — end of chapter" listed only the
 * recorded states, so a relationship that began and never changed was not
 * there: of six relationships in a writer's book by the end of chapter 5, it
 * showed three (writer run 7, W7-4). A relationship begins at its
 * `startEventId`, or before the story where it has none.
 */
export function relationshipsAtEnd<R extends { id: string; startEventId: string | null }, S extends { relationshipId: string }>(args: {
  relationships: readonly R[]
  /** The best state of each relationship at the moment: one at most each. */
  states: readonly S[]
  /** The moment, by its order in the book; null for none. */
  at: number | null
  /** An event's order in the book, comparable with `at`; null for an event it does not know. */
  order: (eventId: string) => number | null
}): Array<{ relationship: R; state: S | null }> {
  const { relationships, states, at, order } = args
  if (at === null) return []
  return relationships.flatMap((relationship) => {
    if (relationship.startEventId !== null) {
      const began = order(relationship.startEventId)
      if (began === null || began > at) return []
    }
    return [{ relationship, state: states.find((s) => s.relationshipId === relationship.id) ?? null }]
  })
}
