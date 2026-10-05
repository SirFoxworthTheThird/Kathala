import { db } from '@/db/database'
import { createCharacter } from '@/db/hooks/useCharacters'
import { createItem } from '@/db/hooks/useItems'
import { createLocationMarker } from '@/db/hooks/useLocationMarkers'
import { updateEvent } from '@/db/hooks/useTimeline'
import type { LocationMarker, MapLayer } from '@/types'
import type { MentionIntent, MentionSuggestion } from '@/lib/mentionPicker'
import { freeSpot } from '@/lib/freeSpot'

/**
 * Record what the writer just asserted by typing, against scene `eventId`,
 * creating the record first when the row was an offer to create one. The "@"
 * picker's other half, shared by a scene card's draft and the Manuscript's Page.
 *
 * Two sigils, two claims. `@Marn` says the name occurs here; `@@Marn` says
 * he is in the room. Nothing reads the sentence to work that out — the
 * keystroke is the assertion, which is what keeps this safe in prose full of
 * negation, hearsay and flashback.
 *
 * The scene is read here, at the moment of writing, rather than handed in: the
 * lists this adds to are the ones stored now.
 *
 * `markers` and `mapLayers` are the ones the picker offered from — where a new
 * place goes. `mention` records a character as mentioned; a scene card passes
 * its own, which knows the cast it is editing, and the default reads the scene.
 */
export async function recordMention(
  eventId: string,
  suggestion: MentionSuggestion,
  intent: MentionIntent,
  opts: {
    markers: LocationMarker[]
    mapLayers: MapLayer[]
    mention?: (characterId: string) => void | Promise<void>
  },
): Promise<void> {
  const event = await db.events.get(eventId)
  if (!event) return
  const mention = opts.mention ?? (async (characterId: string) => {
    // Present is the stronger claim, and a character in both lists is the record contradicting itself.
    if (event.involvedCharacterIds.includes(characterId) || (event.mentionedCharacterIds ?? []).includes(characterId)) return
    await updateEvent(eventId, { mentionedCharacterIds: [...(event.mentionedCharacterIds ?? []), characterId] })
  })

  if (intent === 'present' && suggestion.type === 'existing' && suggestion.kind === 'character') {
    /*
      Present, so no longer merely mentioned. The two lists are separate and
      a character in both is the record contradicting itself — and *mentioned*
      is the weaker claim, so the stronger one replaces it rather than sitting
      beside it.

      One `updateEvent`, so one journal operation — a mistyped `@@` is a
      single undo rather than two.

      **From the toolbar, though, not from Ctrl+Z.** `AppShell` hands the
      shortcut back to the browser inside an `INPUT` or `TEXTAREA`, on the
      reasoning that native undo is the one a writer means while typing — and
      native undo does nothing to a journalled record, so in the prose box
      the keystroke is inert. This comment claimed the keystroke until a
      writer measured it.
    */
    await updateEvent(eventId, {
      involvedCharacterIds: [...new Set([...event.involvedCharacterIds, suggestion.id])],
      mentionedCharacterIds: (event.mentionedCharacterIds ?? []).filter((id) => id !== suggestion.id),
    })
    return
  }

  if (suggestion.type === 'create') {
    if (suggestion.kind === 'character') {
      const created = await createCharacter({ worldId: event.worldId, name: suggestion.name, description: '' })
      /*
        Created from inside the header, they are *present*, not mentioned —
        the line has no weaker claim to make. The header would say so on the
        next blur anyway; saying it here means the record is never briefly
        wrong, and never wrong at all if the writer closes the tab first.
      */
      if (intent === 'present') {
        await updateEvent(eventId, {
          involvedCharacterIds: [...new Set([...event.involvedCharacterIds, created.id])],
        })
        return
      }
      await mention(created.id)
      return
    }
    if (suggestion.kind === 'item') {
      const created = await createItem({
        worldId: event.worldId, name: suggestion.name, description: '', iconType: 'misc', tags: [],
      })
      await updateEvent(eventId, { involvedItemIds: [...new Set([...event.involvedItemIds, created.id])] })
      return
    }
    /*
      A place goes on a map when there is one to put it on, at the centre —
      somewhere findable, to be dragged where it belongs. It prefers the
      scene's own map over the world's first, so a room named while writing a
      scene set indoors lands on the floor plan rather than the continent.

      **And when there is no map, it is simply made without one.** A place
      used to be a pin, so this row was withheld entirely from a mapless
      world and a book set in a kitchen and an office could record neither.
      An unmapped place is a place all the same: scenes can happen there,
      characters can be there, and it can be put on a map the day one is
      drawn.
    */
    const home = opts.markers.find((m) => m.id === event.locationMarkerId)
    const layer = opts.mapLayers.find((l) => l.id === home?.mapLayerId) ?? opts.mapLayers[0]
    const created = await createLocationMarker({
      worldId: event.worldId, name: suggestion.name, description: '', iconType: 'landmark',
      mapLayerId: layer?.id ?? null,
      ...(layer ? freeSpot(layer, opts.markers.filter((m) => m.mapLayerId === layer.id)) : {}),
    })
    /*
      A **place** is set only when the scene has none: `locationMarkerId` is a
      single field, so writing to it over an existing value would silently move
      the scene somewhere else on the strength of a word in the prose. Naming a
      second place in a scene is ordinary; relocating the scene is not.
    */
    if (!event.locationMarkerId) await updateEvent(eventId, { locationMarkerId: created.id })
    return
  }

  if (suggestion.kind === 'character') { await mention(suggestion.id); return }
  if (suggestion.kind === 'item') {
    await updateEvent(eventId, { involvedItemIds: [...new Set([...event.involvedItemIds, suggestion.id])] })
    return
  }
  if (!event.locationMarkerId) await updateEvent(eventId, { locationMarkerId: suggestion.id })
}

/**
 * Make the place a scene header names, when nothing in the world answers it,
 * and set the scene there. `[#The Kitchen]` over a world with no kitchen.
 *
 * The header leaves an unknown place alone and says so, because the likeliest
 * reason is a typo, and inventing a place from one would answer the typo with a
 * second place. So this is the writer's answer to that warning, never the
 * header's own: a button beside it, pressed on purpose.
 *
 * **Made without a map, always** — unlike the `@` picker, which puts a new place
 * at the centre of the scene's map. A header is written from inside the story,
 * not from a map, and a pin at the centre would be a claim about where the place
 * is that nobody made. It waits under *Not on a map* on the Maps screen until
 * the writer puts it somewhere.
 *
 * The setting is replaced, not only filled: the header asserts where the scene
 * happens, and this is that assertion once the place exists. A place of the
 * same name made in the meantime — a second press, another tab — is used rather
 * than doubled, by the header's own case-insensitive match.
 */
export async function createHeaderPlace(eventId: string, name: string): Promise<string> {
  const event = await db.events.get(eventId)
  if (!event) throw new Error(`No scene ${eventId}`)
  const wanted = name.trim()
  const same = await db.locationMarkers.where('worldId').equals(event.worldId)
    .filter((m) => m.name.toLowerCase() === wanted.toLowerCase()).first()
  const placeId = same?.id ?? (await createLocationMarker({
    worldId: event.worldId, name: wanted, description: '', iconType: 'landmark', mapLayerId: null,
  })).id
  if (event.locationMarkerId !== placeId) await updateEvent(eventId, { locationMarkerId: placeId })
  return placeId
}
