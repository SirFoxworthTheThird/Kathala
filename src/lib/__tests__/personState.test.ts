import { describe, it, expect } from 'vitest'
import { peopleAt, personAt, sparseRecords, sparseWorld, wholeRecords, type PersonRecord } from '@/lib/personState'
import { resolveCharacterSnapshot } from '@/db/hooks/useSnapshots'
import { storyOf } from '@/lib/stateEngine'
import type { CharacterSnapshot } from '@/types'

/**
 * A person's state as sparse statements (next-plan.md, B2): a record holds
 * only the fields said at its scene, and each is read on its own; and the
 * walk that turns whole-state records into them, keeping only the changes.
 */

const scenes = ['e1', 'e2', 'e3', 'e4', 'e5']
const events = scenes.map((id, i) => ({ id, chapterId: 'c1', sortOrder: i, timelineId: 'tl', travelDays: null, inWorldTime: null }))
const story = storyOf(events, [{ id: 'c1', number: 1 }], [{ id: 'tl', dayOffset: 0 }])

const said = (characterId: string, eventId: string, fields: Partial<CharacterSnapshot>): PersonRecord => ({
  id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, createdAt: 0, updatedAt: 0, ...fields,
})
function whole(characterId: string, eventId: string, fields: Partial<CharacterSnapshot> = {}): CharacterSnapshot {
  return {
    id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
    inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0, ...fields,
  }
}
const state = (s: CharacterSnapshot | undefined) => s && {
  isAlive: s.isAlive, place: s.currentLocationMarkerId, layer: s.currentMapLayerId, travel: s.travelModeId, status: s.statusNotes, carrying: s.inventoryNotes,
}

describe('personAt', () => {
  it('reads each field from the last record that says it, and the rest as nothing said', () => {
    const records = [
      said('anna', 'e1', { currentLocationMarkerId: 'quay', currentMapLayerId: 'map', travelModeId: 'horse' }),
      said('anna', 'e3', { statusNotes: 'wounded' }),
    ]
    expect(state(personAt(records, 'e4', story))).toEqual({ isAlive: true, place: 'quay', layer: 'map', travel: 'horse', status: 'wounded', carrying: '' })
    // The state is read at the last record, whichever fields it says.
    expect(personAt(records, 'e4', story)?.eventId).toBe('e3')
    expect(personAt(records, 'e2', story)?.statusNotes).toBe('')
    expect(personAt(records, 'e0', story)).toBeUndefined()
  })

  /*
    W-2 and F2: a correction at an earlier scene used to stop at the next
    record, which had copied the old value. A record that says only her
    wound no longer says where she is.
  */
  it('a correction at an earlier scene reaches past a later record that did not say it', () => {
    const records = [
      said('anna', 'e1', { currentLocationMarkerId: 'vault', currentMapLayerId: null }),
      said('anna', 'e3', { statusNotes: 'wounded' }),
    ]
    records[0] = { ...records[0], currentLocationMarkerId: 'quay' }
    expect(personAt(records, 'e3', story)?.currentLocationMarkerId).toBe('quay')
    expect(personAt(records, 'e5', story)?.currentLocationMarkerId).toBe('quay')
  })

  it('a place of nowhere is said, and is not the same as nothing said', () => {
    const records = [said('anna', 'e1', { currentLocationMarkerId: 'quay', currentMapLayerId: null }), said('anna', 'e3', { currentLocationMarkerId: null, currentMapLayerId: null })]
    expect(personAt(records, 'e4', story)?.currentLocationMarkerId).toBeNull()
    expect(personAt(records, 'e2', story)?.currentLocationMarkerId).toBe('quay')
  })

  it('keeps a person in their era, field by field', () => {
    const braided = [
      { id: 'a1', chapterId: 'c1', sortOrder: 0, timelineId: 'mercy', travelDays: 1, inWorldTime: null },
      { id: 'b1', chapterId: 'c2', sortOrder: 0, timelineId: 'compact', travelDays: 1, inWorldTime: null },
      { id: 'b2', chapterId: 'c2', sortOrder: 1, timelineId: 'compact', travelDays: 1, inWorldTime: null },
    ]
    const eras = storyOf(braided, [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }], [{ id: 'mercy', dayOffset: 0 }, { id: 'compact', dayOffset: 113_000 }])
    const records = [said('ilse', 'a1', { currentLocationMarkerId: 'deck', currentMapLayerId: null }), said('ilse', 'b1', { statusNotes: 'a portrait' })]
    expect(personAt(records, 'b2', eras)?.statusNotes).toBe('a portrait')
    expect(personAt(records, 'b2', eras)?.currentLocationMarkerId).toBeNull()
  })

  it('revived marks the record’s own scene, as before', () => {
    const records = [said('anna', 'e2', { isAlive: true, revived: true })]
    expect(personAt(records, 'e2', story)?.revived).toBe(true)
  })
})

describe('peopleAt', () => {
  it('is personAt for each person', () => {
    const records = [
      said('anna', 'e1', { currentLocationMarkerId: 'quay', currentMapLayerId: null }), said('anna', 'e3', { isAlive: false }),
      said('bruno', 'e2', { travelModeId: 'boat' }), said('bruno', 'e4', { inventoryNotes: 'a satchel' }),
    ]
    for (const cursor of [null, ...scenes]) {
      const people = Object.fromEntries(peopleAt(records, cursor, story).map((s) => [s.characterId, state(s)]))
      for (const who of ['anna', 'bruno']) {
        if (cursor === null) continue
        expect(people[who]).toEqual(state(personAt(records.filter((r) => r.characterId === who), cursor, story)))
      }
    }
  })
})

describe('peopleAt with no moment chosen', () => {
  /*
    Each person at their most recently updated record, whole at its scene.
    Field by field instead, a record edited late at an early scene read as
    alive with a death said later — 169 of the Library's 1,864 people.
  */
  it('reads each person at their latest record’s own scene', () => {
    const records = [
      { ...said('anna', 'e1', { currentLocationMarkerId: 'quay', currentMapLayerId: null }), updatedAt: 5 },
      { ...said('anna', 'e4', { isAlive: false }), updatedAt: 2 },
    ]
    expect(state(peopleAt(records, null, story)[0])).toEqual({ isAlive: true, place: 'quay', layer: null, travel: null, status: '', carrying: '' })
  })
})

describe('wholeRecords', () => {
  it('reads each record whole at its own scene', () => {
    const records = [said('anna', 'e1', { currentLocationMarkerId: 'quay', currentMapLayerId: null, travelModeId: 'horse' }), said('anna', 'e3', { statusNotes: 'wounded' })]
    expect(wholeRecords(records, story).map(state)).toEqual([
      { isAlive: true, place: 'quay', layer: null, travel: 'horse', status: '', carrying: '' },
      { isAlive: true, place: 'quay', layer: null, travel: 'horse', status: 'wounded', carrying: '' },
    ])
  })
})

describe('sparseRecords', () => {
  const full = [
    whole('anna', 'e1', { currentLocationMarkerId: 'quay', travelModeId: 'horse' }),
    // A copy of e1, with a wound.
    whole('anna', 'e2', { currentLocationMarkerId: 'quay', travelModeId: 'horse', statusNotes: 'wounded' }),
    // Moved, the wound copied.
    whole('anna', 'e4', { currentLocationMarkerId: 'vault', travelModeId: 'horse', statusNotes: 'wounded' }),
    whole('bruno', 'e3'),
  ]

  it('keeps only the changes, and every scene reads as it did', () => {
    const { records, dropped } = sparseRecords(full, story)
    expect(records.map((r) => Object.keys(r).filter((k) => ['isAlive', 'currentLocationMarkerId', 'travelModeId', 'statusNotes', 'inventoryNotes'].includes(k)).sort())).toEqual([
      ['currentLocationMarkerId', 'travelModeId'],
      ['statusNotes'],
      ['currentLocationMarkerId'],
      [],
    ])
    expect(dropped).toEqual({ alive: 4, place: 2, travel: 3, status: 3, carrying: 4 })
    for (const who of ['anna', 'bruno']) {
      for (const cursor of scenes) {
        const before = resolveCharacterSnapshot(full.filter((r) => r.characterId === who), cursor, story)
        expect(state(personAt(records.filter((r) => r.characterId === who), cursor, story))).toEqual(state(before))
      }
    }
    expect(wholeRecords(records, story).map(state)).toEqual(full.map(state))
  })

  it('run again over records already sparse, takes nothing they say', () => {
    const once = sparseRecords(full, story).records
    expect(sparseRecords(once, story).records).toEqual(once)
    // "Nowhere" at e3, after e2's record that says only her wound, is still a change from the quay she is at.
    const nowhere = [...once, said('anna', 'e3', { currentLocationMarkerId: null, currentMapLayerId: null })]
    expect(sparseRecords(nowhere, story).records[4]).toHaveProperty('currentLocationMarkerId', null)
  })

  it('takes the inventory out of every record: custody has it (Part B1)', () => {
    const { records } = sparseRecords([whole('anna', 'e1', { inventoryItemIds: ['ledger'] })], story)
    expect(records[0]).not.toHaveProperty('inventoryItemIds')
  })

  it('keeps a repeat it is told is a statement', () => {
    const { records, kept } = sparseRecords(full, story, (r, facet) => r.eventId === 'e2' && facet === 'place')
    expect(records[1].currentLocationMarkerId).toBe('quay')
    expect(kept.place).toBe(1)
  })
})

describe('sparseWorld', () => {
  /*
    The header places its cast at the scene's place, even where they were
    there already, so that a later change to an earlier scene does not move
    them (W-2). Such a repeat is kept; a copy of a place at a scene set
    elsewhere, or with the person not in it, goes.
  */
  it('keeps a place repeated where the scene is set and the person is in it, and drops other repeats', () => {
    const scenesHere = scenes.map((id) => ({ id, locationMarkerId: id === 'e2' ? 'quay' : 'vault', involvedCharacterIds: id === 'e3' ? [] : ['anna'] }))
    const records = sparseWorld([
      whole('anna', 'e1', { currentLocationMarkerId: 'quay' }),
      whole('anna', 'e2', { currentLocationMarkerId: 'quay' }),
      whole('anna', 'e4', { currentLocationMarkerId: 'quay' }),
    ], scenesHere, story)
    expect(records.map((r) => r.currentLocationMarkerId)).toEqual(['quay', 'quay', undefined])
  })
})

