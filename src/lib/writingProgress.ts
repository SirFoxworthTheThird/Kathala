import type { WritingLog } from '@/types'

/**
 * Pure helpers for the writing-progress dashboard: turning a world's per-day
 * word log into a streak, a recent-days series, and a burndown against a target.
 * All dates are local `YYYY-MM-DD` keys so a day boundary matches the writer's
 * clock, not UTC.
 */

/** Local calendar day (`YYYY-MM-DD`) for a timestamp. */
export function localDayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift a `YYYY-MM-DD` key by `deltaDays` (negative = earlier), staying local. */
export function shiftDayKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return localDayKey(dt.getTime())
}

/** Net words logged for a given day key (0 if none). */
export function wordsOnDay(logs: WritingLog[], dayKey: string): number {
  return logs.filter((l) => l.date === dayKey).reduce((sum, l) => sum + l.words, 0)
}

/**
 * Consecutive days, ending today (or yesterday if today has nothing yet), with a
 * positive net word count. A blank today doesn't break a run you're mid-way
 * through — it only stops counting once a *past* day is empty.
 */
export function computeStreak(logs: WritingLog[], todayKey: string): number {
  const byDay = new Map<string, number>()
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.words)

  let cursor = todayKey
  // If today has no productive log yet, start counting from yesterday.
  if ((byDay.get(cursor) ?? 0) <= 0) cursor = shiftDayKey(cursor, -1)

  let streak = 0
  while ((byDay.get(cursor) ?? 0) > 0) {
    streak++
    cursor = shiftDayKey(cursor, -1)
  }
  return streak
}

/** The last `n` days (oldest→newest) ending at `todayKey`, missing days as 0. */
export function lastNDays(logs: WritingLog[], n: number, todayKey: string): { date: string; words: number }[] {
  const byDay = new Map<string, number>()
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.words)

  const out: { date: string; words: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = shiftDayKey(todayKey, -i)
    out.push({ date, words: byDay.get(date) ?? 0 })
  }
  return out
}

export interface ProgressSummary {
  /** Current total manuscript words (sum of all scene word counts). */
  total: number
  /** The book-level target, or null when none is set. */
  target: number | null
  /** Words still to write to hit the target (never negative), or null. */
  remaining: number | null
  /** Completion as a 0–100 percent, or null when no target. */
  percent: number | null
}

/** Burndown of current total words against an optional book target. */
export function progressSummary(total: number, target: number | null | undefined): ProgressSummary {
  if (!target || target <= 0) return { total, target: null, remaining: null, percent: null }
  const remaining = Math.max(0, target - total)
  const percent = Math.min(100, Math.round((total / target) * 100))
  return { total, target, remaining, percent }
}
