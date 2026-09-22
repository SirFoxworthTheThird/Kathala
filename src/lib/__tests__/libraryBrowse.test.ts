import { describe, it, expect } from 'vitest'
import { browseLibrary, groupByProse, sortableTitle } from '@/lib/libraryBrowse'

/**
 * The catalogue shipped in the order it was curated — modern fantasy, then
 * gothic, then the classics — which is a shape only its author can see. A
 * reader looking for a book they have in mind needs it filed.
 */

const entry = (title: string, author = 'Somebody') => ({ title, author })

/* A slice of the real catalogue, keeping what makes ordering hard. */
const CATALOGUE = [
  entry('The Woman in White', 'Wilkie Collins'),
  entry('Dracula', 'Bram Stoker'),
  entry('A Tale of Two Cities', 'Charles Dickens'),
  entry('Treasure Island', 'Robert Louis Stevenson'),
  entry('The Three Musketeers', 'Alexandre Dumas'),
  entry('Jane Eyre', 'Charlotte Brontë'),
  entry('An Ordinary Evening', 'Nobody'),
]

const titles = (rows: { title: string }[]) => rows.map((r) => r.title)

describe('sortableTitle', () => {
  it('files past a leading article', () => {
    expect(sortableTitle('The Woman in White')).toBe('Woman in White')
    expect(sortableTitle('A Tale of Two Cities')).toBe('Tale of Two Cities')
    expect(sortableTitle('An Ordinary Evening')).toBe('Ordinary Evening')
  })

  it('leaves a title that merely starts with those letters alone', () => {
    // "Theodore" is not "The", and "Andromeda" is not "An" — the space matters.
    expect(sortableTitle('Theodore Rex')).toBe('Theodore Rex')
    expect(sortableTitle('Andromeda')).toBe('Andromeda')
    expect(sortableTitle('Anna Karenina')).toBe('Anna Karenina')
  })

  it('keeps an article that is not at the front', () => {
    expect(sortableTitle('The Picture of The Artist')).toBe('Picture of The Artist')
  })

  it('is case-insensitive about the article', () => {
    expect(sortableTitle('THE ODYSSEY')).toBe('ODYSSEY')
  })

  it('leaves a title that is only an article', () => {
    // Nothing to file under otherwise.
    expect(sortableTitle('The')).toBe('The')
  })
})

describe('browseLibrary', () => {
  it('orders alphabetically by the filing title', () => {
    expect(titles(browseLibrary(CATALOGUE, ''))).toEqual([
      'Dracula',
      'Jane Eyre',
      'An Ordinary Evening',
      'A Tale of Two Cities',
      'The Three Musketeers',
      'Treasure Island',
      'The Woman in White',
    ])
  })

  /*
    The reason the article rule exists, stated as a test: a plain sort puts five
    of these seven under T and A, in an order no reader could predict.
  */
  it('does not simply sort the raw titles', () => {
    const plain = [...CATALOGUE].map((e) => e.title).sort((a, b) => a.localeCompare(b))
    expect(titles(browseLibrary(CATALOGUE, ''))).not.toEqual(plain)
  })

  /*
    Its own array, deliberately out of order — not the shared CATALOGUE.
    Sharing it made this test order-dependent and therefore useless: the tests
    above call `browseLibrary(CATALOGUE, …)` first, so a version that sorted in
    place had already left CATALOGUE sorted by the time this ran, and sorting it
    again changed nothing. The mutation sweep is what showed that up.
  */
  it('does not mutate the catalogue it is given', () => {
    const own = [entry('Zoo'), entry('Apple'), entry('Middle')]
    const original = titles(own)
    browseLibrary(own, '')
    expect(titles(own)).toEqual(original)
  })

  it('finds a book by part of its title', () => {
    expect(titles(browseLibrary(CATALOGUE, 'muske'))).toEqual(['The Three Musketeers'])
  })

  it('finds a book by its author', () => {
    expect(titles(browseLibrary(CATALOGUE, 'stoker'))).toEqual(['Dracula'])
  })

  it('ignores accents, so "bronte" finds Brontë', () => {
    expect(titles(browseLibrary(CATALOGUE, 'bronte'))).toEqual(['Jane Eyre'])
  })

  it('searches past the article too', () => {
    // Someone typing the full title should still find it.
    expect(titles(browseLibrary(CATALOGUE, 'the woman'))).toEqual(['The Woman in White'])
  })

  it('keeps the results in order', () => {
    // Both match on "The", and both file past it — so the order is Three,
    // Woman, which is not the order either the catalogue or the raw titles
    // would give.
    expect(titles(browseLibrary(CATALOGUE, 'the'))).toEqual([
      'The Three Musketeers', 'The Woman in White',
    ])
  })

  it('returns nothing for a query nothing matches', () => {
    expect(browseLibrary(CATALOGUE, 'zzzz')).toEqual([])
  })

  it('treats a blank query as no filter at all', () => {
    expect(browseLibrary(CATALOGUE, '   ')).toHaveLength(CATALOGUE.length)
  })

  it('survives an empty catalogue', () => {
    expect(browseLibrary([], 'anything')).toEqual([])
  })

  /*
    Two books of the same name are ordered by who wrote them rather than by
    whichever the catalogue happened to list first.
  */
  it('breaks a title tie on the author', () => {
    const twins = [entry('The Return', 'Zola'), entry('The Return', 'Andrić')]
    expect(browseLibrary(twins, '').map((e) => e.author)).toEqual(['Andrić', 'Zola'])
  })
})

/**
 * The shelf splits into what can be read and what can only be explored.
 *
 * Thirty-nine of the shipped worlds carry the book's whole text; seven carry
 * structure only, because the novel is in copyright or the world was built as a
 * reference. Before the catalogue said which was which, the only way to find
 * out was to download one and look.
 */
describe('groupByProse', () => {
  const book = (title: string, hasProse?: boolean) => ({ title, author: 'Somebody', hasProse })

  it('splits a catalogue that says which is which', () => {
    const group = groupByProse([
      book('Dracula', true),
      book('Neuromancer', false),
      book('Jane Eyre', true),
    ])
    expect(group.grouped).toBe(true)
    expect(titles(group.readable)).toEqual(['Dracula', 'Jane Eyre'])
    expect(titles(group.structureOnly)).toEqual(['Neuromancer'])
  })

  /*
    The half that matters more than the split itself. `hasProse` is optional, so
    an older catalogue — or a desktop app pointed at one — has nothing to split
    on. Filing every book under "structure only" would tell a reader that none
    of forty-six books can be read: a confident answer, and exactly wrong.

    Paired with the case above deliberately: a `grouped` that is always false
    passes one of these and a `grouped` that is always true passes the other.
  */
  it('does not split a catalogue where a single entry is silent', () => {
    const group = groupByProse([
      book('Dracula', true),
      book('Neuromancer', false),
      book('An Older Book'),
    ])
    expect(group.grouped).toBe(false)
    expect(titles(group.readable)).toEqual(['Dracula', 'Neuromancer', 'An Older Book'])
    expect(group.structureOnly).toEqual([])
  })

  it('keeps the order it was given, and does not touch the input', () => {
    const shelf = [book('Treasure Island', true), book('Dracula', true)]
    const frozen = titles(shelf)
    const group = groupByProse(shelf)
    expect(titles(group.readable)).toEqual(['Treasure Island', 'Dracula'])
    expect(titles(shelf)).toEqual(frozen)
  })

  it('answers a shelf with nothing to read without pretending it cannot tell', () => {
    const group = groupByProse([book('Neuromancer', false), book('The Two Towers', false)])
    expect(group.grouped).toBe(true)
    expect(group.readable).toEqual([])
    expect(titles(group.structureOnly)).toEqual(['Neuromancer', 'The Two Towers'])
  })
})
