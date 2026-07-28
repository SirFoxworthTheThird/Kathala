import { describe, it, expect } from 'vitest'
import { reorderInsert, assignSortOrders, sortOrderDiff } from '@/lib/corkboard'

describe('reorderInsert', () => {
  const list = ['a', 'b', 'c', 'd']

  it('moves a card later within the same list', () => {
    expect(reorderInsert(list, 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('moves a card earlier within the same list', () => {
    expect(reorderInsert(list, 'd', 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('moving to its own index is a no-op ordering', () => {
    expect(reorderInsert(list, 'b', 1)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('appends when the index is at or past the end', () => {
    expect(reorderInsert(list, 'a', 99)).toEqual(['b', 'c', 'd', 'a'])
    expect(reorderInsert(list, 'a', 3)).toEqual(['b', 'c', 'd', 'a']) // len after removal = 3
  })
  it('clamps negative indices to the front', () => {
    expect(reorderInsert(list, 'c', -5)).toEqual(['c', 'a', 'b', 'd'])
  })
  it('inserts a card arriving from another column (not already present)', () => {
    expect(reorderInsert(['x', 'y'], 'new', 1)).toEqual(['x', 'new', 'y'])
    expect(reorderInsert([], 'new', 0)).toEqual(['new'])
  })
})

describe('assignSortOrders', () => {
  it('numbers ids by their position', () => {
    expect(assignSortOrders(['a', 'b', 'c'])).toEqual([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ])
  })
})

describe('sortOrderDiff', () => {
  it('returns only rows whose sortOrder actually changes', () => {
    // Current: a=0, b=1, c=2. New order [b, a, c] → a and b swap, c unchanged.
    const current = new Map([['a', 0], ['b', 1], ['c', 2]])
    expect(sortOrderDiff(['b', 'a', 'c'], current)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ])
  })
  it('treats an unknown id (new arrival) as a needed write', () => {
    const current = new Map([['x', 0]])
    expect(sortOrderDiff(['x', 'new'], current)).toEqual([{ id: 'new', sortOrder: 1 }])
  })
  it('is empty when nothing moved', () => {
    const current = new Map([['a', 0], ['b', 1]])
    expect(sortOrderDiff(['a', 'b'], current)).toEqual([])
  })
})
