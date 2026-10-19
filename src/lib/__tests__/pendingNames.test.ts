import { describe, it, expect } from 'vitest'
import { stillToAsk } from '../pendingNames'

describe('stillToAsk', () => {
  const pending = [{ id: 'a', name: 'Orsato' }, { id: 'b', name: 'Lucia Zen' }, { id: 'c', name: 'Sanudo' }]
  it('asks about those who exist and have no other names yet, in the order they were made', () => {
    expect(stillToAsk(pending, [{ id: 'c', aliases: [] }, { id: 'a' }, { id: 'b', aliases: [] }]).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })
  it('not about somebody given other names since, nor somebody gone', () => {
    expect(stillToAsk(pending, [{ id: 'a', aliases: ['Orsato the Elder'] }, { id: 'b', aliases: [] }]).map((p) => p.id)).toEqual(['b'])
  })
})
