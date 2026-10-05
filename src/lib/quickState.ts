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
 *
 * **Unless the note is already about this scene.** Once this form also *edits*
 * a record — the panel that takes the answer taking a correction too — `prev`
 * can be the row being changed rather than an earlier one, and blanking there
 * is not restraint, it is deleting a sentence the writer wrote. So `eventId`
 * decides: carried forward, blank; written here, keep it and let them edit it.
 * Without this the correction path quietly erases the note every time.
 */
export function draftFromSnapshot(
  prev: CharacterSnapshot | undefined,
  eventId?: string,
  /**
   * Where the scene is set, when the character is in its cast — the place the
   * scene itself says they are. Pass null otherwise.
   */
  castSetting: string | null = null,
): QuickStateDraft {
  const atThisScene = !!prev && !!eventId && prev.eventId === eventId
  return {
    isAlive: prev?.isAlive ?? true,
    /*
      A record at this scene is what it says. Otherwise somebody in the scene's
      cast is where the scene is set: the last place they were recorded is an
      earlier scene's answer. Prefilling it meant one click on Save recorded the
      old place here — and silenced the continuity check that had just said the
      record and the scene disagreed, since a recorded answer is never second-
      guessed.
    */
    locationMarkerId: atThisScene ? prev.currentLocationMarkerId ?? null : castSetting ?? prev?.currentLocationMarkerId ?? null,
    statusNotes: atThisScene ? prev.statusNotes : '',
  }
}

/** Whether the prefilled place is the scene's setting rather than the last place recorded. */
export function placedBySetting(prev: CharacterSnapshot | undefined, eventId: string, castSetting: string | null): boolean {
  const atThisScene = !!prev && prev.eventId === eventId
  return !atThisScene && castSetting !== null && castSetting !== (prev?.currentLocationMarkerId ?? null)
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
