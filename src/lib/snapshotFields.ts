/**
 * Which record a detail panel's text fields are currently showing.
 *
 * A panel that holds a record's prose in local state — so that typing does not
 * fight the cursor — has to know when to re-read it. The identity is not just
 * the thing the writer chose, character and moment, because the record itself
 * arrives from a live query a tick later, and re-reading on the choice alone
 * means reading the *outgoing* record. It is that choice **and** the record
 * actually in hand.
 *
 * All three parts earn their place:
 *
 * - without the record's **id**, a cursor step re-syncs from the previous
 *   scene's record and never runs again once the right one arrives. That was
 *   **W-1**: the field sat exactly one edit behind, and since the textarea
 *   saves on blur, the next blur wrote the previous scene's note into the new
 *   scene.
 * - without the record's **`updatedAt`**, the same bug survives in the case
 *   that actually produces it. Typing and then clicking straight on *Next
 *   moment* makes the blur and the step one gesture: the save and the step
 *   race, and when the save lands the panel is inheriting that very record at
 *   the new scene — *same id, new contents*. A key made of ids alone does not
 *   move, so the stale text stays put. This was written without it, and the
 *   spec that reproduces the gesture failed on the fix's own build.
 * - without the **character and moment**, two scenes that inherit the same
 *   record would never re-sync between them, so an unsaved draft would follow
 *   the writer to a scene it was not written for.
 *
 * The cost of `updatedAt` is that a save re-syncs the field — which is what the
 * panel's original "not on every save" note was avoiding. It is affordable
 * because the value it re-syncs *to* is the one just written: the only text
 * that can be lost is typing done in the milliseconds between a blur and its
 * write landing, and that is a far smaller thing than filing a note under the
 * wrong scene.
 *
 * An absent record is a state of its own — an empty field — and must not
 * collide with a present one, which is why the parts are joined rather than
 * counted or summed.
 */
export function snapshotFieldSyncKey(
  characterId: string,
  activeEventId: string | null,
  snapshot: { id: string; updatedAt?: number } | null | undefined,
): string {
  return `${characterId} ${activeEventId ?? ''} ${snapshot?.id ?? ''} ${snapshot?.updatedAt ?? ''}`
}
