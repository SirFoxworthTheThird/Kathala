import { describe, it, expect } from 'vitest'
import { worldUnits, effectiveSpeed, daysNeeded, assessTravel } from '@/lib/travelTime'

describe('worldUnits', () => {
  it('converts pixels to world units by the scale', () => {
    expect(worldUnits(100, 10)).toBe(10) // 100px at 10px/unit = 10 units
  })
  it('returns 0 when there is no usable scale', () => {
    expect(worldUnits(100, 0)).toBe(0)
  })
})

describe('effectiveSpeed', () => {
  it('applies the route multiplier', () => {
    expect(effectiveSpeed(20, 'road')).toBe(30)   // ×1.5
    expect(effectiveSpeed(20, 'trail')).toBe(12)  // ×0.6
  })
  it('is the base speed with no route', () => {
    expect(effectiveSpeed(20)).toBe(20)
    expect(effectiveSpeed(20, null)).toBe(20)
  })
})

describe('daysNeeded', () => {
  it('is distance over speed', () => {
    expect(daysNeeded(100, 25)).toBe(4)
  })
  it('is Infinity at zero speed', () => {
    expect(daysNeeded(100, 0)).toBe(Infinity)
  })
})

describe('assessTravel', () => {
  it('is feasible when the days fit', () => {
    // 300px ÷ 10px/unit = 30 units; on foot 20/day → 1.5 days; 3 days available.
    const r = assessTravel({ pixelDistance: 300, scalePixelsPerUnit: 10, baseSpeedPerDay: 20, daysAvailable: 3 })
    expect(r.distanceUnits).toBe(30)
    expect(r.daysNeeded).toBe(1.5)
    expect(r.feasible).toBe(true)
    expect(r.shortfallDays).toBe(0)
  })

  it('is infeasible with a whole-day shortfall when there is not enough time', () => {
    // 30 units at 20/day = 1.5 days needed, but only 1 day available → short by 1.
    const r = assessTravel({ pixelDistance: 300, scalePixelsPerUnit: 10, baseSpeedPerDay: 20, daysAvailable: 1 })
    expect(r.feasible).toBe(false)
    expect(r.shortfallDays).toBe(1)
  })

  it('a road makes a journey faster (and can flip it to feasible)', () => {
    const onFoot = assessTravel({ pixelDistance: 600, scalePixelsPerUnit: 10, baseSpeedPerDay: 20, daysAvailable: 2 })
    const byRoad = assessTravel({ pixelDistance: 600, scalePixelsPerUnit: 10, baseSpeedPerDay: 20, routeType: 'road', daysAvailable: 2 })
    // 60 units: on foot 3 days (short); by road at 30/day = 2 days (fits).
    expect(onFoot.feasible).toBe(false)
    expect(byRoad.feasible).toBe(true)
  })

  it('reports an infinite shortfall at zero speed', () => {
    const r = assessTravel({ pixelDistance: 100, scalePixelsPerUnit: 10, baseSpeedPerDay: 0, daysAvailable: 5 })
    expect(r.feasible).toBe(false)
    expect(r.shortfallDays).toBe(Infinity)
  })
})
