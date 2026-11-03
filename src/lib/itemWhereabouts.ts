import type { Character, CharacterSnapshot, ItemPlacement, LocationMarker } from '@/types'
import type { Holdings } from './custody'

export interface Whereabouts {
  /** The place, when one is known. */
  location: string | null
  /** Who is carrying it, when it sits in someone's inventory. */
  carrier: string | null
}

const NOWHERE: Whereabouts = { location: null, carrier: null }

/**
 * Where an item is at the moment being viewed (**IT-2**).
 *
 * The Items roster showed a type and a description, so with a cursor set you
 * still could not see what was where — on the screen devoted to items, while
 * the map sidebar had been answering it all along.
 *
 * Two ways an item has a place, in order:
 *
 *  1. **An explicit placement** puts it somewhere directly. It wins, because a
 *     writer who put the sword on the altar means the sword is on the altar
 *     even if someone's inventory still lists it.
 *  2. **A character's inventory** puts it wherever that character is — and
 *     names them, which is usually the more useful half: *carried by Aragorn*
 *     says more than the room does.
 *
 * A carrier with no location of their own is still a carrier; the item is with
 * them, wherever that turns out to be.
 */
export function resolveItemWhereabouts(args: {
  itemId: string
  placements: ItemPlacement[]
  snapshots: CharacterSnapshot[]
  markers: LocationMarker[]
  characters: Character[]
  /**
   * Custody at the moment (Part B1): given, it answers — who has it, and
   * where it was put — and the placements and inventories are read only for
   * where a holder is. A copy in somebody's record no longer outvotes a
   * hand-off, and a thing put down can be picked up again.
   */
  holdings?: Holdings | null
}): Whereabouts {
  const { itemId, placements, snapshots, markers, characters, holdings } = args
  const nameOfMarker = (id: string | null) =>
    (id ? markers.find((m) => m.id === id)?.name : null) ?? null
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? null
  const whereIs = (id: string) => snapshots.find((s) => s.characterId === id)?.currentLocationMarkerId ?? null

  if (holdings) {
    const shared = holdings.sharedBy.get(itemId)
    // A collective item: everyone who has some.
    if (shared?.length) {
      const names = shared.map(nameOf).filter((n): n is string => !!n)
      return { location: shared.length === 1 ? nameOfMarker(whereIs(shared[0])) : null, carrier: names.length ? names.join(', ') : null }
    }
    const custody = holdings.ofItem.get(itemId)
    if (!custody) return NOWHERE
    // Where they are now; where they were when it was put there only if nothing says where they are.
    if (custody.holderId) return { location: nameOfMarker(whereIs(custody.holderId) ?? custody.placeId), carrier: nameOf(custody.holderId) }
    return { location: nameOfMarker(custody.placeId), carrier: null }
  }

  const placement = placements.find((p) => p.itemId === itemId)
  if (placement) return { location: nameOfMarker(placement.locationMarkerId), carrier: null }

  const held = snapshots.find((s) => s.inventoryItemIds.includes(itemId))
  if (held) {
    return {
      location: nameOfMarker(held.currentLocationMarkerId),
      carrier: characters.find((c) => c.id === held.characterId)?.name ?? null,
    }
  }
  return NOWHERE
}

/** One line for a card: "carried by Aragorn · Weathertop", or null for nowhere. */
export function describeWhereabouts(w: Whereabouts): string | null {
  if (w.carrier && w.location) return `carried by ${w.carrier} · ${w.location}`
  if (w.carrier) return `carried by ${w.carrier}`
  return w.location
}
