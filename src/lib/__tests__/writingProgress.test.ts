import { describe, it, expect } from 'vitest'
import {
  localDayKey, shiftDayKey, wordsOnDay, computeStreak, lastNDays, progressSummary,
} from '@/lib/writingProgress'
import type { WritingLog } from '@/types'

function log(date: string, words: number): WritingLog {
  return { id: date + words, worldId: 'w', date, words, createdAt: 0, updatedAt: 0 }
}

describe('localDayKey / shiftDayKey', () => {
  it('formats a local day key', () => {
    // Build a local date and check the key matches its local Y-M-D.
    const d = new Date(2026, 6, 20, 15, 30) // 20 Jul 2026, local
    expect(localDayKey(d.getTime())).toBe('2026-07-20')
  })
  it('shifts across month and year boundaries', () => {
    expect(shiftDayKey('2026-07-20', -1)).toBe('2026-07-19')
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDayKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('wordsOnDay', () => {
  it('sums all rows for that day, 0 when none', () => {
    const logs = [log('2026-07-20', 100), log('2026-07-20', 50), log('2026-07-19', 10)]
    expect(wordsOnDay(logs, '2026-07-20')).toBe(150)
    expect(wordsOnDay(logs, '2026-07-18')).toBe(0)
  })
})

describe('computeStreak', () => {
  const today = '2026-07-20'
  it('counts consecutive productive days ending today', () => {
    const logs = [log('2026-07-20', 500), log('2026-07-19', 300), log('2026-07-18', 200)]
    expect(computeStreak(logs, today)).toBe(3)
  })
  it('still counts when today is blank but yesterday was productive', () => {
    const logs = [log('2026-07-19', 300), log('2026-07-18', 200)]
    expect(computeStreak(logs, today)).toBe(2)
  })
  it('breaks on an empty past day', () => {
    const logs = [log('2026-07-20', 500), log('2026-07-18', 200)] // 19th missing
    expect(computeStreak(logs, today)).toBe(1)
  })
  it('is 0 when neither today nor yesterday has words', () => {
    const logs = [log('2026-07-17', 500)]
    expect(computeStreak(logs, today)).toBe(0)
  })
  it('ignores non-positive days', () => {
    const logs = [log('2026-07-20', 0), log('2026-07-19', -10)]
    expect(computeStreak(logs, today)).toBe(0)
  })
})

describe('lastNDays', () => {
  it('returns n days oldest→newest, filling gaps with 0', () => {
    const logs = [log('2026-07-20', 500), log('2026-07-18', 200)]
    const series = lastNDays(logs, 3, '2026-07-20')
    expect(series).toEqual([
      { date: '2026-07-18', words: 200 },
      { date: '2026-07-19', words: 0 },
      { date: '2026-07-20', words: 500 },
    ])
  })
})

describe('progressSummary', () => {
  it('computes remaining and percent against a target', () => {
    expect(progressSummary(45000, 90000)).toEqual({ total: 45000, target: 90000, remaining: 45000, percent: 50 })
  })
  it('clamps overshoot to 100% and 0 remaining', () => {
    expect(progressSummary(100000, 90000)).toEqual({ total: 100000, target: 90000, remaining: 0, percent: 100 })
  })
  it('returns nulls when no usable target', () => {
    expect(progressSummary(1000, null)).toEqual({ total: 1000, target: null, remaining: null, percent: null })
    expect(progressSummary(1000, 0)).toEqual({ total: 1000, target: null, remaining: null, percent: null })
  })
})
