import type { Character, CharacterSnapshot, LocationMarker } from '@/types'

export interface PlacedCharacter {
  character: Character
  /** The marker's name at this moment, or null when the character is nowhere. */
  locationName: string | null
}

export interface MapCast {
  /** Characters standing somewhere at this moment, by name. */
  placed: PlacedCharacter[]
  /** Everyone else, by name. */
  unplaced: PlacedCharacter[]
}

/**
 * Who is on stage, and who is merely in the cast (**MW-3**).
 *
 * The map sidebar listed all 45 characters at equal weight, each with its own
 * placement crosshair, while only a handful carried a location. The question
 * the screen exists to answer — *who is here now* — was a minority of the rows
 * and undistinguished from the rest.
 *
 * Splitting them is all that is needed: a writer scanning for the people in
 * this scene reads a short list instead of filtering 45 rows by eye, and the
 * rest stay one scroll away rather than behind a toggle, because placing
 * someone new is the other thing this list is for.
 *
 * Pure, so the ordering is unit-tested rather than driven through Leaflet.
 */
export function splitMapCast(
  characters: Character[],
  snapshots: CharacterSnapshot[],
  markers: LocationMarker[],
): MapCast {
  const markerName = new Map(markers.map((m) => [m.id, m.name]))
  const snapByChar = new Map(snapshots.map((s) => [s.characterId, s]))

  const placed: PlacedCharacter[] = []
  const unplaced: PlacedCharacter[] = []

  for (const character of characters) {
    const markerId = snapByChar.get(character.id)?.currentLocationMarkerId ?? null
    // A snapshot pointing at a marker that no longer exists is not a placement:
    // the row would read as placed and show nothing where the place should be.
    const locationName = markerId ? markerName.get(markerId) ?? null : null
    ;(locationName ? placed : unplaced).push({ character, locationName })
  }

  const byName = (a: PlacedCharacter, b: PlacedCharacter) =>
    a.character.name.localeCompare(b.character.name)
  placed.sort(byName)
  unplaced.sort(byName)
  return { placed, unplaced }
}

/**
 * The scene's cast who are not where the scene is set, by their records: the
 * people the map could place there in one go (**G-1**).
 *
 * Being in a scene's cast does not put anybody on the map — the map draws
 * recorded states, and a state is written only by the writer (CLAUDE.md, *the
 * time-cursor pattern*). The guide said otherwise, and a writer run planned a
 * book on the promise, then found all twelve characters "Not placed" at a
 * scene with three of them cast at a pinned inn, and recorded 187 states by
 * hand. So the map says who the scene puts there, and records it when asked.
 *
 * Somebody dead by their last record is left out: placing the dead is a
 * decision, not a tidy-up. `snapshots` are the records resolved at the scene.
 */
export function castNotAtSetting(
  cast: readonly string[],
  snapshots: readonly CharacterSnapshot[],
  placeId: string,
): string[] {
  const byChar = new Map(snapshots.map((s) => [s.characterId, s]))
  return cast.filter((id) => {
    const snap = byChar.get(id)
    return snap?.isAlive !== false && snap?.currentLocationMarkerId !== placeId
  })
}
