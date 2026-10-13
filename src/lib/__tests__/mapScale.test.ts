import { describe, it, expect } from 'vitest'
import { pixelDist, pathPixelLength, formatDistance, scaleLabel } from '@/lib/mapScale'

// ── pixelDist ─────────────────────────────────────────────────────────────────

describe('pixelDist', () => {
  it('returns 0 for identical points', () => {
    expect(pixelDist(5, 5, 5, 5)).toBe(0)
  })

  it('computes horizontal distance', () => {
    expect(pixelDist(0, 0, 3, 0)).toBe(3)
  })

  it('computes vertical distance', () => {
    expect(pixelDist(0, 0, 0, 4)).toBe(4)
  })

  it('computes diagonal distance (3-4-5 triangle)', () => {
    expect(pixelDist(0, 0, 3, 4)).toBe(5)
  })

  it('works with negative coordinates', () => {
    expect(pixelDist(-1, -1, 2, 3)).toBe(5)
  })

  it('is symmetric', () => {
    const d1 = pixelDist(10, 20, 40, 60)
    const d2 = pixelDist(40, 60, 10, 20)
    expect(d1).toBeCloseTo(d2)
  })

  it('computes fractional distances correctly', () => {
    expect(pixelDist(0, 0, 1, 1)).toBeCloseTo(Math.SQRT2)
  })
})

// ── pathPixelLength ───────────────────────────────────────────────────────────

describe('pathPixelLength', () => {
  it('returns 0 for an empty path', () => {
    expect(pathPixelLength([])).toBe(0)
  })

  it('returns 0 for a single-point path', () => {
    expect(pathPixelLength([[10, 20]])).toBe(0)
  })

  it('computes length of a two-point path', () => {
    expect(pathPixelLength([[0, 0], [3, 4]])).toBe(5)
  })

  it('sums segments for a multi-point path', () => {
    // (0,0)→(3,4) = 5, (3,4)→(3,4+4=8) = 4, total = 9
    expect(pathPixelLength([[0, 0], [3, 4], [3, 8]])).toBeCloseTo(9)
  })

  it('handles a path that doubles back', () => {
    // A→B→A: length should be 2 * dist(A,B)
    const dist = pixelDist(0, 0, 6, 8) // 10
    expect(pathPixelLength([[0, 0], [6, 8], [0, 0]])).toBeCloseTo(2 * dist)
  })

  it('treats a path of all identical points as zero-length', () => {
    expect(pathPixelLength([[5, 5], [5, 5], [5, 5]])).toBe(0)
  })
})

// ── formatDistance ────────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('shows one decimal place when distance < 10', () => {
    // 50px / 10px-per-unit = 5 → "5.0 km"
    expect(formatDistance(50, 10, 'km')).toBe('5.0 km')
  })

  it('rounds to an integer when distance >= 10', () => {
    // 100px / 5px-per-unit = 20 → "20 km"
    expect(formatDistance(100, 5, 'km')).toBe('20 km')
  })

  it('uses the exact boundary of 10 (rounded, not decimal)', () => {
    // 100px / 10px-per-unit = 10 → "10 km" (not "10.0 km")
    expect(formatDistance(100, 10, 'km')).toBe('10 km')
  })

  it('uses the provided unit label', () => {
    expect(formatDistance(50, 10, 'miles')).toBe('5.0 miles')
    expect(formatDistance(50, 10, 'leagues')).toBe('5.0 leagues')
  })

  it('handles fractional pixel-per-unit values', () => {
    // 15px / 2px-per-unit = 7.5 → "7.5 units"
    expect(formatDistance(15, 2, 'units')).toBe('7.5 units')
  })

  it('handles very large distances', () => {
    // 10000px / 10px-per-unit = 1000 → "1000 km"
    expect(formatDistance(10000, 10, 'km')).toBe('1000 km')
  })

  it('rounds correctly just below 10', () => {
    // 95px / 10px-per-unit = 9.5 → "9.5 units"
    expect(formatDistance(95, 10, 'units')).toBe('9.5 units')
  })
})

describe('scaleLabel (writer run 8)', () => {
  it('says one of the unit, not "1 miles"', () => {
    expect(scaleLabel(289.6, 'miles')).toBe('1 mile = 290 px')
    expect(scaleLabel(40, 'days travel')).toBe("1 day's travel = 40 px")
    // A unit that is the same for one: as it is.
    expect(scaleLabel(12, 'km')).toBe('1 km = 12 px')
  })
})
