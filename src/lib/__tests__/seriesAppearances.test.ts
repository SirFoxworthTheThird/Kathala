import { describe, it, expect } from 'vitest'
import { scenesOf, seriesAppearances, firstElsewhere, booksSentence, deleteInSeriesLine, seenFrom, metIn, type BookRows } from '@/lib/seriesAppearances'

/*
  Where a series' people, items and places appear, book by book (issue #698,
  part 4): what a delete names, what a list says beside one from a later book,
  and what a book sees of one kept to another.
*/

const book = (id: string, name: string, seriesIndex: number, rows: Partial<Omit<BookRows, 'book'>> = {}): BookRows => ({
  book: { id, name, seriesIndex },
  events: [],
  characterSnapshots: [],
  itemCustody: [],
  itemSnapshots: [],
  itemPlacements: [],
  locationSnapshots: [],
  ...rows,
})

describe('the scenes a book tells of each entity in', () => {
  it('a person on stage, on the phone, as the point of view, or with a state there; an item on the scene, held, placed or in a condition; a place a scene is set in or whose state is said', () => {
    const rows = book('b', 'B', 1, {
      events: [
        { id: 's1', involvedCharacterIds: ['anna'], remoteCharacterIds: ['bo'], povCharacterId: 'cara', involvedItemIds: ['key'], locationMarkerId: 'inn' },
        { id: 's2' },
      ],
      characterSnapshots: [{ characterId: 'dan', eventId: 's2' }],
      itemCustody: [{ itemId: 'lamp', eventId: 's2' }],
      itemSnapshots: [{ itemId: 'rope', eventId: 's2' }],
      itemPlacements: [{ itemId: 'coin', eventId: 's2' }],
      locationSnapshots: [{ locationMarkerId: 'mill', eventId: 's2' }],
    })
    const seen = scenesOf(rows)
    expect([...seen.keys()].sort()).toEqual(['anna', 'bo', 'cara', 'coin', 'dan', 'inn', 'key', 'lamp', 'mill', 'rope'])
    expect([...seen.get('anna')!]).toEqual(['s1'])
  })

  it('counts a scene once, however many ways it tells of them; and a record at a scene the book has not got not at all', () => {
    const rows = book('b', 'B', 1, {
      events: [{ id: 's1', involvedCharacterIds: ['anna'], povCharacterId: 'anna' }],
      characterSnapshots: [{ characterId: 'anna', eventId: 's1' }, { characterId: 'anna', eventId: 'gone' }],
    })
    expect(scenesOf(rows).get('anna')?.size).toBe(1)
  })

  it('a person only mentioned is not counted: the reader has not met them', () => {
    const rows = book('b', 'B', 1, { events: [{ id: 's1', mentionedCharacterIds: ['anna'] } as never] })
    expect(scenesOf(rows).has('anna')).toBe(false)
  })
})

describe('across the books of a series', () => {
  const one = book('one', 'The Salt Road', 1, { events: [{ id: 'a1', involvedCharacterIds: ['anna'] }, { id: 'a2', involvedCharacterIds: ['anna'] }] })
  const two = book('two', 'The Second Road', 2, { events: [{ id: 'b1', involvedCharacterIds: ['anna', 'cara'] }] })
  const three = book('three', 'The Last Road', 3, { events: [{ id: 'c1', involvedCharacterIds: ['cara', 'dan'] }] })
  // Given out of order: reading order is the series', not the list's.
  const all = seriesAppearances([three, one, two])

  it('each entity’s books, in reading order, with the scenes in each', () => {
    expect(all.get('anna')).toEqual([
      { bookId: 'one', bookName: 'The Salt Road', index: 1, scenes: 2 },
      { bookId: 'two', bookName: 'The Second Road', index: 2, scenes: 1 },
    ])
    expect(all.get('cara')?.map((a) => a.bookId)).toEqual(['two', 'three'])
  })

  it('beside one a book does not tell of, the book they first appear in; nothing beside one it does, or one no book tells of', () => {
    expect(firstElsewhere(all.get('cara'), 'one')?.bookName).toBe('The Second Road')
    expect(firstElsewhere(all.get('dan'), 'one')?.bookName).toBe('The Last Road')
    expect(firstElsewhere(all.get('anna'), 'one')).toBeNull()
    expect(firstElsewhere(all.get('cara'), 'two')).toBeNull()
    expect(firstElsewhere(undefined, 'one')).toBeNull()
  })
})

describe('what a delete says', () => {
  const a = (bookName: string, scenes: number) => ({ bookId: bookName, bookName, index: 1, scenes })

  it('names every book, and each one’s scenes', () => {
    expect(booksSentence([a('One', 1)])).toBe('One (1 scene)')
    expect(booksSentence([a('One', 2), a('Two', 1)])).toBe('One (2 scenes) and Two (1 scene)')
    expect(booksSentence([a('One', 2), a('Two', 1), a('Three', 4)])).toBe('One (2 scenes), Two (1 scene) and Three (4 scenes)')
  })

  it('says it takes them from every book, in the words of what is deleted', () => {
    expect(deleteInSeriesLine('Anna', 'character', [a('One', 2), a('Two', 1)])).toBe(
      'Anna appears in One (2 scenes) and Two (1 scene). Deleting removes them, and their states, from every book in the series.',
    )
    expect(deleteInSeriesLine('Brass Key', 'item', [a('One', 1)])).toBe(
      'Brass Key appears in One (1 scene). Deleting removes it, and who holds it and its condition, from every book in the series.',
    )
    expect(deleteInSeriesLine('Harbour', 'place', [])).toBe('Harbour is not in any book of the series yet. Deleting removes it from the series.')
    expect(deleteInSeriesLine('Cara', 'character', [])).toBe('Cara is not in any book of the series yet. Deleting removes them from the series.')
  })
})

describe('what a book sees of the series’ bible', () => {
  it('not one kept to another book; one kept to it, and one shared, yes', () => {
    const rows = [{ id: 'a' }, { id: 'b', onlyInBook: 'two' }, { id: 'c', onlyInBook: 'one' }, { id: 'd', onlyInBook: null }]
    expect(seenFrom(rows, 'one').map((r) => r.id)).toEqual(['a', 'c', 'd'])
    expect(seenFrom(rows, 'two').map((r) => r.id)).toEqual(['a', 'b', 'd'])
  })
})

describe('what a reader of the earlier books has met', () => {
  it('everyone and everything the books tell of, and each region whose state they say; nothing they do not', () => {
    const one = book('one', 'One', 1, { events: [{ id: 'a1', involvedCharacterIds: ['anna'], locationMarkerId: 'inn' }], itemCustody: [{ itemId: 'key', eventId: 'a1' }] })
    const two = book('two', 'Two', 2, { events: [{ id: 'b1', involvedCharacterIds: ['bo'] }] })
    expect([...metIn([one, two], [{ regionId: 'marsh' }])].sort()).toEqual(['anna', 'bo', 'inn', 'key', 'marsh'])
    expect(metIn([]).size).toBe(0)
  })
})
