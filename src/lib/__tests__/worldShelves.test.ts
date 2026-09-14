import { describe, it, expect } from 'vitest'
import { partitionWorlds, readingLeads } from '@/lib/worldShelves'

const w = (name: string, readingMode?: boolean) => ({ name, readingMode })

describe('partitionWorlds', () => {
  it('separates books being read from worlds being written', () => {
    const { drafts, reading } = partitionWorlds([
      w('My Novel'),
      w('Dracula', true),
      w('Sequel'),
      w('Frankenstein', true),
    ])
    expect(drafts.map((d) => d.name)).toEqual(['My Novel', 'Sequel'])
    expect(reading.map((r) => r.name)).toEqual(['Dracula', 'Frankenstein'])
  })

  it('keeps the order it was given within each shelf', () => {
    // The caller sorts; this only files. Reversing the input has to reverse
    // both shelves, or some hidden ordering has crept in here.
    const input = [w('A'), w('X', true), w('B'), w('Y', true)]
    const forward = partitionWorlds(input)
    const backward = partitionWorlds([...input].reverse())
    expect(forward.drafts.map((d) => d.name)).toEqual(['A', 'B'])
    expect(backward.drafts.map((d) => d.name)).toEqual(['B', 'A'])
    expect(backward.reading.map((r) => r.name)).toEqual(['Y', 'X'])
  })

  it('treats a missing or false flag as a draft', () => {
    // Every world predating reading mode has no flag at all, and a writer's own
    // world has it false. Neither belongs on the reading shelf.
    const { drafts, reading } = partitionWorlds([w('Old'), w('Mine', false), w('Book', true)])
    expect(drafts.map((d) => d.name)).toEqual(['Old', 'Mine'])
    expect(reading.map((r) => r.name)).toEqual(['Book'])
  })

  it('gives back empty shelves rather than nothing', () => {
    expect(partitionWorlds([])).toEqual({ drafts: [], reading: [] })
    expect(partitionWorlds([w('Book', true)]).drafts).toEqual([])
  })
})

describe('readingLeads', () => {
  /*
    A reader coming back the next evening on a 390px phone had to scroll past
    the strapline, five ways to start a world and the demo worlds to reach the
    book they were 7 chapters into — it began 916px down an 844px viewport.
  */
  it('puts the reading shelf first when a book has somebody’s place in it', () => {
    expect(readingLeads([{ id: 'dracula' }], { dracula: 'ev-42' })).toBe(true)
  })

  /*
    The pair, and the reason this is not "always put reading first": this is a
    writing tool, and a demo world that was downloaded and never opened must not
    demote a novelist's own drafts.
  */
  it('leaves drafts leading when no book has been opened', () => {
    expect(readingLeads([{ id: 'dracula' }], {})).toBe(false)
  })

  it('does not count a reader who asked to see the whole book', () => {
    // Clearing the cursor is a full reveal, not a place in the book, and it
    // stores `null` rather than removing the key.
    expect(readingLeads([{ id: 'dracula' }], { dracula: null })).toBe(false)
  })

  it('is false with nothing on the reading shelf at all', () => {
    expect(readingLeads([], { dracula: 'ev-42' })).toBe(false)
  })

  /*
    A downloaded book is now placed at its first scene on arrival, so that its
    cast and lore are not on display before it is read. "No position" therefore
    stopped meaning "never opened", and this shelf briefly started putting an
    unread demo world ahead of a novelist's drafts — which is the exact thing
    the pair above exists to prevent.
  */
  it('does not count a book sitting exactly where it opened', () => {
    expect(readingLeads([{ id: 'dracula' }], { dracula: 'ev-1' }, { dracula: 'ev-1' })).toBe(false)
  })

  it('counts a book the reader has moved on from', () => {
    expect(readingLeads([{ id: 'dracula' }], { dracula: 'ev-42' }, { dracula: 'ev-1' })).toBe(true)
  })

  it('still counts a world that was never seeded, so older shelves keep working', () => {
    // A reader's own draft in reading mode, or a book downloaded before books
    // were placed on arrival: no recorded opening, so any position is progress.
    expect(readingLeads([{ id: 'mine' }], { mine: 'ev-9' }, { dracula: 'ev-1' })).toBe(true)
  })

  it('needs only one book in progress among several', () => {
    expect(readingLeads(
      [{ id: 'dracula' }, { id: 'alice' }],
      { alice: 'ev-1' },
    )).toBe(true)
  })
})
