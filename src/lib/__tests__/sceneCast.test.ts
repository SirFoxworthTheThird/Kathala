import { describe, it, expect } from 'vitest'
import { sceneCast } from '@/lib/sceneCast'
import type { Character, Item, LocationMarker, WorldEvent } from '@/types'

const character = (id: string, name: string, portraitImageId: string | null = null): Character => ({
  id, worldId: 'w', name, aliases: [], description: '', portraitImageId,
  color: '#888', tags: [], isAlive: true, birthDate: null, createdAt: 0, updatedAt: 0,
} as Character)

const item = (id: string, name: string, imageId: string | null = null): Item => ({
  id, worldId: 'w', name, description: '', iconType: 'object', imageId, tags: [],
  createdAt: 0, updatedAt: 0,
} as Item)

const marker = (id: string, name: string, imageId: string | null = null): LocationMarker => ({
  id, worldId: 'w', mapLayerId: 'ml', linkedMapLayerId: null, name, description: '',
  x: 0, y: 0, imageId, iconType: 'city', tags: [], factionId: null, createdAt: 0, updatedAt: 0,
} as LocationMarker)

const scene = (o: Partial<WorldEvent> = {}) => ({
  involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
  locationMarkerId: null, povCharacterId: null, ...o,
} as WorldEvent)

const CAST = [character('dartagnan', "d'Artagnan", 'img-d'), character('aramis', 'Aramis'), character('milady', 'Milady')]
const ITEMS = [item('studs', 'The Diamond Studs', 'img-s')]
const MARKERS = [marker('paris', 'Paris, 1625', 'img-p')]

const of = (event: WorldEvent, over: Partial<{ characters: Character[] }> = {}) =>
  sceneCast({ event, characters: over.characters ?? CAST, items: ITEMS, markers: MARKERS })

describe('sceneCast', () => {
  it('names who is on stage, in the order the scene lists them', () => {
    const cast = of(scene({ involvedCharacterIds: ['dartagnan', 'aramis'] }))
    expect(cast.characters.map((c) => c.name)).toEqual(["d'Artagnan", 'Aramis'])
    expect(cast.characters.every((c) => c.onStage)).toBe(true)
    expect(cast.characters[0].imageId).toBe('img-d')
    expect(cast.characters[1].imageId, 'no portrait is null, not undefined').toBeNull()
  })

  it('carries the location and the items, with their pictures', () => {
    const cast = of(scene({ locationMarkerId: 'paris', involvedItemIds: ['studs'] }))
    expect(cast.location).toEqual({ id: 'paris', name: 'Paris, 1625', imageId: 'img-p' })
    expect(cast.items).toEqual([{ id: 'studs', name: 'The Diamond Studs', imageId: 'img-s' }])
    expect(cast.empty).toBe(false)
  })

  it('puts the viewpoint character on stage even when the scene does not list them', () => {
    const cast = of(scene({ povCharacterId: 'dartagnan', involvedCharacterIds: ['aramis'] }))
    expect(cast.characters.map((c) => c.id)).toEqual(['dartagnan', 'aramis'])
    expect(cast.characters[0].onStage).toBe(true)
  })

  it('marks someone named by others as not on stage', () => {
    const cast = of(scene({ involvedCharacterIds: ['dartagnan'], mentionedCharacterIds: ['milady'] }))
    expect(cast.characters.map((c) => [c.name, c.onStage]))
      .toEqual([["d'Artagnan", true], ['Milady', false]])
  })

  it('lists someone both present and named once, on stage', () => {
    const cast = of(scene({ involvedCharacterIds: ['milady'], mentionedCharacterIds: ['milady'] }))
    expect(cast.characters).toHaveLength(1)
    expect(cast.characters[0].onStage, 'the stronger of the two claims').toBe(true)
  })

  /*
    The gate reaches this through the lists it is handed, which the entity hooks
    have already filtered. These two are the pair: the same scene, the same ids,
    and the only difference is whether the reader has met the person.
  */
  describe('a reader who has not met someone', () => {
    const MET = CAST.filter((c) => c.id !== 'milady')

    it('is not told that they are mentioned', () => {
      const cast = of(
        scene({ involvedCharacterIds: ['dartagnan'], mentionedCharacterIds: ['milady'] }),
        { characters: MET },
      )
      expect(cast.characters.map((c) => c.name)).toEqual(["d'Artagnan"])
    })

    it('is told once they have met them', () => {
      const cast = of(
        scene({ involvedCharacterIds: ['dartagnan'], mentionedCharacterIds: ['milady'] }),
        { characters: CAST },
      )
      expect(cast.characters.map((c) => c.name)).toEqual(["d'Artagnan", 'Milady'])
    })

    it('is not told they are on stage either, if the list says so', () => {
      // Belt and braces: an id that survived into the scene but not into the
      // cast is dropped wherever it appears, rather than rendering a blank card.
      const cast = of(scene({ involvedCharacterIds: ['dartagnan', 'milady'] }), { characters: MET })
      expect(cast.characters.map((c) => c.name)).toEqual(["d'Artagnan"])
    })
  })

  it('says so when there is nothing to show', () => {
    expect(sceneCast({ event: null, characters: CAST, items: ITEMS, markers: MARKERS }).empty).toBe(true)
    expect(of(scene()).empty).toBe(true)
    // And an id that resolves to nothing is the same as no id.
    expect(of(scene({ involvedCharacterIds: ['nobody'], locationMarkerId: 'nowhere' })).empty).toBe(true)
  })
})
