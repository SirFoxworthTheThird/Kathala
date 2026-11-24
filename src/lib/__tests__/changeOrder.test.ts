import { describe, it, expect } from 'vitest'
import { inReadingOrder, whereInScene } from '@/lib/changeOrder'

/*
  UX-2-23: Changes listed the change made with tracking off (paragraph 2)
  above the two tracked changes in paragraph 1, the order bringing the file
  in keeps them in.
*/
describe('inReadingOrder', () => {
  const prose = 'The bell had already gone when she climbed the stair.\n\nLow water was at a quarter past, and the well-known city knew it.'
  const untracked = { id: 'u', before: 'well-known', prefix: 'and the ', suffix: ' city' }
  const first = { id: 't1', before: 'already', prefix: 'The bell had ', suffix: ' gone' }
  const second = { id: 't2', before: '', prefix: 'climbed the ', suffix: 'stair.' }

  it('by where each is in the scene, not the order they came in', () => {
    expect(inReadingOrder([untracked, first, second], prose).map((c) => c.id)).toEqual(['t1', 't2', 'u'])
  })

  it('found by fewer of the words beside it, where another change took some', () => {
    // Its words before, as the file kept them, end in a word since changed.
    expect(whereInScene(prose, { before: 'well-known', prefix: 'quarter to, and the ', suffix: ' city' })).toBe(prose.indexOf('well-known'))
  })

  it('one not found goes after those that are, in the order it came; with no prose yet, nothing moves', () => {
    const lost = { id: 'x', before: 'nowhere', prefix: 'not ', suffix: ' here' }
    expect(inReadingOrder([lost, untracked, first], prose).map((c) => c.id)).toEqual(['t1', 'u', 'x'])
    expect(inReadingOrder([untracked, first], undefined).map((c) => c.id)).toEqual(['u', 't1'])
  })
})
