import { describe, it, expect } from 'vitest'
import { sessionWordDelta, focusStats, sessionGoalPercent } from '@/lib/focusSession'

describe('sessionWordDelta', () => {
  it('is the current minus the starting word count', () => {
    expect(sessionWordDelta(100, 250)).toBe(150)
    expect(sessionWordDelta(100, 100)).toBe(0)
    expect(sessionWordDelta(100, 60)).toBe(-40) // trimmed
  })
})

describe('focusStats', () => {
  it('reports current, net delta, and non-negative added', () => {
    expect(focusStats(200, 500)).toEqual({ current: 500, sessionDelta: 300, added: 300 })
  })
  it('clamps added to 0 when trimming below the start', () => {
    expect(focusStats(500, 400)).toEqual({ current: 400, sessionDelta: -100, added: 0 })
  })
})

describe('sessionGoalPercent', () => {
  it('is the percentage of added words toward the goal', () => {
    expect(sessionGoalPercent(150, 300)).toBe(50)
  })
  it('clamps at 100 when the goal is met or exceeded', () => {
    expect(sessionGoalPercent(400, 300)).toBe(100)
  })
  it('is 0 with no goal', () => {
    expect(sessionGoalPercent(150, 0)).toBe(0)
  })
})
