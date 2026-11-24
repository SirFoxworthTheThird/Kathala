import { describe, it, expect } from 'vitest'
import {
  localDayKey, shiftDayKey, wordsOnDay, computeStreak, lastNDays, progressSummary,
  daysBetween, recentPace, writingForecast, wroteOnDay, changeOnDay,
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
  it('ignores non-positive days logged before added and cut were kept', () => {
    const logs = [log('2026-07-20', 0), log('2026-07-19', -10)]
    expect(computeStreak(logs, today)).toBe(0)
  })

  // Issue #706, D-2: a day of revision is a day of writing.
  const kept = (date: string, added: number, cut: number): WritingLog => ({ ...log(date, added - cut), id: `${date}:${added}:${cut}`, added, cut })

  it('keeps a day that only cut, and a day whose rewrites came to nothing net', () => {
    const logs = [kept('2026-07-20', 300, 0), kept('2026-07-19', 0, 800), kept('2026-07-18', 150, 150), kept('2026-07-17', 50, 0)]
    expect(computeStreak(logs, today)).toBe(4)
  })

  it('breaks on a day with nothing written or cut, whether it has no row or a row of nothing', () => {
    expect(computeStreak([kept('2026-07-20', 10, 0), kept('2026-07-18', 0, 800)], today)).toBe(1)
    expect(computeStreak([kept('2026-07-20', 10, 0), kept('2026-07-19', 0, 0), kept('2026-07-18', 0, 800)], today)).toBe(1)
  })

  it('reads the days logged before by their net, alongside the days since', () => {
    // 19th: before the log kept added and cut, net above zero; 18th: before, net below; today: since.
    expect(computeStreak([kept('2026-07-20', 0, 40), log('2026-07-19', 30)], today)).toBe(2)
    expect(computeStreak([kept('2026-07-20', 0, 40), log('2026-07-19', -30)], today)).toBe(1)
    // A day with a row from before and one since: either says it was written.
    expect(wroteOnDay([log('2026-07-19', -30), kept('2026-07-19', 0, 5)])).toBe(true)
    expect(wroteOnDay([log('2026-07-19', -30), log('2026-07-19', 20)])).toBe(false)
    expect(wroteOnDay([])).toBe(false)
  })

  it('a blank today does not break a run of revision', () => {
    expect(computeStreak([kept('2026-07-19', 0, 800), kept('2026-07-18', 0, 200)], today)).toBe(2)
  })
})

describe('changeOnDay', () => {
  it('the day’s words added and cut, from the rows that keep them', () => {
    const logs: WritingLog[] = [
      { ...log('2026-07-20', 270), added: 300, cut: 30 },
      { ...log('2026-07-20', 5), id: 'old' },
      { ...log('2026-07-19', -800), added: 0, cut: 800 },
    ]
    expect(changeOnDay(logs, '2026-07-20')).toEqual({ added: 300, cut: 30 })
    expect(changeOnDay(logs, '2026-07-18')).toEqual({ added: 0, cut: 0 })
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

describe('daysBetween', () => {
  it('counts whole days across month/year boundaries', () => {
    expect(daysBetween('2026-07-20', '2026-07-27')).toBe(7)
    expect(daysBetween('2026-07-20', '2026-07-20')).toBe(0)
    expect(daysBetween('2026-07-20', '2026-07-19')).toBe(-1) // past deadline
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })
})

describe('recentPace', () => {
  it('averages net words over the window (including empty days)', () => {
    const today = '2026-07-20'
    const logs = [log('2026-07-20', 700), log('2026-07-19', 0), log('2026-07-18', 700), log('2026-07-14', 0)]
    // 1400 words over a 7-day window = 200/day.
    expect(recentPace(logs, today, 7)).toBe(200)
  })

  it('over the days since the log began, where that is fewer than the window (UX-1-14)', () => {
    const today = '2026-07-20'
    // A book's first day: 18 words is a pace of 18, not 18 ÷ 7.
    expect(recentPace([log('2026-07-20', 18)], today, 7)).toBe(18)
    // Three days in, an empty day among them still counts: 1400 over 3.
    expect(recentPace([log('2026-07-20', 700), log('2026-07-18', 700)], today, 7)).toBeCloseTo(1400 / 3)
    // A log older than the window: the window, as before.
    expect(recentPace([log('2026-07-20', 700), log('2026-06-01', 50)], today, 7)).toBe(100)
    // Nothing logged: no pace.
    expect(recentPace([], today, 7)).toBe(0)
  })
})

describe('writingForecast', () => {
  const today = '2026-07-20'
  // 300 words/day pace over the last week.
  const logs = [
    log('2026-07-20', 300), log('2026-07-19', 300), log('2026-07-18', 300),
    log('2026-07-17', 300), log('2026-07-16', 300), log('2026-07-15', 300), log('2026-07-14', 300),
  ]

  it('computes words/day needed and a projected finish on pace', () => {
    const f = writingForecast({ total: 10000, target: 16000, targetDate: '2026-07-30', logs, todayKey: today })
    expect(f.remaining).toBe(6000)
    expect(f.daysToDeadline).toBe(10)
    expect(f.wordsPerDayNeeded).toBe(600)      // 6000 / 10
    expect(f.recentPacePerDay).toBe(300)
    expect(f.projectedFinish).toBe('2026-08-09') // today + ceil(6000/300)=20 days
    expect(f.onTrack).toBe(false)                 // 08-09 is after the 07-30 deadline
  })

  it('flags on-track when the projection beats the deadline', () => {
    const f = writingForecast({ total: 15400, target: 16000, targetDate: '2026-07-30', logs, todayKey: today })
    expect(f.remaining).toBe(600)
    expect(f.projectedFinish).toBe('2026-07-22') // ceil(600/300)=2 days
    expect(f.onTrack).toBe(true)
  })

  it('projects "done today" when the target is already met', () => {
    const f = writingForecast({ total: 16000, target: 16000, targetDate: null, logs, todayKey: today })
    expect(f.remaining).toBe(0)
    expect(f.projectedFinish).toBe(today)
    expect(f.onTrack).toBeNull() // no deadline to compare
  })

  it('cannot project a finish with no recent progress', () => {
    const f = writingForecast({ total: 1000, target: 90000, targetDate: '2026-07-30', logs: [], todayKey: today })
    expect(f.recentPacePerDay).toBe(0)
    expect(f.projectedFinish).toBeNull()
    expect(f.wordsPerDayNeeded).toBe(8900) // 89000 / 10
  })

  it('needs all remaining words when the deadline is today or past', () => {
    const f = writingForecast({ total: 10000, target: 16000, targetDate: today, logs, todayKey: today })
    expect(f.daysToDeadline).toBe(0)
    expect(f.wordsPerDayNeeded).toBe(6000) // all of it, now
  })

  it('has no target-based numbers without a target', () => {
    const f = writingForecast({ total: 5000, target: null, targetDate: '2026-07-30', logs, todayKey: today })
    expect(f.remaining).toBeNull()
    expect(f.wordsPerDayNeeded).toBeNull()
    expect(f.projectedFinish).toBeNull()
  })
})
