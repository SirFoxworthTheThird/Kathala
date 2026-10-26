import { describe, it, expect } from 'vitest'
import { resolveItemWhereabouts, describeWhereabouts } from '../itemWhereabouts'
import type { Character, CharacterSnapshot, ItemPlacement, LocationMarker } from '@/types'
import type { Holdings } from '../custody'

const markers = [
  { id: 'm1', name: 'Weathertop' },
  { id: 'm2', name: 'Rivendell' },
] as LocationMarker[]
const characters = [{ id: 'c1', name: 'Aragorn' }] as Character[]

const place = (itemId: string, locationMarkerId: string) =>
  ({ itemId, locationMarkerId } as ItemPlacement)
const holds = (characterId: string, items: string[], at: string | null) =>
  ({ characterId, inventoryItemIds: items, currentLocationMarkerId: at } as CharacterSnapshot)

const resolve = (itemId: string, placements: ItemPlacement[], snapshots: CharacterSnapshot[]) =>
  resolveItemWhereabouts({ itemId, placements, snapshots, markers, characters })

describe('resolveItemWhereabouts', () => {
  it('uses an explicit placement', () => {
    expect(resolve('i1', [place('i1', 'm1')], [])).toEqual({ location: 'Weathertop', carrier: null })
  })

  it('names the carrier and where they are', () => {
    expect(resolve('i1', [], [holds('c1', ['i1'], 'm2')]))
      .toEqual({ location: 'Rivendell', carrier: 'Aragorn' })
  })

  it('prefers an explicit placement over a stale inventory', () => {
    // Putting the sword on the altar means it is on the altar, even if someone's
    // inventory has not been updated to let go of it.
    expect(resolve('i1', [place('i1', 'm1')], [holds('c1', ['i1'], 'm2')]))
      .toEqual({ location: 'Weathertop', carrier: null })
  })

  it('keeps a carrier who is nowhere in particular', () => {
    expect(resolve('i1', [], [holds('c1', ['i1'], null)]))
      .toEqual({ location: null, carrier: 'Aragorn' })
  })

  it('is nowhere when nothing places it', () => {
    expect(resolve('i1', [], [holds('c1', ['other'], 'm1')]))
      .toEqual({ location: null, carrier: null })
  })

  it('is nowhere when the placement points at a deleted marker', () => {
    expect(resolve('i1', [place('i1', 'gone')], [])).toEqual({ location: null, carrier: null })
  })
})

describe('describeWhereabouts', () => {
  it('leads with the carrier, since who has it says more than the room', () => {
    expect(describeWhereabouts({ carrier: 'Aragorn', location: 'Weathertop' }))
      .toBe('carried by Aragorn · Weathertop')
  })

  it('drops the half it does not have', () => {
    expect(describeWhereabouts({ carrier: 'Aragorn', location: null })).toBe('carried by Aragorn')
    expect(describeWhereabouts({ carrier: null, location: 'Weathertop' })).toBe('Weathertop')
  })

  it('says nothing rather than something empty', () => {
    expect(describeWhereabouts({ carrier: null, location: null })).toBeNull()
  })
})

/*
  With custody (Part B1) the holdings answer, and a record's inventory is read
  only for where a holder is.
*/
describe('resolveItemWhereabouts, by custody', () => {
  const people = [{ id: 'c1', name: 'Aragorn' }, { id: 'c2', name: 'Legolas' }] as Character[]
  const holdings = (ofItem: [string, { holderId: string | null; placeId: string | null }][], sharedBy: [string, string[]][] = []): Holdings => ({
    ofItem: new Map(ofItem.map(([id, c]) => [id, { ...c, carriedFrom: null, at: null }])),
    sharedBy: new Map(sharedBy),
    heldBy: new Map(),
  })
  const by = (itemId: string, h: Holdings, snapshots: CharacterSnapshot[] = []) =>
    resolveItemWhereabouts({ itemId, placements: [], snapshots, markers, characters: people, holdings: h })

  it('names the holder custody has, not the one a stale record lists', () => {
    expect(by('i1', holdings([['i1', { holderId: 'c2', placeId: null }]]), [holds('c1', ['i1'], 'm1'), holds('c2', [], 'm2')]))
      .toEqual({ location: 'Rivendell', carrier: 'Legolas' })
  })

  it('a thing put down lies where it was put; nothing said of it, it is nowhere', () => {
    expect(by('i1', holdings([['i1', { holderId: null, placeId: 'm1' }]]))).toEqual({ location: 'Weathertop', carrier: null })
    expect(by('i1', holdings([]), [holds('c1', ['i1'], 'm1')])).toEqual({ location: null, carrier: null })
  })

  it('a thing there is more than one of names everyone who has some, and a place only for one', () => {
    const snaps = [holds('c1', [], 'm1'), holds('c2', [], 'm2')]
    expect(by('lembas', holdings([], [['lembas', ['c1', 'c2']]]), snaps)).toEqual({ location: null, carrier: 'Aragorn, Legolas' })
    expect(by('lembas', holdings([], [['lembas', ['c2']]]), snaps)).toEqual({ location: 'Rivendell', carrier: 'Legolas' })
  })
})
