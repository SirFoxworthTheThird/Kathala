import { describe, it, expect } from 'vitest'
import { orderFacts, type FactOrder } from '@/lib/factOrder'

const facts = [
  { id: 'a', title: 'Zephyr is alive' },
  { id: 'b', title: 'Marren lied' },
  { id: 'c', title: 'The bell was cast twice' },
  { id: 'd', title: 'Nobody knows this' },
]

const pos: Record<string, number | null> = { a: 30, b: 10, c: 20, d: null }
const known: Record<string, number> = { a: 1, b: 5, c: 5, d: 0 }

const run = (order: FactOrder) =>
  orderFacts(facts, order, {
    firstRevealPos: (id) => pos[id] ?? null,
    knownCount: (id) => known[id] ?? 0,
  }).map((f) => f.id)

describe('orderFacts', () => {
  it('leaves the added order alone, and does not copy the array to do it', () => {
    expect(run('added')).toEqual(['a', 'b', 'c', 'd'])
    expect(orderFacts(facts, 'added', { firstRevealPos: () => null, knownCount: () => 0 }))
      .toBe(facts)
  })

  it('orders by when the fact first gets out', () => {
    expect(run('story')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('puts a fact nobody knows at the end, not the beginning', () => {
    // "Not yet revealed" is not "revealed first", which is what sorting a null
    // as zero would claim.
    expect(run('story').at(-1)).toBe('d')
  })

  it('orders by how widely known, most first', () => {
    expect(run('known')).toEqual(['b', 'c', 'a', 'd'])
  })

  it('orders by name', () => {
    // Marren, Nobody, The bell, Zephyr.
    expect(run('name')).toEqual(['b', 'd', 'c', 'a'])
  })

  it('is stable: ties keep the order they were added in', () => {
    // b and c are both known by five. Reversing the input must reverse them,
    // and nothing else — which a non-stable comparator would not guarantee.
    const reversed = [...facts].reverse()
    const ids = orderFacts(reversed, 'known', {
      firstRevealPos: (id) => pos[id] ?? null,
      knownCount: (id) => known[id] ?? 0,
    }).map((f) => f.id)
    expect(ids).toEqual(['c', 'b', 'a', 'd'])
  })

  it('does not shuffle a roster where nothing is known yet', () => {
    const ids = orderFacts(facts, 'known', {
      firstRevealPos: () => null,
      knownCount: () => 0,
    }).map((f) => f.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })
})
