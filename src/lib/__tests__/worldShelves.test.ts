import { describe, it, expect } from 'vitest'
import { partitionWorlds } from '@/lib/worldShelves'

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
