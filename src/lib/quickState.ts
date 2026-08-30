import type { CharacterSnapshot, LocationMarker } from '@/types'

/**
 * Recording where somebody is, from the scene rather than from their page.
 *
 * Both blind writer runs named the same cost and neither was about a bug:
 * *"Recording one character's position in one scene costs seven interactions
 * from the Characters screen"*, *"six to eight clicks across three screens"* —
 * *"a six-scene chapter with four people is a morning."* The verdict turned on
 * it: the app asks for a habit rather than a moment, and habits are what writers
 * drop first.
 *
 * The Character States panel in chapter detail already lists exactly the gap —
 * a row per cast member with nothing recorded, saying *"no state recorded —
 * record it"* — and its answer was to navigate away to the character's own
 * page. This is the small form that fills it in place: status, where they are,
 * a note. Everything else (inventory, travel mode, coming back from the dead)
 * stays on the full editor, which the form still offers.
 *
 * The prefill is the point. A writer moving down a scene's cast is mostly
 * confirming that people are where they were, so the form opens on their
 * last-known state and saving pins it to *this* scene.
 */

/** The three fields the quick form edits. */
export interface QuickStateDraft {
  isAlive: boolean
  locationMarkerId: string | null
  statusNotes: string
}

/**
 * What the form opens on: the character's last-known state, or sensible blanks.
 *
 * The status note is deliberately **not** carried forward. Location and alive
 * persist because they are facts about the character that stay true until
 * something changes them; a note like "bleeding from the shoulder" is about the
 * moment it was written, and copying it forward would put words in the writer's
 * mouth at every later scene.
 */
export function draftFromSnapshot(prev: CharacterSnapshot | undefined): QuickStateDraft {
  return {
    isAlive: prev?.isAlive ?? true,
    locationMarkerId: prev?.currentLocationMarkerId ?? null,
    statusNotes: '',
  }
}

/** Whether the prefill came from an earlier scene, so the form can say so. */
export function isCarriedForward(prev: CharacterSnapshot | undefined, eventId: string): boolean {
  return !!prev && prev.eventId !== eventId
}

/**
 * The record to write.
 *
 * `eventId` is the scene being edited and is never taken from `prev`. That is
 * the rule this codebase has broken four times: `prev` is a *resolved* snapshot
 * whose own `eventId` is usually an **earlier** scene, and carrying it means the
 * write lands there — rewriting an assertion about a moment the writer was not
 * editing. Nothing is spread here for the same reason; every field is named, so
 * a field added to `CharacterSnapshot` later cannot ride along unnoticed.
 *
 * The fields the quick form does not offer are carried from `prev` rather than
 * blanked: taking an item out of somebody's hands is not something a writer
 * asked for by saying where they are standing.
 */
export function quickStateWrite(
  { draft, prev, worldId, characterId, eventId, markers }: {
    draft: QuickStateDraft
    prev: CharacterSnapshot | undefined
    worldId: string
    characterId: string
    eventId: string
    markers: Pick<LocationMarker, 'id' | 'mapLayerId'>[]
  },
): Omit<CharacterSnapshot, 'id' | 'sortKey' | 'createdAt' | 'updatedAt'> {
  const marker = draft.locationMarkerId
    ? markers.find((m) => m.id === draft.locationMarkerId)
    : undefined
  return {
    worldId,
    characterId,
    eventId,
    isAlive: draft.isAlive,
    currentLocationMarkerId: draft.locationMarkerId,
    // The layer the chosen marker actually lives on — writing any other is what
    // once cost a travel route on the following scene.
    currentMapLayerId: marker?.mapLayerId ?? null,
    inventoryItemIds: prev?.inventoryItemIds ?? [],
    inventoryNotes: prev?.inventoryNotes ?? '',
    statusNotes: draft.statusNotes,
    travelModeId: prev?.travelModeId ?? null,
  }
}
