import { describe, it, expect } from 'vitest'
import { placeLabel, placesNamed, resolvePlace, sameNameOnMap, clashingPlaces } from '@/lib/placeNames'
import { planHeader, planIsClean } from '@/lib/sceneHeader'
import { keptLineWarning } from '@/lib/keptHeaderLines'

/**
 * Places that share a name. Writer run 8 found a second "The Beacon" on its
 * main map, and the header resolved `#The Beacon` to whichever came first.
 */
const maps = [{ id: 'sands', name: 'Hollin Sands' }, { id: 'house', name: 'Scaur House' }]
const places = [
  { id: 'k1', name: 'The Kitchen', mapLayerId: 'house' },
  { id: 'k2', name: 'The Kitchen', mapLayerId: 'sands' },
  { id: 'b1', name: 'The Beacon', mapLayerId: 'sands' },
  { id: 'b2', name: 'The Beacon', mapLayerId: 'sands' },
  { id: 'yard', name: 'The Yard', mapLayerId: null },
]

describe('telling apart places that share a name', () => {
  it('writes a shared name with its map, and a name nobody shares as it is', () => {
    expect(placeLabel(places[0], places, maps)).toBe('The Kitchen (Scaur House)')
    expect(placeLabel(places[1], places, maps)).toBe('The Kitchen (Hollin Sands)')
    expect(placeLabel(places[4], places, maps)).toBe('The Yard')
    // Two on one map: the bracket would not say which, so it is not written.
    expect(placeLabel(places[2], places, maps)).toBe('The Beacon')
  })

  it('a place with no map is said to be on no map', () => {
    const more = [...places, { id: 'y2', name: 'The Yard', mapLayerId: 'house' }]
    expect(placeLabel(places[4], more, maps)).toBe('The Yard (no map)')
    expect(placesNamed('the yard (No Map)', more, maps).map((p) => p.id)).toEqual(['yard'])
  })

  it('finds a place by its name, or by its name and map', () => {
    expect(placesNamed('the kitchen', places, maps).map((p) => p.id)).toEqual(['k1', 'k2'])
    expect(placesNamed('The Kitchen (Scaur House)', places, maps).map((p) => p.id)).toEqual(['k1'])
    expect(placesNamed('The Kitchen (Nowhere)', places, maps)).toEqual([])
    // A name with brackets of its own is that name first.
    const own = [...places, { id: 'p', name: 'The Kitchen (old)', mapLayerId: null }]
    expect(placesNamed('The Kitchen (old)', own, maps).map((p) => p.id)).toEqual(['p'])
  })

  it('resolves to the place already held when the name answers to several, and to none of them otherwise', () => {
    expect(resolvePlace('The Beacon', places, maps, 'b2')).toEqual({ kind: 'one', place: places[3] })
    expect(resolvePlace('The Beacon', places, maps, 'yard')).toEqual({ kind: 'several', places: [places[2], places[3]] })
    expect(resolvePlace('The Yard', places, maps, null)).toEqual({ kind: 'one', place: places[4] })
    expect(resolvePlace('The Larder', places, maps, null)).toEqual({ kind: 'none' })
  })

  it('finds a clash on one map, and not across two', () => {
    expect(sameNameOnMap('the beacon', 'sands', places).map((p) => p.id)).toEqual(['b1', 'b2'])
    expect(sameNameOnMap('The Beacon', 'sands', places, 'b1').map((p) => p.id)).toEqual(['b2'])
    expect(sameNameOnMap('The Kitchen', 'house', places, 'k1')).toEqual([])
    expect(sameNameOnMap('', 'sands', places)).toEqual([])
    expect([...clashingPlaces(places)].sort()).toEqual(['b1', 'b2'])
  })
})

describe('a header naming a place that shares its name', () => {
  const world = { characters: [{ id: 'nell', name: 'Nell' }], places, maps, items: [{ id: 'lamp', name: 'Lamp' }] }

  it('keeps the scene where it is when it is set at one of them — any other edit to the line used to move it to the first', () => {
    // Set at the second Beacon; the Characters line changed. The place stays.
    const plan = planHeader('[#The Beacon @@Nell]', world, { involved: [], mentioned: [], place: 'b2' })
    expect(plan.update?.locationMarkerId).toBe('b2')
    expect(planIsClean(plan)).toBe(true)
  })

  it('says so, and moves nothing, when it is set at none of them', () => {
    const plan = planHeader('[#The Beacon @@Nell]', world, { involved: [], mentioned: [], place: 'yard' })
    expect(plan.update?.locationMarkerId).toBe('yard')
    expect(plan.unknown.place).toBeNull()
    expect(plan.unknown.ambiguous).toEqual([{
      name: 'The Beacon', line: 'place',
      choices: [{ id: 'b1', label: 'The Beacon', map: 'Hollin Sands' }, { id: 'b2', label: 'The Beacon', map: 'Hollin Sands' }],
    }])
    expect(planIsClean(plan)).toBe(false)
  })

  it('takes the name with its map as the one place', () => {
    const plan = planHeader('[#The Kitchen (Hollin Sands)]', world, { involved: [], mentioned: [], place: 'yard' })
    expect(plan.update?.locationMarkerId).toBe('k2')
    expect(planIsClean(plan)).toBe(true)
  })

  it('an item put down at a shared name: here, when this is one of them; otherwise said, and not put down', () => {
    const at = (place: string) => planHeader('[Place: #The Kitchen (Scaur House)\n  Items: ^Lamp:#The Kitchen\n]', world, { involved: [], mentioned: [], place })
    expect(at('k1').items.put).toEqual([{ itemId: 'lamp', placeId: 'k1' }])
    const elsewhere = planHeader('[#The Yard\n  Items: ^Lamp:#The Kitchen\n]', world, { involved: [], mentioned: [], place: 'yard' })
    expect(elsewhere.items.put).toEqual([])
    expect(elsewhere.unknown.ambiguous?.map((a) => [a.name, a.line])).toEqual([['The Kitchen', 'items']])
    expect(planIsClean(elsewhere)).toBe(false)
  })

  it('the note says how to write each, or that one wants renaming', () => {
    const across = planHeader('[#The Kitchen]', world, { involved: [], mentioned: [], place: 'yard' })
    expect(keptLineWarning(across.unknown, { cast: [], place: 'The Yard' })).toBe(
      'More than one place is called “The Kitchen” — write “The Kitchen (Scaur House)” or “The Kitchen (Hollin Sands)” to say which. The line was not applied. It is still set at The Yard.',
    )
    const one = planHeader('[#The Beacon]', world, { involved: [], mentioned: [], place: null })
    expect(keptLineWarning(one.unknown, { cast: [], place: null })).toBe(
      'Two places on Hollin Sands are called “The Beacon” — rename one on Maps to tell them apart. The line was not applied. It has no setting yet.',
    )
  })
})
