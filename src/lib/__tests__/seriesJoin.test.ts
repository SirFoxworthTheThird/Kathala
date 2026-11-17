import { describe, it, expect } from 'vitest'
import { offerMatches, suggestedPairs, pairsProblem, joinIds, rewrite, filledFrom, nameKey, type Rows } from '@/lib/seriesJoin'

/*
  Joining a book to a series (issue #698, part 3): which of the book's copies are
  offered as which of the series' records, what follows from the pairs a writer
  confirms, and how every reference to a copy is pointed at the series' record.
*/

const person = (id: string, name: string, aliases: string[] = [], extra: Record<string, unknown> = {}) => ({ id, worldId: 'w', name, aliases, ...extra })
const named = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, worldId: 'w', name, ...extra })

describe('what is offered', () => {
  it('a copy is offered the series’ record of the same name, whatever its case, accents or spacing', () => {
    expect(nameKey('  Élodie   Marsh ')).toBe('elodie marsh')
    const bible: Rows = { characters: [person('anna', 'Anna Petrovna'), person('bo', 'Bo')] }
    const book: Rows = { characters: [person('anna2', 'anna  petrovna'), person('cara', 'Cara')] }
    const offers = offerMatches(bible, book)
    expect(offers.map((o) => [o.copy.name, o.suggested])).toEqual([['anna  petrovna', 'anna'], ['Cara', null]])
    // Cara has no record in the series: she is offered nothing, and joins it as she is.
    expect(offers.find((o) => o.copy.id === 'cara')?.candidates).toEqual([])
  })

  it('a person is offered by an alias, either way round, after a match by name', () => {
    const bible: Rows = { characters: [person('kit', 'Katherine', ['Kit']), person('kat', 'Kat')] }
    const book: Rows = { characters: [person('k2', 'Kit'), person('k3', 'Kat', ['Katherine'])] }
    const offers = offerMatches(bible, book)
    const of = (id: string) => offers.find((o) => o.copy.id === id)!
    expect(of('k2')).toMatchObject({ suggested: 'kit', candidates: [{ id: 'kit', by: 'alias' }] })
    // Kat's own name is the series' Kat; that she is also called Katherine makes Katherine a candidate, second.
    expect(of('k3').candidates.map((c) => [c.id, c.by])).toEqual([['kat', 'name'], ['kit', 'alias']])
    expect(of('k3').suggested).toBe('kat')
  })

  it('only a person is matched by alias: an item’s tags are not names', () => {
    const bible: Rows = { items: [named('i1', 'Lantern', { aliases: ['Lamp'] })] }
    const book: Rows = { items: [named('i2', 'Lamp')] }
    expect(offerMatches(bible, book)[0].candidates).toEqual([])
  })

  it('two of the same name in the series are both offered, and neither is suggested', () => {
    const bible: Rows = { locationMarkers: [named('p1', 'The Inn'), named('p2', 'The Inn')] }
    const book: Rows = { locationMarkers: [named('p3', 'the inn')] }
    const [offer] = offerMatches(bible, book)
    expect(offer.candidates.map((c) => c.id).sort()).toEqual(['p1', 'p2'])
    expect(offer.suggested).toBeNull()
  })

  it('one record is suggested for one copy only; the copy by name has the stronger claim', () => {
    const bible: Rows = { characters: [person('kit', 'Kit')] }
    const book: Rows = { characters: [person('a', 'Katherine', ['Kit']), person('b', 'Kit')] }
    const offers = offerMatches(bible, book)
    expect(offers.find((o) => o.copy.id === 'b')?.suggested).toBe('kit')
    expect(offers.find((o) => o.copy.id === 'a')?.suggested).toBeNull()
    expect(suggestedPairs(offers)).toEqual(new Map([['b', 'kit']]))
  })

  it('a lore page is offered by its title, and kinds are never crossed', () => {
    const bible: Rows = { lorePages: [{ id: 'l1', worldId: 'w', title: 'The Tithe' }], items: [named('i1', 'The Tithe')] }
    const book: Rows = { lorePages: [{ id: 'l2', worldId: 'w', title: 'the tithe' }] }
    const offers = offerMatches(bible, book)
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({ table: 'lorePages', suggested: 'l1' })
  })
})

describe('what a writer may confirm', () => {
  const bible: Rows = { characters: [person('anna', 'Anna'), person('bo', 'Bo')] }
  const book: Rows = { characters: [person('a2', 'Anna'), person('a3', 'Anna', [], { description: 'twin' })] }
  const offers = offerMatches(bible, book)

  it('two copies taken for one record is refused, naming them', () => {
    expect(pairsProblem(offers, new Map([['a2', 'anna'], ['a3', 'anna']]))).toMatch(/Anna and Anna are both matched to Anna/)
  })

  it('a pair to a record that is not one of its candidates is refused, as is one for a copy the book has not got', () => {
    expect(pairsProblem(offers, new Map([['a2', 'bo']]))).toMatch(/not matched to one of the series/)
    expect(pairsProblem(offers, new Map([['zz', 'anna']]))).toMatch(/does not have/)
    expect(pairsProblem(offers, new Map([['a2', 'anna']]))).toBeNull()
  })
})

describe('what follows from the pairs', () => {
  it('a relationship, membership, stance or label the series already has is its own; one it has not joins it', () => {
    const bible: Rows = {
      relationships: [{ id: 'r1', worldId: 's', characterAId: 'anna', characterBId: 'bo' }],
      factionMemberships: [{ id: 'm1', worldId: 's', factionId: 'guild', characterId: 'anna' }],
      factionRelationships: [{ id: 'f1', worldId: 's', factionAId: 'guild', factionBId: 'crown' }],
      mapAnnotations: [{ id: 'n1', worldId: 's', mapLayerId: 'coast', text: 'Here be dragons' }],
    }
    const book: Rows = {
      // Written the other way round: still the same pair.
      relationships: [{ id: 'r2', worldId: 'b', characterAId: 'bo2', characterBId: 'anna2' }, { id: 'r3', worldId: 'b', characterAId: 'anna2', characterBId: 'cara' }],
      factionMemberships: [{ id: 'm2', worldId: 'b', factionId: 'guild2', characterId: 'anna2' }],
      factionRelationships: [{ id: 'f2', worldId: 'b', factionAId: 'crown2', factionBId: 'guild2' }],
      mapAnnotations: [{ id: 'n2', worldId: 'b', mapLayerId: 'coast2', text: 'here be  DRAGONS' }, { id: 'n3', worldId: 'b', mapLayerId: 'coast2', text: 'Reefs' }],
    }
    const pairs = new Map([['anna2', 'anna'], ['bo2', 'bo'], ['guild2', 'guild'], ['crown2', 'crown'], ['coast2', 'coast']])
    const ids = joinIds(bible, book, pairs)
    expect(Object.fromEntries(ids)).toEqual({ ...Object.fromEntries(pairs), r2: 'r1', m2: 'm1', f2: 'f1', n2: 'n1' })
  })

  it('a relationship between a matched person and one not matched is not taken for one between two matched', () => {
    const bible: Rows = { relationships: [{ id: 'r1', worldId: 's', characterAId: 'anna', characterBId: 'bo' }] }
    const book: Rows = { relationships: [{ id: 'r2', worldId: 'b', characterAId: 'anna2', characterBId: 'bo2' }] }
    expect(joinIds(bible, book, new Map([['anna2', 'anna']])).has('r2')).toBe(false)
  })
})

describe('a row rewritten', () => {
  const anna = 'V1StGXR8_Z5jdHi6B-myT'
  const annaHere = 'k3T9pQ2xLmN7vB4cR8sW1'
  const key = 'Uakgb_J5m9g-0JDMbcJqL'
  const keyHere = 'aB3dE5gH7jK9mN1pQ3sT5'
  const ids = new Map([[annaHere, anna], [keyHere, key], ['bo2', 'bo']])

  it('every reference: a field, a list, a nested point, an object’s key, and an id inside a longer one', () => {
    const row = {
      id: `custody:${keyHere}:scene1:${annaHere}`,
      worldId: 'b',
      itemId: keyHere,
      holderId: annaHere,
      involvedCharacterIds: [annaHere, 'bo2', 'cara'],
      waypoints: [{ markerId: annaHere, x: 1 }, 'raw'],
      weights: { [annaHere]: 2 },
      issueId: `dead-in-event-${annaHere}-scene1`,
    }
    expect(rewrite(row, ids)).toEqual({
      id: `custody:${key}:scene1:${anna}`,
      worldId: 'b',
      itemId: key,
      holderId: anna,
      involvedCharacterIds: [anna, 'bo', 'cara'],
      waypoints: [{ markerId: anna, x: 1 }, 'raw'],
      weights: { [anna]: 2 },
      issueId: `dead-in-event-${anna}-scene1`,
    })
  })

  it('a short id is rewritten only whole, so the words that contain it are left alone', () => {
    expect(rewrite({ name: 'bo2', note: 'bo2 and the bo2-ish', words: 'Bo2' }, ids)).toEqual({ name: 'bo', note: 'bo2 and the bo2-ish', words: 'Bo2' })
  })

  it('an id is rewritten only where it stands alone, not as part of a longer id', () => {
    expect(rewrite(`${annaHere}x`, ids)).toBe(`${annaHere}x`)
    expect(rewrite(`x${annaHere}`, ids)).toBe(`x${annaHere}`)
  })

  it('an image’s bytes, a date, and other things not plain data are left as they are', () => {
    const blob = new Blob(['x'])
    const when = new Date(0)
    const out = rewrite({ data: blob, when }, ids)
    expect(out.data).toBe(blob)
    expect(out.when).toBe(when)
  })
})

describe('what a matched copy adds to the series’ record', () => {
  it('a field the series has left empty, and its aliases and tags; never the series’ own words', () => {
    const theirs = { id: 'anna', worldId: 's', name: 'Anna', description: '', portraitImageId: null, aliases: ['Annie'], tags: ['lead'], color: '#f00' }
    const copy = { id: 'a2', worldId: 'b', name: 'Anna', description: 'Older now.', portraitImageId: 'img', aliases: ['annie', 'The Widow', 'Anna'], tags: ['Lead', 'widow'], color: '#00f' }
    expect(filledFrom(theirs, copy)).toEqual({ ...theirs, description: 'Older now.', portraitImageId: 'img', aliases: ['Annie', 'The Widow'], tags: ['lead', 'widow'] })
  })

  it('nothing, where the copy adds nothing; and a scene it names is never brought over', () => {
    const theirs = { id: 'r1', worldId: 's', description: 'old friends', startEventId: null }
    expect(filledFrom(theirs, { id: 'r2', worldId: 'b', description: 'friends', startEventId: 'scene-in-book-two' })).toBeNull()
  })
})
