import { describe, it, expect } from 'vitest'
import { itemNameCollision } from '@/lib/itemNameCollision'

const items = [
  { id: 'slate', name: 'The tally-slate' },
  { id: 'letter', name: "Cathe’s letter" },
]

describe('itemNameCollision', () => {
  it('finds nothing for a name the world does not have', () => {
    expect(itemNameCollision('The ninth bell', items, [])).toEqual({ kind: 'none' })
  })

  it('finds nothing for a blank name', () => {
    expect(itemNameCollision('   ', items, [])).toEqual({ kind: 'none' })
  })

  it('names the existing item, and keeps its own spelling', () => {
    expect(itemNameCollision('the TALLY-slate', items, [])).toEqual({
      kind: 'existing', id: 'slate', name: 'The tally-slate',
    })
  })

  it('collapses whitespace on both sides', () => {
    expect(itemNameCollision('  The   tally-slate ', items, [])).toMatchObject({ kind: 'existing', id: 'slate' })
  })

  it('distinguishes an item this character already holds', () => {
    // Absence and presence in one test: the same name, the same catalogue, and
    // only the inventory differs.
    expect(itemNameCollision('The tally-slate', items, ['letter'])).toMatchObject({ kind: 'existing' })
    expect(itemNameCollision('The tally-slate', items, ['slate'])).toMatchObject({ kind: 'held', id: 'slate' })
  })

  it('matches a name only in full, not as a prefix', () => {
    expect(itemNameCollision('The tally', items, [])).toEqual({ kind: 'none' })
    expect(itemNameCollision('The tally-slate of Anhalt', items, [])).toEqual({ kind: 'none' })
  })
})
