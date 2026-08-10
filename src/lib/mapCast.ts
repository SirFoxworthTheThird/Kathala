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
