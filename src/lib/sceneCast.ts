import type { Character, Item, LocationMarker, WorldEvent } from '@/types'

/**
 * Who and what is in the scene being read — the contents of the X-ray panel.
 *
 * Pure, and deliberately dumb about the reading gate: it is handed the lists the
 * entity hooks return, and those are gated already (`useCharacters`,
 * `useItems`, `useAllLocationMarkers` all filter). A character the reader has
 * not met is therefore not in `characters` and cannot be named here, without
 * this function knowing the gate exists. That is the point of gating in the
 * hooks — a screen written later inherits it instead of remembering it.
 *
 * It matters most for **mentioned** characters. The gate counts being on stage
 * as meeting someone and counts a mention as nothing at all, on the grounds
 * that a name dropped in dialogue is foreshadowing the reader should meet in
 * the book rather than in an index. So a name in `mentionedCharacterIds` shows
 * here only when the reader has met that person somewhere else, and the panel
 * is otherwise silent about them.
 */

export interface CastMember {
  id: string
  name: string
  imageId: string | null
  /** On stage, as against named by someone on it. */
  onStage: boolean
}

export interface CastThing {
  id: string
  name: string
  imageId: string | null
}

export interface SceneCast {
  characters: CastMember[]
  items: CastThing[]
  location: CastThing | null
  /** Nothing survived the gate, or the scene names nothing at all. */
  empty: boolean
}

type SceneRefs = Pick<
  WorldEvent,
  'involvedCharacterIds' | 'mentionedCharacterIds' | 'involvedItemIds' | 'locationMarkerId' | 'povCharacterId'
>

const EMPTY: SceneCast = { characters: [], items: [], location: null, empty: true }

export function sceneCast(args: {
  event: SceneRefs | null | undefined
  characters: readonly Character[]
  items: readonly Item[]
  markers: readonly LocationMarker[]
}): SceneCast {
  const { event } = args
  if (!event) return EMPTY

  const charById = new Map(args.characters.map((c) => [c.id, c]))
  const itemById = new Map(args.items.map((i) => [i.id, i]))

  /*
    On stage first, in the order the scene lists them — which is the author's
    order, usually the viewpoint character and then whoever matters. Sorting by
    name would lose that and put Aramis above d'Artagnan.
  */
  const seen = new Set<string>()
  const characters: CastMember[] = []
  const take = (id: string | null | undefined, onStage: boolean) => {
    if (!id || seen.has(id)) return
    const c = charById.get(id)
    if (!c) return
    seen.add(id)
    characters.push({ id, name: c.name, imageId: c.portraitImageId ?? null, onStage })
  }

  // The viewpoint is on stage whether or not the scene lists them again, and
  // the gate agrees: `povCharacterId` is one of the appearances it counts.
  take(event.povCharacterId, true)
  for (const id of event.involvedCharacterIds ?? []) take(id, true)
  // `seen` carries across, so someone both present and named appears once, on
  // stage — the stronger of the two claims.
  for (const id of event.mentionedCharacterIds ?? []) take(id, false)

  const items: CastThing[] = []
  for (const id of event.involvedItemIds ?? []) {
    const it = itemById.get(id)
    if (it) items.push({ id, name: it.name, imageId: it.imageId ?? null })
  }

  const marker = event.locationMarkerId
    ? args.markers.find((m) => m.id === event.locationMarkerId)
    : undefined
  const location: CastThing | null = marker
    ? { id: marker.id, name: marker.name, imageId: marker.imageId ?? null }
    : null

  return {
    characters,
    items,
    location,
    empty: characters.length === 0 && items.length === 0 && location === null,
  }
}
