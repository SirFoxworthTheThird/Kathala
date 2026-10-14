import { dateToDayNumber, dayNumberToDate, formatInWorldDate, weekdayName } from '@/lib/calendar'
import { computeInWorldDays, type ClockRules } from '@/lib/inWorldTime'
import type { Chapter, Timeline, WorldCalendar, WorldEvent } from '@/types'

/**
 * The header's `When:` line — when a scene happens, said where the scene is
 * written (docs/records/scene-time-plan.md).
 *
 * It reads and writes the two fields a scene's time already lives in:
 *
 * - **`travelDays`**, days since the previous scene: `+3 days`, `same day`.
 * - **`inWorldTime`**, a pin: a date on the book's own calendar, or `day 412`
 *   where it has none.
 *
 * Every name a date is read with — months, the days outside them, weekdays,
 * the year's suffix — is the book's own. Nothing about Earth is built in, so
 * `23 Halimath 1418` is a date in a book that has Halimath, as `16 October,
 * 2025` is in one that has October.
 *
 * A pin is a day on the scene's *timeline's* clock, which starts at the
 * timeline's `dayOffset` (`computeInWorldDays`); a date is a day on the
 * calendar. They differ by the offset. The date picker once forgot that, and
 * put a scene in a book starting on day 280 two hundred and eighty days late.
 */

/** What the `When:` line is read against: the scene's time as recorded, and where it sits. */
export interface SceneTime {
  travelDays: number | null
  inWorldTime: number | null
  calendar: WorldCalendar | null
  /** The scene's timeline's start day: a pin counts from it. */
  offset: number
  /**
   * The day of the scene before this one on its timeline, or the timeline's
   * start for its first: where a date with no year is counted on from.
   */
  previousDay: number
}

/** What a `When:` line asks for: days since the previous scene, or a day of the clock. */
export type WhenRead =
  | { days: number }
  /** `exact`: a day number as typed (`day 10.25`); a date names only its day, and keeps the pin's time of day. */
  | { day: number; exact: boolean }
  | { error: string }

/** The scene's time, as its `When:` line says it; undefined when it has none. */
export function formatWhen(t: Pick<SceneTime, 'travelDays' | 'inWorldTime' | 'calendar' | 'offset'>): string | undefined {
  if (t.inWorldTime != null) {
    const day = t.offset + t.inWorldTime
    return t.calendar ? formatInWorldDate(t.calendar, day) : `day ${day}`
  }
  if (t.travelDays != null) return t.travelDays === 0 ? 'same day' : `+${t.travelDays} ${t.travelDays === 1 ? 'day' : 'days'}`
  return undefined
}

const DAYS = /^\+\s*(\d+(?:\.\d+)?)\s*(d|days?|w|weeks?)?$/i
const DAY_NUMBER = /^day\s+(-?\d+(?:\.\d+)?)$/i
const INTEGER = /^-?\d+$/

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Read a `When:` line's text. Never throws: what it cannot read, it says why. */
export function readWhen(text: string, t: Pick<SceneTime, 'calendar' | 'previousDay'>): WhenRead {
  const s = text.trim().replace(/\s+/g, ' ')
  if (/^same day$/i.test(s)) return { days: 0 }
  const days = DAYS.exec(s)
  if (days) {
    const weeks = /^w/i.test(days[2] ?? '')
    // A week is the book's own where it has one: ten days in a book with a ten-day week.
    const length = weeks ? (t.calendar?.week?.days.length || 7) : 1
    return { days: Number(days[1]) * length }
  }
  const number = DAY_NUMBER.exec(s)
  if (number) return { day: Number(number[1]), exact: true }
  if (!t.calendar) {
    return { error: `“${text.trim()}” is not a time this book can read. It has no calendar, so write “+3 days”, “same day” or “day 412”.` }
  }
  return readDate(text.trim(), s, t.calendar, t.previousDay)
}

function readDate(typed: string, s: string, cal: WorldCalendar, previousDay: number): WhenRead {
  const example = formatInWorldDate(cal, previousDay)
  const notADate = { error: `“${typed}” is not a date on this book’s calendar. Write it as “${example}”, or as “+3 days”.` }
  // The year's suffix first: the library's say "(editorial chronology)", and the commas go after.
  let rest = s
  const suffix = cal.yearSuffix?.trim()
  if (suffix && rest.toLowerCase().endsWith(suffix.toLowerCase())) rest = rest.slice(0, -suffix.length).trim()
  rest = rest.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  // The longest name first, so "2 Lithe" is not read as a day of "Lithe" where both are months.
  const months = cal.months
    .map((m, i) => ({ i, name: m.name.trim() }))
    .filter((m) => m.name)
    .sort((a, b) => b.name.length - a.name.length)
  let month = -1
  let before = ''
  let after = ''
  for (const m of months) {
    const at = new RegExp(`(^|\\s)${escape(m.name)}(?=\\s|$)`, 'i').exec(rest)
    if (!at) continue
    month = m.i
    before = rest.slice(0, at.index).trim()
    after = rest.slice(at.index + at[0].length).trim()
    break
  }
  if (month < 0) return notADate

  const weekdays = cal.week?.days ?? []
  const left = before ? before.split(' ') : []
  const right = after ? after.split(' ') : []
  const named = left.length && weekdays.find((w) => w.toLowerCase() === left[0].toLowerCase())
  if (named) left.shift()
  if (left.length > 1 || [...left, ...right].some((n) => !INTEGER.test(n))) return notADate

  const length = Math.max(1, Math.floor(cal.months[month].days))
  const single = !!cal.months[month].intercalary && length === 1
  let day: number
  let year: number | undefined
  if (left.length) {
    if (right.length > 1) return notADate
    day = Number(left[0])
    year = right.length ? Number(right[0]) : undefined
  } else if (single) {
    // "Midyear's Day 1418": a day outside the months that is one day long has no day number.
    if (right.length > 1) return notADate
    day = 1
    year = right.length ? Number(right[0]) : undefined
  } else {
    // "October 2025": a lone number too big for a day is a year with the day left out.
    const yearAlone = right.length === 1 && Number(right[0]) > length
    if (right.length === 0 || right.length > 2 || yearAlone) return { error: `Which day of ${cal.months[month].name}? Write it as “${example}”.` }
    day = Number(right[0])
    year = right.length === 2 ? Number(right[1]) : undefined
  }
  if (day < 1 || day > length) return { error: `${cal.months[month].name} has ${length} ${length === 1 ? 'day' : 'days'}, so “${typed}” is not a date in it.` }

  let at: number
  if (year === undefined) {
    // No year: the first such date on or after the scene before. A date that goes back is a flashback or a slip; either way, say the year.
    const from = Math.floor(previousDay)
    const thisYear = dayNumberToDate(cal, from).year
    at = dateToDayNumber(cal, { year: thisYear, month, day })
    if (at < from) at = dateToDayNumber(cal, { year: thisYear + 1, month, day })
  } else {
    at = dateToDayNumber(cal, { year, month, day })
  }

  if (named) {
    const actual = weekdayName(cal, at)
    if (actual === null) return { error: `${formatInWorldDate(cal, at)} is outside the week, so it has no weekday.` }
    if (actual.toLowerCase() !== named.toLowerCase()) return { error: `${formatInWorldDate(cal, at)} is a ${actual}, not a ${named}.` }
  }
  return { day: at, exact: false }
}

/** What the `When:` line asks to change: the fields to write, or why nothing is. */
export interface WhenPlan {
  update: { travelDays?: number | null; inWorldTime?: number | null } | null
  refused?: string
}

const said = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * The `When:` line as written, against the scene's time as it draws: what to
 * write. The rule of every other line — what is taken off is taken back:
 *
 * - **A date over `+3 days`** pins the scene, and leaves the days since: a pin
 *   overrides them, and taking the pin off later gives back the count.
 * - **`+3 days` over a date** takes the pin off and sets the days since.
 * - **No line** clears whichever it drew.
 * - **What cannot be read** writes nothing, and says why.
 */
export function planWhen(written: string | undefined, t: SceneTime): WhenPlan {
  const drawn = formatWhen(t)
  if (said(written) === said(drawn)) return { update: null }
  if (!said(written)) {
    if (t.inWorldTime != null) return { update: { inWorldTime: null } }
    if (t.travelDays != null) return { update: { travelDays: null } }
    return { update: null }
  }
  const read = readWhen(written!, t)
  if ('error' in read) return { update: null, refused: read.error }
  if ('days' in read) {
    const update: NonNullable<WhenPlan['update']> = {}
    if (t.travelDays !== read.days) update.travelDays = read.days
    if (t.inWorldTime != null) update.inWorldTime = null
    return { update: Object.keys(update).length ? update : null }
  }
  // A date names its day only: the time of day the pin had is kept, as the date picker keeps it (`pinOnDate`).
  const had = t.inWorldTime == null ? 0 : (t.offset + t.inWorldTime) - Math.floor(t.offset + t.inWorldTime)
  const pin = (read.exact ? read.day : read.day + had) - t.offset
  return { update: pin === t.inWorldTime ? null : { inWorldTime: pin } }
}

/**
 * Whether a `When:` line's text could be a time at all, without the calendar
 * to read it: a number in it, `+`, or `same day`. A block that names nobody and
 * nowhere is a header only if this says so; `[ When: does the assize sit? ]` at
 * the top of a draft is a margin note, as any other bracket that asserts nothing
 * is (`namesAnything`).
 */
export function looksLikeTime(text: string): boolean {
  const s = text.trim()
  return /\d/.test(s) || s.startsWith('+') || /^same day$/i.test(s)
}

/**
 * A scene's time and where it sits, for its `When:` line: its own two fields,
 * the book's calendar, its timeline's start, and the day of the scene before
 * it — the last one on its timeline in reading order that is not a flashback,
 * whose date is its own and not where the story is.
 */
export function sceneTimeOf(
  event: Pick<WorldEvent, 'id' | 'timelineId' | 'travelDays' | 'inWorldTime'>,
  book: {
    events: ReadonlyArray<WorldEvent>
    chapters: ReadonlyArray<Chapter>
    timeline: Pick<Timeline, 'id' | 'dayOffset'> | undefined
    calendar: WorldCalendar | null
    rules?: ClockRules
  },
): SceneTime {
  const offset = book.timeline?.dayOffset ?? 0
  const mine = book.events.filter((e) => e.timelineId === event.timelineId)
  const days = computeInWorldDays(mine, [...book.chapters], [{ id: event.timelineId, dayOffset: offset }], book.rules ?? {})
  const number = new Map(book.chapters.map((c) => [c.id, c.number]))
  const ordered = [...mine].sort((a, b) => ((number.get(a.chapterId) ?? 0) - (number.get(b.chapterId) ?? 0)) || a.sortOrder - b.sortOrder)
  const at = ordered.findIndex((e) => e.id === event.id)
  const before = ordered.slice(0, Math.max(0, at)).reverse().find((e) => !e.isFlashback)
  return {
    travelDays: event.travelDays ?? null,
    inWorldTime: event.inWorldTime ?? null,
    calendar: book.calendar,
    offset,
    previousDay: before ? days.get(before.id) ?? offset : offset,
  }
}
