/**
 * Telling apart places that share a name.
 *
 * Two places may rightly be called the same: "The Kitchen" in two houses, each
 * a sub-map of its own. So a name alone does not always say which place it
 * means, and the header used to take whichever came first — writer run 8 found
 * `#The Beacon` resolving to a stray second Beacon, silently.
 *
 * A place whose name is shared is written with its map's name after it in
 * brackets — `The Kitchen (Scaur House)` — wherever that tells it apart. Two
 * places of one name on the *same* map cannot be told apart that way; that is
 * almost always a mistake, and `sameNameOnMap` is what the screens warn with.
 */

export interface NamedPlace { id: string; name: string; mapLayerId?: string | null }
export interface NamedMap { id: string; name: string }

/** What a place with no map is said to be on, in brackets. */
export const NO_MAP = 'no map'

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function mapName(place: NamedPlace, maps: readonly NamedMap[]): string {
  return maps.find((m) => m.id === place.mapLayerId)?.name ?? NO_MAP
}

/**
 * The name a place is written by: its own, or with its map's in brackets when
 * another place shares the name and the map tells them apart.
 */
export function placeLabel(place: NamedPlace, places: readonly NamedPlace[], maps: readonly NamedMap[]): string {
  const namesakes = places.filter((p) => p.id !== place.id && same(p.name, place.name))
  if (namesakes.length === 0) return place.name
  const map = mapName(place, maps)
  // On the same map as one of them: the bracket would not tell them apart.
  if (namesakes.some((p) => same(mapName(p, maps), map))) return place.name
  return `${place.name} (${map})`
}

/** `The Kitchen (Scaur House)`, split: the name and the map. */
const QUALIFIED = /^(.*\S)\s*\(([^()]*\S[^()]*)\)$/

/**
 * The places a written name answers to. A place called exactly that comes
 * first — a name may have brackets of its own — and otherwise `Name (Map)`
 * answers to the places of that name on that map.
 */
export function placesNamed(text: string, places: readonly NamedPlace[], maps: readonly NamedMap[]): NamedPlace[] {
  const exact = places.filter((p) => same(p.name, text))
  if (exact.length > 0) return exact
  const m = QUALIFIED.exec(text.trim())
  if (!m) return []
  return places.filter((p) => same(p.name, m[1]) && same(mapName(p, maps), m[2]))
}

/** What a written name resolves to: one place, none, or several it cannot choose between. */
export type PlaceMatch =
  | { kind: 'one'; place: NamedPlace }
  | { kind: 'none' }
  | { kind: 'several'; places: NamedPlace[] }

/**
 * Resolve a written name. When it answers to several, the place it is already
 * set to wins if it is one of them: a name that still says what the scene holds
 * changes nothing, where taking the first would move the scene to the other.
 */
export function resolvePlace(text: string, places: readonly NamedPlace[], maps: readonly NamedMap[], current: string | null = null): PlaceMatch {
  const found = placesNamed(text, places, maps)
  if (found.length === 0) return { kind: 'none' }
  if (found.length === 1) return { kind: 'one', place: found[0] }
  const held = found.find((p) => p.id === current)
  return held ? { kind: 'one', place: held } : { kind: 'several', places: found }
}

/** The other places on the same map already called `name` (a place being renamed is `except`). */
export function sameNameOnMap(name: string, mapLayerId: string | null, places: readonly NamedPlace[], except?: string): NamedPlace[] {
  if (!name.trim()) return []
  return places.filter((p) => p.id !== except && (p.mapLayerId ?? null) === mapLayerId && same(p.name, name))
}

/** The ids of every place that shares its name with another on the same map. */
export function clashingPlaces(places: readonly NamedPlace[]): Set<string> {
  const byKey = new Map<string, string[]>()
  for (const p of places) {
    const key = `${p.mapLayerId ?? ''}\u0000${p.name.trim().toLowerCase()}`
    byKey.set(key, [...(byKey.get(key) ?? []), p.id])
  }
  return new Set([...byKey.values()].filter((ids) => ids.length > 1).flat())
}
