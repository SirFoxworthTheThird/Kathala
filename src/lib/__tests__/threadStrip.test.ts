import { describe, it, expect } from 'vitest'
import { threadStrip, THREAD_STRIP_LIMIT } from '../threadStrip'

const threads = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}` }))
const ids = (list: { id: string }[]) => list.map((t) => t.id)

describe('threadStrip', () => {
  it('shows everything, and folds nothing, up to the limit', () => {
    const s = threadStrip(threads(THREAD_STRIP_LIMIT), null, false)
    expect(s.shown).toHaveLength(THREAD_STRIP_LIMIT)
    expect(s.hidden).toBe(0)
  })

  it('stops growing past the limit', () => {
    // The whole point: nine threads and ninety cost the same vertical space.
    expect(threadStrip(threads(9), null, false).shown).toHaveLength(6)
    expect(threadStrip(threads(90), null, false).shown).toHaveLength(6)
    expect(threadStrip(threads(9), null, false).hidden).toBe(3)
    expect(threadStrip(threads(90), null, false).hidden).toBe(84)
  })

  it('keeps the selected thread on screen even from the folded tail', () => {
    // A strip that filtered by something it did not show would be worse than a
    // long one.
    const s = threadStrip(threads(9), 't8', false)
    expect(ids(s.shown)).toContain('t8')
    // At most one pill longer than the limit, so it is still bounded...
    expect(s.shown).toHaveLength(7)
    // ...and the fold count stays honest about what is left.
    expect(s.hidden).toBe(2)
  })

  it('does not duplicate a selection that was already visible', () => {
    const s = threadStrip(threads(9), 't2', false)
    expect(ids(s.shown)).toEqual(['t0', 't1', 't2', 't3', 't4', 't5'])
    expect(s.hidden).toBe(3)
  })

  it('shows all of them once expanded', () => {
    const s = threadStrip(threads(9), null, true)
    expect(s.shown).toHaveLength(9)
    expect(s.hidden).toBe(0)
  })

  it('keeps story order rather than moving the selection to the front', () => {
    expect(ids(threadStrip(threads(9), 't7', false).shown))
      .toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't7'])
  })
})
