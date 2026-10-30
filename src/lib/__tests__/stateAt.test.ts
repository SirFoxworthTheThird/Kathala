import { describe, it, expect } from 'vitest'
import { stateAt } from '@/lib/stateAt'
import { storyOf } from '@/lib/stateEngine'
import type { PersonRecord } from '@/lib/personState'
import type { ItemSnapshot, LocationSnapshot, RelationshipSnapshot } from '@/types'

/**
 * One resolver for every kind of state (Part B3): each read by its own rule —
 * a person's and a relationship's in their era, a place's and an item's
 * carried across eras — and people holding what custody says.
 */

// Ch. 1 is 1 BL (the Mercy), Ch. 2 is 311 AL (the Compact).
const scenes = [
  { id: 'a1', chapterId: 'c1', sortOrder: 0, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
  { id: 'b1', chapterId: 'c2', sortOrder: 0, timelineId: 'compact', travelDays: 1, inWorldTime: null },
]
const story = storyOf(scenes, [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }], [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 113_000 }])
const dated = { worldId: 'w', createdAt: 0, updatedAt: 0 }

describe('stateAt', () => {
  it('reads each kind by its own rule: a person and a relationship in their era, a place and an item across it', () => {
    const people: PersonRecord[] = [{ ...dated, id: 'p', characterId: 'ilse', eventId: 'a1', currentLocationMarkerId: 'deck', currentMapLayerId: null }]
    const places = [{ ...dated, id: 'l', locationMarkerId: 'hall', eventId: 'a1', status: 'ruined', notes: '' }] as LocationSnapshot[]
    const relationships = [{ ...dated, id: 'r', relationshipId: 'oath', eventId: 'a1', label: 'sworn', strength: 'strong', sentiment: 'positive', description: '', isActive: true }] as RelationshipSnapshot[]
    const items = { records: [{ ...dated, id: 'i', itemId: 'key', eventId: 'a1', condition: 'damaged', notes: '' }] as ItemSnapshot[], keptInEra: new Set<string>() }
    const here = stateAt({ people, places, relationships, items }, 'a1', story)
    expect([here.people.length, here.places.length, here.relationships.length, here.items.length]).toEqual([1, 1, 1, 1])
    // Three centuries on.
    const later = stateAt({ people, places, relationships, items }, 'b1', story)
    expect(later.people).toEqual([])
    expect(later.relationships).toEqual([])
    expect(later.places.map((p) => p.status)).toEqual(['ruined'])
    expect(later.items.map((i) => i.condition)).toEqual(['damaged'])
    // An item kept in its era stays there.
    expect(stateAt({ items: { ...items, keptInEra: new Set(['key']) } }, 'b1', story).items).toEqual([])
  })

  it('has each person hold what custody says, not their record', () => {
    const people: PersonRecord[] = [
      { ...dated, id: 'p', characterId: 'ilse', eventId: 'a1', inventoryItemIds: ['key'] },
      { ...dated, id: 'q', characterId: 'rhee', eventId: 'a1' },
    ]
    const custody = { rows: [{ itemId: 'key', eventId: 'a1', holderId: 'rhee', placeId: null }], collective: new Set<string>() }
    const held = Object.fromEntries(stateAt({ people, custody }, 'a1', story).people.map((s) => [s.characterId, s.inventoryItemIds]))
    expect(held).toEqual({ ilse: [], rhee: ['key'] })
    // With no scene, at each record's own scene.
    const unplaced = Object.fromEntries(stateAt({ people, custody }, null, story).people.map((s) => [s.characterId, s.inventoryItemIds]))
    expect(unplaced).toEqual({ ilse: [], rhee: ['key'] })
    expect(stateAt({ people, custody }, 'a1', story).holdings?.heldBy.get('rhee')).toEqual(['key'])
  })

  it('reads only the kinds it is given', () => {
    expect(stateAt({}, 'a1', story)).toEqual({ people: [], holdings: null, items: [], places: [], relationships: [], regions: [] })
  })
})
