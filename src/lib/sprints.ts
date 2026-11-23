import type { WritingSprint } from '@/types'
import { localDayKey, shiftDayKey } from './writingProgress'

/*
  A writing sprint's clock and its history (issue #706, sprints-plan.md).
  Pure: the sprint is a record, and every figure is worked out from it and the
  time, so a reload loses nothing (D-6).
*/

/** The lengths offered, in minutes. */
export const SPRINT_MINUTES = [15, 25, 45] as const
/** The longest a chosen length may be, in minutes. */
export const MAX_SPRINT_MINUTES = 180

/**
 * How long after its planned end a save still counts (D-5). The editors are
 * told to save at the end, and that save lands a moment after it; a second is
 * the editors' own wait before saving, so two covers both.
 */
export const SPRINT_GRACE_MS = 2_000

/** When the sprint's time runs out, counting the pause going on now. */
export function plannedEnd(s: WritingSprint, now: number): number {
  const pausing = s.pausedAt !== null ? Math.max(0, now - s.pausedAt) : 0
  return s.startedAt + s.plannedMs + s.pausedMs + pausing
}

/** What is left of it, never below nothing; held still while it is paused. */
export function remainingMs(s: WritingSprint, now: number): number {
  if (s.endedAt !== null) return 0
  return Math.max(0, plannedEnd(s, now) - now)
}

/** Whether a save made now counts in the sprint: it runs, is not paused, and its time (with the grace) is not past. */
export function counts(s: WritingSprint, now: number): boolean {
  return s.endedAt === null && s.pausedAt === null && now >= s.startedAt && now <= plannedEnd(s, now) + SPRINT_GRACE_MS
}

/** A sprint still open whose time and grace have run out: its page closed, or the end is being written now. */
export function overdue(s: WritingSprint, now: number): boolean {
  return s.endedAt === null && s.pausedAt === null && now > plannedEnd(s, now) + SPRINT_GRACE_MS
}

/** The time it ran, pauses left out. */
export function ranMs(s: WritingSprint, now: number): number {
  const end = s.endedAt ?? now
  const pausing = s.pausedAt !== null ? Math.max(0, end - s.pausedAt) : 0
  return Math.max(0, end - s.startedAt - s.pausedMs - pausing)
}

/** `25:00`, `4:07`, `0:00`: a countdown, rounded up so it reads 0:00 only when the time is out. */
export function clock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Whole minutes, at least one for a sprint that ran at all. */
export function minutesOf(ms: number): number {
  return ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60_000))
}

/** A length typed as minutes, or null when it is not one. */
export function chosenMinutes(value: string): number | null {
  const n = Number(value.trim())
  return Number.isInteger(n) && n >= 1 && n <= MAX_SPRINT_MINUTES ? n : null
}

export interface SprintTotals {
  sprints: number
  minutes: number
  added: number
  cut: number
}

export interface SprintHistory {
  /** Today's finished sprints, earliest first. */
  today: WritingSprint[]
  /** The last 30 days, today among them. */
  last30: SprintTotals
}

/** The dashboard's history (D-7): today's sprints, and the last 30 days' totals. Only finished sprints. */
export function sprintHistory(sprints: readonly WritingSprint[], todayKey: string): SprintHistory {
  const from = shiftDayKey(todayKey, -29)
  const done = sprints.filter((s) => s.endedAt !== null).sort((a, b) => a.startedAt - b.startedAt)
  const today = done.filter((s) => localDayKey(s.startedAt) === todayKey)
  const last30: SprintTotals = { sprints: 0, minutes: 0, added: 0, cut: 0 }
  for (const s of done) {
    const day = localDayKey(s.startedAt)
    if (day < from || day > todayKey) continue
    last30.sprints++
    last30.minutes += minutesOf(ranMs(s, s.endedAt!))
    last30.added += s.wordsAdded
    last30.cut += s.wordsCut
  }
  return { today, last30 }
}
