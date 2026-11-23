import { describe, it, expect } from 'vitest'
import {
  plannedEnd, remainingMs, counts, overdue, ranMs, clock, minutesOf, chosenMinutes, sprintHistory,
  SPRINT_GRACE_MS, SPRINT_MINUTES, MAX_SPRINT_MINUTES,
} from '@/lib/sprints'
import type { WritingSprint } from '@/types'

/*
  A sprint's clock and its history (issue #706, sprints-plan.md, D-5 to D-7).
*/

const MIN = 60_000
const T0 = new Date(2026, 10, 23, 9, 0).getTime()

function sprint(over: Partial<WritingSprint> = {}): WritingSprint {
  return {
    id: 's', worldId: 'w', startedAt: T0, plannedMs: 25 * MIN, pausedMs: 0, pausedAt: null, endedAt: null,
    wordsAdded: 0, wordsCut: 0, eventIds: [], createdAt: T0, updatedAt: T0, ...over,
  }
}

describe('the clock', () => {
  it('ends at its start and its length, moved on by every pause', () => {
    expect(plannedEnd(sprint(), T0)).toBe(T0 + 25 * MIN)
    expect(plannedEnd(sprint({ pausedMs: 3 * MIN }), T0)).toBe(T0 + 28 * MIN)
    // A pause going on now moves it on as it goes.
    const paused = sprint({ pausedAt: T0 + 10 * MIN })
    expect(plannedEnd(paused, T0 + 10 * MIN)).toBe(T0 + 25 * MIN)
    expect(plannedEnd(paused, T0 + 14 * MIN)).toBe(T0 + 29 * MIN)
  })

  it('what is left goes down while it runs, holds while paused, and is nothing once ended', () => {
    expect(remainingMs(sprint(), T0 + 5 * MIN)).toBe(20 * MIN)
    const paused = sprint({ pausedAt: T0 + 10 * MIN })
    expect(remainingMs(paused, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(remainingMs(paused, T0 + 50 * MIN)).toBe(15 * MIN)
    expect(remainingMs(sprint(), T0 + 30 * MIN)).toBe(0)
    expect(remainingMs(sprint({ endedAt: T0 + 5 * MIN }), T0 + 5 * MIN)).toBe(0)
  })

  it('reads as a countdown, 0:00 only when the time is out', () => {
    expect(clock(25 * MIN)).toBe('25:00')
    expect(clock(4 * MIN + 7_000)).toBe('4:07')
    expect(clock(400)).toBe('0:01')
    expect(clock(0)).toBe('0:00')
    expect(clock(-5)).toBe('0:00')
  })
})

describe('what counts in it (D-5)', () => {
  const end = T0 + 25 * MIN
  it('a save from its start to its end, and within the grace after', () => {
    const s = sprint()
    expect(counts(s, T0 - 1)).toBe(false)
    expect(counts(s, T0)).toBe(true)
    expect(counts(s, end)).toBe(true)
    expect(counts(s, end + SPRINT_GRACE_MS)).toBe(true)
    expect(counts(s, end + SPRINT_GRACE_MS + 1)).toBe(false)
    expect(SPRINT_GRACE_MS).toBe(2_000)
  })

  it('not while it is paused, nor once it is ended', () => {
    expect(counts(sprint({ pausedAt: T0 + MIN }), T0 + 2 * MIN)).toBe(false)
    expect(counts(sprint({ endedAt: T0 + 2 * MIN, ended: 'stopped' }), T0 + 2 * MIN)).toBe(false)
  })

  it('after a pause, until the end the pause moved on', () => {
    const s = sprint({ pausedMs: 10 * MIN })
    expect(counts(s, end + 5 * MIN)).toBe(true)
    expect(counts(s, end + 10 * MIN + SPRINT_GRACE_MS + 1)).toBe(false)
  })

  it('is overdue once its time and grace are past, and not while paused or ended', () => {
    expect(overdue(sprint(), end + SPRINT_GRACE_MS)).toBe(false)
    expect(overdue(sprint(), end + SPRINT_GRACE_MS + 1)).toBe(true)
    expect(overdue(sprint({ pausedAt: T0 + MIN }), end + 60 * MIN)).toBe(false)
    expect(overdue(sprint({ endedAt: end, ended: 'done' }), end + 60 * MIN)).toBe(false)
  })
})

describe('the time it ran', () => {
  it('pauses left out, a pause still going on too', () => {
    expect(ranMs(sprint({ endedAt: T0 + 25 * MIN }), 0)).toBe(25 * MIN)
    expect(ranMs(sprint({ endedAt: T0 + 30 * MIN, pausedMs: 5 * MIN }), 0)).toBe(25 * MIN)
    expect(ranMs(sprint({ pausedAt: T0 + 10 * MIN }), T0 + 20 * MIN)).toBe(10 * MIN)
    expect(ranMs(sprint(), T0 + 7 * MIN)).toBe(7 * MIN)
  })

  it('in whole minutes, at least one for a sprint that ran', () => {
    expect(minutesOf(25 * MIN)).toBe(25)
    expect(minutesOf(20_000)).toBe(1)
    expect(minutesOf(0)).toBe(0)
  })
})

describe('a length chosen', () => {
  it('the offered lengths, and any whole number of minutes up to the most', () => {
    expect([...SPRINT_MINUTES]).toEqual([15, 25, 45])
    expect(chosenMinutes('10')).toBe(10)
    expect(chosenMinutes(' 90 ')).toBe(90)
    expect(chosenMinutes(String(MAX_SPRINT_MINUTES))).toBe(180)
    for (const no of ['', '0', '-5', '2.5', 'ten', String(MAX_SPRINT_MINUTES + 1)]) expect(chosenMinutes(no)).toBeNull()
  })
})

describe('the history (D-7)', () => {
  const day = (d: number, h: number) => new Date(2026, 10, d, h).getTime()
  const done = (startedAt: number, minutes: number, added: number, cut: number, id: string) =>
    sprint({ id, startedAt, endedAt: startedAt + minutes * MIN, ended: 'done', plannedMs: minutes * MIN, wordsAdded: added, wordsCut: cut })

  it('today’s finished sprints, earliest first, and the last 30 days’ totals', () => {
    const sprints = [
      done(day(23, 15), 25, 400, 30, 'late'),
      done(day(23, 9), 15, 200, 0, 'early'),
      done(day(22, 9), 45, 900, 120, 'yesterday'),
      done(day(24 - 30, 9), 25, 50, 5, 'thirty days ago'),
      done(day(23 - 30, 9), 25, 9999, 9999, 'too long ago'),
      sprint({ id: 'running', startedAt: day(23, 16) }),
    ]
    const h = sprintHistory(sprints, '2026-11-23')
    expect(h.today.map((s) => s.id)).toEqual(['early', 'late'])
    expect(h.last30).toEqual({ sprints: 4, minutes: 25 + 15 + 45 + 25, added: 1550, cut: 155 })
  })

  it('a stopped sprint counts the minutes it ran', () => {
    const s = sprint({ endedAt: T0 + 9 * MIN, ended: 'stopped', wordsAdded: 120 })
    expect(sprintHistory([s], '2026-11-23').last30).toEqual({ sprints: 1, minutes: 9, added: 120, cut: 0 })
  })
})
