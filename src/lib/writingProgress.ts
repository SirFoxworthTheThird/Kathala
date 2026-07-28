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

/** Whole-day difference `toKey - fromKey` (local midnights). Negative if `toKey` is earlier. */
export function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const a = new Date(fy, fm - 1, fd).getTime()
  const b = new Date(ty, tm - 1, td).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** Trailing average net words/day over the last `windowDays` calendar days (incl. today). */
export function recentPace(logs: WritingLog[], todayKey: string, windowDays = 7): number {
  const w = Math.max(1, windowDays)
  const sum = lastNDays(logs, w, todayKey).reduce((s, d) => s + d.words, 0)
  return sum / w
}

export interface WritingForecast {
  /** Words still to write to hit the target, or null when no target. */
  remaining: number | null
  /** Calendar days from today to the deadline (negative if past), or null. */
  daysToDeadline: number | null
  /** Words/day needed to finish by the deadline, or null. */
  wordsPerDayNeeded: number | null
  /** Trailing average net words/day. */
  recentPacePerDay: number
  /** Projected finish date (`YYYY-MM-DD`) from recent pace, or null when it can't be projected. */
  projectedFinish: string | null
  /** Whether the projected finish lands on or before the deadline, or null. */
  onTrack: boolean | null
}

/**
 * Turns the word log + target + deadline into a forecast: how many words/day are
 * needed, the current pace, and a projected finish date. Pure.
 */
export function writingForecast({
  total, target, targetDate, logs, todayKey, paceWindow = 7,
}: {
  total: number
  target: number | null | undefined
  targetDate: string | null | undefined
  logs: WritingLog[]
  todayKey: string
  paceWindow?: number
}): WritingForecast {
  const remaining = progressSummary(total, target).remaining
  const recentPacePerDay = recentPace(logs, todayKey, paceWindow)
  const daysToDeadline = targetDate ? daysBetween(todayKey, targetDate) : null

  let wordsPerDayNeeded: number | null = null
  if (remaining !== null && daysToDeadline !== null) {
    wordsPerDayNeeded = daysToDeadline > 0 ? Math.ceil(remaining / daysToDeadline) : remaining
  }

  let projectedFinish: string | null = null
  if (remaining !== null) {
    if (remaining === 0) projectedFinish = todayKey
    else if (recentPacePerDay > 0) projectedFinish = shiftDayKey(todayKey, Math.ceil(remaining / recentPacePerDay))
  }

  const onTrack = projectedFinish && targetDate ? projectedFinish <= targetDate : null

  return { remaining, daysToDeadline, wordsPerDayNeeded, recentPacePerDay, projectedFinish, onTrack }
}
