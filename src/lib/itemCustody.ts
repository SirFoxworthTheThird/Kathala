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
  /**
   * What the record actually says happened here.
   *
   * `placed` and `carried` are assertions the writer made. **`unlisted` is
   * not**: it means the person who was carrying the item recorded a state at
   * this scene and that state does not mention it. That is a gap in the record,
   * not a hand-off, and the difference is the whole of W-1 — see the third
   * branch below.
   *
   * **Saying it in the sentence was not enough.** A second writer's run found
   * the same four-of-six items carrying the same invented history at the tip
   * where the wording had been fixed, because `ItemDetailView` rendered every
   * step through an identical row: same border, same fill, same colour. The
   * row's *presence* in a list of events is itself a claim, whatever it says.
   * `kind` now reaches the screen as well as the sentence — see the
   * Whereabouts list, where a gap is dashed, unfilled and labelled.
   *
   * Not suppressed, and this was considered: an absence is only meaningless
   * when the record could not have mentioned the item, which needs to know
   * whether the state predates the item — and `Item` carries no timestamp at
   * all. Adding one would be null for every world that already exists, so the
   * rule would never fire on the books this was reported against. Telling the
   * two apart on screen is the fix that works on the data there is.
   *
   * It is also worth keeping. A writer who means *she put it down* has two
   * ways to say so — place it, or give it to somebody — and both produce an
   * asserted step. An inventory that simply stops listing something is a gap
   * every time, which is a thing worth surfacing rather than hiding.
   */
  kind: 'placed' | 'carried' | 'unlisted'
  /** For `unlisted`: whose inventory stopped listing it. */
  formerCarrier?: string | null
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
 *     rest of the book because nobody else ever picked it up. This step says
 *     only that, and deliberately names no place — see `kind: 'unlisted'`.
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
    let nextKind: CustodyStep['kind'] = 'carried'
    let nextFormer: string | null = null
    let changed = false

    if (placement) {
      // Put down somewhere: nobody is carrying it any more.
      nextCarrier = null
      nextLocation = placement.locationMarkerId
      nextKind = 'placed'
      changed = true
    } else if (holder) {
      nextCarrier = holder.characterId
      nextLocation = holder.currentLocationMarkerId
      nextKind = 'carried'
      changed = true
    } else if (carrierId && here.some((s) => s.characterId === carrierId)) {
      /*
        The holder recorded a state here and it no longer lists the item.

        **This is an absence, and it used to be read as a decision.** The step
        took the holder's own position and the row then read *"left at Ferrow
        Crossing"* — an active sentence about a hand-off nobody made. A writer's
        run on a twelve-chapter draft found four of six items carrying invented
        history, and the order that produces it is the natural one: record where
        everybody is first, give out the props later, and every position written
        before the prop existed now claims the prop was put down there.

        Nothing about the *item's* place is known here. What is known is that
        the record stopped listing it, and that is all this step now says.
      */
      nextCarrier = null
      nextLocation = null
      nextKind = 'unlisted'
      nextFormer = characterName(carrierId)
      changed = true
    }

    if (!changed) continue
    if (started && nextCarrier === carrierId && nextLocation === locationId) continue
    // An item already out of everybody's hands cannot go missing from them
    // again: a second empty inventory is the same silence, not a second event.
    if (nextKind === 'unlisted' && started && carrierId === null) continue

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
      kind: nextKind,
      ...(nextKind === 'unlisted' ? { formerCarrier: nextFormer } : {}),
    })
  }

  return steps
}

/**
 * One line for a row: "carried by Mira Vasse · Ferrow Crossing", or where it lies.
 *
 * The wording follows the `kind`, because the three are different claims. A
 * placement is a writer's sentence and gets an active one back — *left at the
 * Lock*. An inventory that has stopped mentioning the item is a silence, and
 * gets a sentence about the record rather than about the world.
 */
export function describeCustodyStep(step: CustodyStep): string {
  if (step.kind === 'unlisted') {
    return step.formerCarrier
      ? `no longer in ${step.formerCarrier}'s inventory`
      : 'no longer carried'
  }
  if (step.carrier && step.location) return `carried by ${step.carrier} · ${step.location}`
  if (step.carrier) return `carried by ${step.carrier}`
  if (step.location) return `left at ${step.location}`
  return 'no longer carried'
}
