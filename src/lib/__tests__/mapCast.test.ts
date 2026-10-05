import { describe, it, expect } from 'vitest'
import { splitMapCast } from '../mapCast'
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
    const { placed, unplaced } = splitMapCast(cast, [snap('c2', 'm1')], markers)
    expect(placed.length + unplaced.length).toBe(cast.length)
  })

  it('returns two empty lists for an empty cast', () => {
    expect(splitMapCast([], [], markers)).toEqual({ placed: [], unplaced: [] })
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
