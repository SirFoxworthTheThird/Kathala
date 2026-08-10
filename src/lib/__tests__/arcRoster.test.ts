import { describe, it, expect } from 'vitest'
import { arcRoster, countAppearances, countRecorded, type ArcRosterInput } from '../arcRoster'
import type { Character } from '@/types'

const char = (id: string, name: string) => ({ id, name } as Character)

const CAST = [
  char('frodo', 'Frodo'),
  char('bill', 'Bill the Pony'),
  char('barrow', 'Barrow-wight'),
  char('sam', 'Sam'),
]

function roster(over: Partial<ArcRosterInput> = {}) {
  return arcRoster({
    characters: CAST,
    appearances: new Map([['frodo', 40], ['sam', 30], ['bill', 3], ['barrow', 1]]),
    recorded: new Map([['frodo', 12], ['sam', 9]]),
    query: '',
    order: 'name',
    hideUnrecorded: false,
    ...over,
  })
}

describe('arcRoster', () => {
  it('sorts by name when asked, which is what buried the leads', () => {
    expect(roster().rows.map((c) => c.name))
      .toEqual(['Barrow-wight', 'Bill the Pony', 'Frodo', 'Sam'])
  })

  it('sorts by appearances, most-seen first', () => {
    expect(roster({ order: 'appearances' }).rows.map((c) => c.name))
      .toEqual(['Frodo', 'Sam', 'Bill the Pony', 'Barrow-wight'])
  })

  it('breaks appearance ties by name rather than by input order', () => {
    // Otherwise the grid reshuffles whenever an unrelated character gains a
    // scene, which is worse than any ordering.
    const r = arcRoster({
      characters: [char('b', 'Beregond'), char('a', 'Anborn')],
      appearances: new Map([['a', 5], ['b', 5]]),
      recorded: new Map(),
      query: '',
      order: 'appearances',
      hideUnrecorded: false,
    })
    expect(r.rows.map((c) => c.name)).toEqual(['Anborn', 'Beregond'])
  })

  it('hides characters with nothing recorded, and says how many', () => {
    const r = roster({ hideUnrecorded: true })
    expect(r.rows.map((c) => c.name)).toEqual(['Frodo', 'Sam'])
    expect(r.hidden).toBe(2)
  })

  it('counts as hidden only what the search left in', () => {
    // A row the text filter already excluded was not hidden by this control,
    // and counting it would overstate what the toggle is keeping back.
    const r = roster({ hideUnrecorded: true, query: 'bill' })
    expect(r.rows).toHaveLength(0)
    expect(r.hidden).toBe(1)
  })

  it('reports nothing hidden when the control is off', () => {
    expect(roster({ hideUnrecorded: false }).hidden).toBe(0)
  })

  it('filters by name, case-insensitively', () => {
    expect(roster({ query: 'FRO' }).rows.map((c) => c.name)).toEqual(['Frodo'])
  })

  it('does not mutate the cast it was given', () => {
    const cast = [char('b', 'Bee'), char('a', 'Ant')]
    arcRoster({
      characters: cast,
      appearances: new Map(),
      recorded: new Map(),
      query: '',
      order: 'name',
      hideUnrecorded: false,
    })
    expect(cast.map((c) => c.name)).toEqual(['Bee', 'Ant'])
  })
})

describe('countAppearances', () => {
  it('counts a scene once however many ways a character is attached to it', () => {
    const counts = countAppearances([
      { povCharacterId: 'frodo', involvedCharacterIds: ['frodo', 'sam'], mentionedCharacterIds: ['frodo'] },
      { povCharacterId: null, involvedCharacterIds: ['sam'] },
    ])
    expect(counts.get('frodo')).toBe(1)
    expect(counts.get('sam')).toBe(2)
  })

  it('has nothing to say about a character in no scenes', () => {
    expect(countAppearances([{ involvedCharacterIds: ['sam'] }]).get('frodo')).toBeUndefined()
  })
})

describe('countRecorded', () => {
  it('counts authored snapshots per character', () => {
    const counts = countRecorded([
      { characterId: 'frodo' }, { characterId: 'frodo' }, { characterId: 'sam' },
    ])
    expect(counts.get('frodo')).toBe(2)
    expect(counts.get('sam')).toBe(1)
  })
})
