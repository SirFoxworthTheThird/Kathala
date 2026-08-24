import type { Character, CharacterSnapshot, Chapter, ItemPlacement, LocationMarker, WorldEvent } from '@/types'

/** One step in an item's history: where it was, and who had it, from here on. */
export interface CustodyStep {
  eventId: string
  chapterNumber: number
  sceneTitle: string
  carrierId: string | null
  carrier: string | null
  locationId: string | null
  location: string | null
}

/**
 * An item's chain of custody, in narrative order (**F11**).
 *
 * The Items roster already answered *where is it now* — `resolveItemWhereabouts`
 * does that for one moment — but the item's own page said nothing at all, and
 * the sequence is the thing you open an item's page to check. Who had the letter
 * before Mira, and where did it change hands? The data was there the whole time,
 * split across `ItemPlacement` and `CharacterSnapshot.inventoryItemIds`, and no
 * view put it in order.
 *
 * Three kinds of scene can change an item's story, and all three are read:
 *
 *  1. **A placement** puts it somewhere directly, and wins over an inventory —
 *     the same precedence `resolveItemWhereabouts` uses, for the same reason: a
 *     writer who put the sword on the altar means the sword is on the altar.
 *  2. **An inventory that lists it** puts it in someone's hands.
 *  3. **The holder's own inventory no longer listing it** ends their custody.
 *     Without this the chain would say a character carried something for the
 *     rest of the book because nobody else ever picked it up.
 *
 * Only *changes* are returned: a run of scenes where nothing about the item
 * moved is one step, because that is one decision holding rather than forty.
 */
export function itemCustodyChain(args: {
  itemId: string
  placements: ItemPlacement[]
  snapshots: CharacterSnapshot[]
  markers: LocationMarker[]
  characters: Character[]
  events: WorldEvent[]
  chapters: Chapter[]
}): CustodyStep[] {
  const { itemId, placements, snapshots, markers, characters, events, chapters } = args

  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...events].sort((a, b) => {
    const byChapter = (chapterNumber.get(a.chapterId) ?? 0) - (chapterNumber.get(b.chapterId) ?? 0)
    return byChapter !== 0 ? byChapter : a.sortOrder - b.sortOrder
  })

  const markerName = (id: string | null) =>
    (id ? markers.find((m) => m.id === id)?.name : null) ?? null
  const characterName = (id: string | null) =>
    (id ? characters.find((c) => c.id === id)?.name : null) ?? null

  const placementAt = new Map<string, ItemPlacement>()
  for (const p of placements) if (p.itemId === itemId) placementAt.set(p.eventId, p)

  /** eventId → the snapshots recorded at it, so a scene is read once. */
  const snapsAt = new Map<string, CharacterSnapshot[]>()
  for (const s of snapshots) {
    const list = snapsAt.get(s.eventId)
    if (list) list.push(s)
    else snapsAt.set(s.eventId, [s])
  }

  const steps: CustodyStep[] = []
  let carrierId: string | null = null
  let locationId: string | null = null
  let started = false

  for (const ev of ordered) {
    const here = snapsAt.get(ev.id) ?? []
    const placement = placementAt.get(ev.id)
    const holder = here.find((s) => s.inventoryItemIds.includes(itemId))

    let nextCarrier: string | null = carrierId
    let nextLocation: string | null = locationId
    let changed = false

    if (placement) {
      // Put down somewhere: nobody is carrying it any more.
      nextCarrier = null
      nextLocation = placement.locationMarkerId
      changed = true
    } else if (holder) {
      nextCarrier = holder.characterId
      nextLocation = holder.currentLocationMarkerId
      changed = true
    } else if (carrierId && here.some((s) => s.characterId === carrierId)) {
      // The holder recorded a state here and it no longer lists the item.
      nextCarrier = null
      nextLocation = here.find((s) => s.characterId === carrierId)?.currentLocationMarkerId ?? locationId
      changed = true
    }

    if (!changed) continue
    if (started && nextCarrier === carrierId && nextLocation === locationId) continue

    carrierId = nextCarrier
    locationId = nextLocation
    started = true
    steps.push({
      eventId: ev.id,
      chapterNumber: chapterNumber.get(ev.chapterId) ?? 0,
      sceneTitle: ev.title,
      carrierId,
      carrier: characterName(carrierId),
      locationId,
      location: markerName(locationId),
    })
  }

  return steps
}

/** One line for a row: "carried by Mira Vasse · Ferrow Crossing", or where it lies. */
export function describeCustodyStep(step: CustodyStep): string {
  if (step.carrier && step.location) return `carried by ${step.carrier} · ${step.location}`
  if (step.carrier) return `carried by ${step.carrier}`
  if (step.location) return `left at ${step.location}`
  return 'no longer carried'
}
