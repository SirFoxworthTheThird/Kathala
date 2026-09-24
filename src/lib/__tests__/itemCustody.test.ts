import { describe, it, expect } from 'vitest'
import { itemCustodyChain, describeCustodyStep } from '@/lib/itemCustody'
import type { Character, CharacterSnapshot, Chapter, ItemPlacement, LocationMarker, WorldEvent } from '@/types'

/**
 * The Items screen promises "objects characters carry, use, or lose over time",
 * and the item's own page said nothing about who had it or where it had been.
 * The data was there all along — split across `ItemPlacement` and
 * `CharacterSnapshot.inventoryItemIds` — and no view put it in order.
 */

const LETTER = 'it-letter'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, title = id): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
    threadIds: [], involvedItemIds: [], tags: [], sortOrder, travelDays: null,
    inWorldTime: null, tension: null, structureBeat: null, status: 'draft',
    povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  }
}
function snap(
  characterId: string, eventId: string, inventoryItemIds: string[], currentLocationMarkerId: string | null = null,
): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true,
    currentLocationMarkerId, currentMapLayerId: currentLocationMarkerId ? 'map1' : null,
    inventoryItemIds, inventoryNotes: '', statusNotes: '', travelModeId: null,
    createdAt: 0, updatedAt: 0,
  }
}
function placement(eventId: string, locationMarkerId: string): ItemPlacement {
  return { id: `p-${eventId}`, worldId: 'w', itemId: LETTER, eventId, locationMarkerId, notes: '', createdAt: 0, updatedAt: 0 } as ItemPlacement
}

const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]
const events = [
  event('e1', 'c1', 0, 'The letter arrives'),
  event('e2', 'c1', 1, 'Setting out'),
  event('e3', 'c2', 0, 'The seal breaks'),
  event('e4', 'c3', 0, 'Ferrow Crossing'),
]
const markers: LocationMarker[] = [
  { id: 'mk1', worldId: 'w', mapLayerId: 'map1', name: 'The Reed House', description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: 0, updatedAt: 0 },
  { id: 'mk2', worldId: 'w', mapLayerId: 'map1', name: 'Ferrow Crossing', description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: 0, updatedAt: 0 },
]
function character(id: string, name: string): Character {
  return {
    id, worldId: 'w', name, description: '', aliases: [], tags: [],
    portraitImageId: null, isAlive: true, color: '#888',
    createdAt: 0, updatedAt: 0,
  }
}
const characters: Character[] = [character('mira', 'Mira Vasse'), character('corvin', 'Corvin Ashe')]

const chain = (snapshots: CharacterSnapshot[], placements: ItemPlacement[] = []) =>
  itemCustodyChain({ itemId: LETTER, placements, snapshots, markers, characters, events, chapters })

describe('itemCustodyChain', () => {
  it('says nothing about an item nobody has touched', () => {
    expect(chain([])).toEqual([])
  })

  it('names who picked it up, and where', () => {
    const steps = chain([snap('mira', 'e1', [LETTER], 'mk1')])
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({
      eventId: 'e1', chapterNumber: 1, sceneTitle: 'The letter arrives',
      carrier: 'Mira Vasse', location: 'The Reed House',
    })
  })

  it('follows it from one pair of hands to another', () => {
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('corvin', 'e3', [LETTER], 'mk2'),
    ])
    expect(steps.map((s) => s.carrier)).toEqual(['Mira Vasse', 'Corvin Ashe'])
    expect(steps.map((s) => s.sceneTitle)).toEqual(['The letter arrives', 'The seal breaks'])
  })

  it('collapses a run where nothing about the item moved', () => {
    // Carried, unchanged, through three scenes: one decision, not three.
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('mira', 'e2', [LETTER], 'mk1'),
      snap('mira', 'e3', [LETTER], 'mk1'),
    ])
    expect(steps).toHaveLength(1)
  })

  it('notes it moving with its carrier', () => {
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('mira', 'e3', [LETTER], 'mk2'),
    ])
    expect(steps.map((s) => s.location)).toEqual(['The Reed House', 'Ferrow Crossing'])
  })

  it('ends custody when the holder stops carrying it', () => {
    // Without this the chain would say she carried it for the rest of the book,
    // because nobody else ever picks it up.
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('mira', 'e3', [], 'mk2'),
    ])
    expect(steps).toHaveLength(2)
    expect(steps[1].carrier).toBeNull()
  })

  /**
   * **W-1.** The step above is an *absence* — Mira recorded a state at e3 and it
   * did not mention the letter. It is not a hand-off, and the chain used to say
   * it was: it borrowed her position and the row read *"left at Ferrow
   * Crossing"*, an active sentence about something nobody wrote.
   *
   * A writer's run on a twelve-chapter draft found four of six items carrying
   * history of this kind, and the order that produces it is the natural one —
   * put everybody in their places first, hand out the props later, and every
   * position recorded before the prop existed claims the prop was left there.
   */
  it('names no place when an inventory merely stops listing the item', () => {
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('mira', 'e3', [], 'mk2'),
    ])
    expect(steps[1]).toMatchObject({ kind: 'unlisted', location: null, locationId: null })
    expect(describeCustodyStep(steps[1])).toBe("no longer in Mira Vasse's inventory")
  })

  /*
    The pair. A place the writer *did* name still reads as one, in the active
    voice, because a placement is a sentence they wrote.
  */
  it('still says where it lies when the writer put it down there', () => {
    const steps = chain([snap('mira', 'e1', [LETTER], 'mk1')], [placement('e3', 'mk2')])
    expect(steps[1]).toMatchObject({ kind: 'placed', location: 'Ferrow Crossing' })
    expect(describeCustodyStep(steps[1])).toBe('left at Ferrow Crossing')
  })

  /*
    And the silence is reported once. Every later scene where the same
    character records a state without the item is the same absence, not a run of
    new ones — which is what turned four items into a column of invented rows.
  */
  it('reports the absence once, however many later records repeat it', () => {
    const steps = chain([
      snap('mira', 'e1', [LETTER], 'mk1'),
      snap('mira', 'e3', [], 'mk2'),
      snap('mira', 'e4', [], 'mk2'),
    ])
    expect(steps.filter((st) => st.kind === 'unlisted')).toHaveLength(1)
  })

  it('lets an explicit placement win over an inventory that still lists it', () => {
    // The same precedence resolveItemWhereabouts uses, for the same reason.
    const steps = chain(
      [snap('mira', 'e1', [LETTER], 'mk1'), snap('mira', 'e3', [LETTER], 'mk1')],
      [placement('e3', 'mk2')],
    )
    expect(steps[1]).toMatchObject({ carrier: null, location: 'Ferrow Crossing' })
  })

  it('reads scenes in narrative order, not the order the records arrive', () => {
    const steps = chain([
      snap('corvin', 'e4', [LETTER], 'mk2'),
      snap('mira', 'e1', [LETTER], 'mk1'),
    ])
    expect(steps.map((s) => s.carrier)).toEqual(['Mira Vasse', 'Corvin Ashe'])
  })

  it('ignores a different item entirely', () => {
    expect(chain([snap('mira', 'e1', ['it-tally'], 'mk1')])).toEqual([])
  })
})

describe('describeCustodyStep', () => {
  const base = { eventId: 'e', chapterNumber: 1, sceneTitle: 's', carrierId: null, locationId: null, kind: 'carried' as const }
  it('names both when both are known', () => {
    expect(describeCustodyStep({ ...base, carrier: 'Mira', location: 'The Lock' })).toBe('carried by Mira · The Lock')
  })
  it('names the carrier alone when there is no place', () => {
    expect(describeCustodyStep({ ...base, carrier: 'Mira', location: null })).toBe('carried by Mira')
  })
  it('says where it lies when the writer put it down there', () => {
    expect(describeCustodyStep({ ...base, kind: 'placed', carrier: null, location: 'The Lock' }))
      .toBe('left at The Lock')
  })

  /*
    W-1. The same row used to read "left at The Lock" for a scene where nobody
    put anything anywhere — the holder simply recorded a state that did not
    mention the item, and the step borrowed *their* position for it.
  */
  it('describes the record, not a hand-off, when an inventory stops listing it', () => {
    expect(describeCustodyStep({ ...base, kind: 'unlisted', formerCarrier: 'Mira', carrier: null, location: null }))
      .toBe("no longer in Mira's inventory")
  })
  it('says so when it is neither held nor placed', () => {
    expect(describeCustodyStep({ ...base, carrier: null, location: null })).toBe('no longer carried')
  })
})
