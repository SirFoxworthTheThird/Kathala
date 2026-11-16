import { describe, it, expect } from 'vitest'
import { recentlyEdited } from '@/lib/recentlyEdited'

/** The dashboard's Recently edited (round-trip-plan.md, T6, W-C). */
describe('recentlyEdited', () => {
  const events = [
    { id: 'a', title: 'A', updatedAt: 100 },
    { id: 'b', title: 'B', updatedAt: 300 },
    { id: 'c', title: 'C', updatedAt: 200 },
  ]

  it('a scene whose prose was written since counts as edited then, though its record is older', () => {
    const out = recentlyEdited(events, [{ eventId: 'a', updatedAt: 500 }])
    expect(out.map((e) => [e.id, e.editedAt])).toEqual([['a', 500], ['b', 300], ['c', 200]])
  })

  it('a record changed after its prose counts by the record; scenes with no prose by their record', () => {
    const out = recentlyEdited(events, [{ eventId: 'b', updatedAt: 50 }])
    expect(out.map((e) => [e.id, e.editedAt])).toEqual([['b', 300], ['c', 200], ['a', 100]])
  })

  it('keeps only as many as asked, newest first', () => {
    expect(recentlyEdited(events, [], 2).map((e) => e.id)).toEqual(['b', 'c'])
  })
})
