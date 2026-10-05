import { describe, it, expect } from 'vitest'
import { freeSpot } from '../freeSpot'

const map = { imageWidth: 1000, imageHeight: 800 }

describe('freeSpot', () => {
  it('is the centre of an empty map', () => {
    expect(freeSpot(map, [])).toEqual({ x: 500, y: 400 })
  })
  it('is somewhere else once the centre is taken, and clear of every pin', () => {
    const first = freeSpot(map, [])
    const second = freeSpot(map, [first])
    const third = freeSpot(map, [first, second])
    expect(second).not.toEqual(first)
    expect(third).not.toEqual(first)
    expect(third).not.toEqual(second)
    // Clear by at least the gap (6% of 800 = 48px), and still near the middle.
    for (const [a, b] of [[first, second], [first, third], [second, third]]) {
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(48)
    }
    expect(Math.hypot(third.x - 500, third.y - 400)).toBeLessThanOrEqual(48 * 2)
  })
  it('stays on the map', () => {
    const tiny = { imageWidth: 60, imageHeight: 60 }
    const spot = freeSpot(tiny, [{ x: 30, y: 30 }])
    expect(spot.x).toBeGreaterThanOrEqual(0)
    expect(spot.x).toBeLessThanOrEqual(60)
  })
})
