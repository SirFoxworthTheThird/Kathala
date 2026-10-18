import { describe, it, expect } from 'vitest'
import { groupLabel, pinName, splitMapCast } from '../mapCast'
import type { Character, CharacterSnapshot, LocationMarker } from '@/types'

const char = (id: string, name: string) => ({ id, name } as Character)

const snap = (characterId: string, currentLocationMarkerId: string | null) =>
  ({ characterId, currentLocationMarkerId } as CharacterSnapshot)

const marker = (id: string, name: string) => ({ id, name } as LocationMarker)

describe('splitMapCast', () => {
  const cast = [char('c1', 'Aragorn'), char('c2', 'Boromir'), char('c3', 'Celeborn')]
  const markers = [marker('m1', 'Weathertop'), marker('m2', 'Rivendell')]

  it('puts the characters standing somewhere in their own list', () => {
    const { placed, unplaced } = splitMapCast(
      cast,
      [snap('c1', 'm1'), snap('c3', 'm2')],
      markers,
    )
    expect(placed.map((p) => p.character.name)).toEqual(['Aragorn', 'Celeborn'])
    expect(placed.map((p) => p.locationName)).toEqual(['Weathertop', 'Rivendell'])
    expect(unplaced.map((p) => p.character.name)).toEqual(['Boromir'])
    expect(unplaced.map((p) => p.locationName)).toEqual([null])
  })

  it('puts the people of another era in a list of their own, apart from the unplaced', () => {
    // Celeborn has no state here and his records are all in another era; Boromir has none anywhere.
    const { unplaced, elsewhere } = splitMapCast(cast, [snap('c1', 'm1')], markers, new Set(['c3']))
    expect(elsewhere.map((p) => p.character.name)).toEqual(['Celeborn'])
    expect(unplaced.map((p) => p.character.name)).toEqual(['Boromir'])
    // Somebody with a state here is placed, whatever else they have.
    expect(splitMapCast(cast, [snap('c3', 'm2')], markers, new Set(['c3'])).elsewhere).toEqual([])
  })

  it('sorts each list by name rather than keeping input order', () => {
    const { placed } = splitMapCast(
      [char('c3', 'Celeborn'), char('c1', 'Aragorn')],
      [snap('c1', 'm1'), snap('c3', 'm2')],
      markers,
    )
    expect(placed.map((p) => p.character.name)).toEqual(['Aragorn', 'Celeborn'])
  })

  it('treats a snapshot with no marker as unplaced', () => {
    const { placed, unplaced } = splitMapCast(cast, [snap('c1', null)], markers)
    expect(placed).toEqual([])
    expect(unplaced.map((p) => p.character.name)).toEqual(['Aragorn', 'Boromir', 'Celeborn'])
  })

  it('treats a snapshot pointing at a deleted marker as unplaced', () => {
    // Otherwise the row reads as placed and shows nothing where the place goes.
    const { placed, unplaced } = splitMapCast(cast, [snap('c1', 'gone')], markers)
    expect(placed).toEqual([])
    expect(unplaced.map((p) => p.character.name)).toContain('Aragorn')
  })

  it('keeps everyone, so nobody falls out of the sidebar', () => {
    const { placed, unplaced, dead } = splitMapCast(cast, [snap('c2', 'm1'), { ...snap('c3', 'm2'), isAlive: false }], markers)
    expect(placed.length + unplaced.length + dead.length).toBe(cast.length)
  })

  it('puts the dead apart, with where they were last — not on the map (run 9)', () => {
    const { placed, unplaced, dead } = splitMapCast(cast, [{ ...snap('c2', 'm1'), isAlive: false }, { ...snap('c3', 'm2'), isAlive: true }], markers)
    expect(dead).toEqual([{ character: cast[1], locationName: 'Weathertop' }])
    // Paired: the living one at a place is on it.
    expect(placed.map((p) => p.character.name)).toEqual(['Celeborn'])
    expect(unplaced.map((p) => p.character.name)).toEqual(['Aragorn'])
  })

  it('returns four empty lists for an empty cast', () => {
    expect(splitMapCast([], [], markers)).toEqual({ placed: [], unplaced: [], dead: [], elsewhere: [] })
  })
})

describe('castNotAtSetting (G-1)', () => {
  const at = (characterId: string, place: string | null, isAlive = true) =>
    ({ characterId, currentLocationMarkerId: place, isAlive }) as never
  it('is the cast with no record, or a record somewhere else', async () => {
    const { castNotAtSetting } = await import('../mapCast')
    expect(castNotAtSetting(['a', 'b', 'c'], [at('b', 'inn'), at('c', 'quay')], 'inn')).toEqual(['a', 'c'])
  })
  it('leaves out the dead, and is empty when everyone is there', async () => {
    const { castNotAtSetting } = await import('../mapCast')
    expect(castNotAtSetting(['a', 'b'], [at('a', 'quay', false), at('b', 'inn')], 'inn')).toEqual([])
  })
})

describe('a map pin for the dead (run 9)', () => {
  it('names them with a dagger, and the living as they are', () => {
    expect(pinName({ character: { name: 'Kieran Doyle' }, dead: true })).toBe('Kieran Doyle †')
    expect(pinName({ character: { name: 'Nell Ashdown' }, dead: false })).toBe('Nell Ashdown')
  })
  it('counts the dead in a group apart', () => {
    expect(groupLabel([{ dead: false }, { dead: true }, {}])).toBe('3 characters · 1 dead')
    expect(groupLabel([{}, { dead: false }])).toBe('2 characters')
  })
})
