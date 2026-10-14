import type { CalendarEra, CalendarWeek, WorldCalendar, InWorldDate } from '@/types'

/**
 * Maps the in-world day clock (see `computeInWorldDays`) onto a custom calendar
 * and computes character ages. Day 0 of the clock is day 1 of the first month
 * of `startYear`. Pure and dependency-free.
 */

/** Total days in one year of this calendar. */
export function daysPerYear(cal: WorldCalendar): number {
  return cal.months.reduce((sum, m) => sum + Math.max(1, Math.floor(m.days)), 0)
}

/** Convert an absolute in-world day number to a calendar date. */
export function dayNumberToDate(cal: WorldCalendar, dayNumber: number): InWorldDate {
  const dpy = daysPerYear(cal)
  if (dpy <= 0 || cal.months.length === 0) return { year: cal.startYear, month: 0, day: 1 }
  // The story clock may use fractions to preserve time-of-day ordering. A
  // calendar date represents the containing whole day, so 10.75 and 10.1 both
  // belong to day 10 rather than producing fractional grid-cell keys.
  const wholeDay = Math.floor(dayNumber)
  const yearOffset = Math.floor(wholeDay / dpy)
  let dayInYear = wholeDay - yearOffset * dpy // 0-based, always in [0, dpy)
  let month = 0
  for (let i = 0; i < cal.months.length; i++) {
    const len = Math.max(1, Math.floor(cal.months[i].days))
    if (dayInYear < len) { month = i; break }
    dayInYear -= len
  }
  return { year: cal.startYear + yearOffset, month, day: dayInYear + 1 }
}

/** Convert a calendar date back to an absolute in-world day number. */
export function dateToDayNumber(cal: WorldCalendar, date: InWorldDate): number {
  const dpy = daysPerYear(cal)
  const month = Math.max(0, Math.min(cal.months.length - 1, date.month))
  let daysBeforeMonth = 0
  for (let i = 0; i < month; i++) daysBeforeMonth += Math.max(1, Math.floor(cal.months[i].days))
  return (date.year - cal.startYear) * dpy + daysBeforeMonth + (Math.max(1, date.day) - 1)
}

/**
 * The day a scene is pinned to when a date is picked for it: that date's day,
 * keeping the time of day the pin had. The clock uses fractions to order
 * scenes within a day (`computeInWorldDays`), and a date names only the day.
 */
export function pinOnDate(cal: WorldCalendar, date: InWorldDate, previous: number | null): number {
  const timeOfDay = previous === null ? 0 : previous - Math.floor(previous)
  return dateToDayNumber(cal, date) + timeOfDay
}

/*
  ── Eras ──────────────────────────────────────────────────────────────────
  The calendar's years inside are one signed count; `startYear` is one of
  them, and everything that orders or subtracts years uses it. An era is how a
  stretch of that count is *said*: 19 BBY, 1 BC, 1 TA. So these turn a year
  inside into its number and label and back, and nothing else knows eras exist.
*/

/** The eras as they are read: the first runs back without end; only it may count down, and only towards an era after it. */
function erasOf(cal: WorldCalendar): CalendarEra[] {
  const eras = cal.eras ?? []
  return eras.map((e, i) => ({
    ...e,
    counts: i === 0 && e.counts === 'down' && eras.length > 1 && eras[1].start !== undefined ? 'down' : 'up',
  }))
}

/** Which era a year inside falls in, as an index into `cal.eras`; null without eras. */
export function eraIndexOf(cal: WorldCalendar, year: number): number | null {
  const eras = erasOf(cal)
  if (eras.length === 0) return null
  let at = 0
  for (let i = 1; i < eras.length; i++) if (eras[i].start !== undefined && eras[i].start! <= year) at = i
  return at
}

/**
 * A year inside, as its era says it. Without eras, the year itself and the
 * suffix — "2025", "1418 (editorial chronology)" — as dates always were.
 */
export function yearLabel(cal: WorldCalendar, year: number): { number: number; label: string } {
  const at = eraIndexOf(cal, year)
  if (at === null) return { number: year, label: cal.yearSuffix?.trim() ?? '' }
  const eras = erasOf(cal)
  const era = eras[at]
  if (era.counts === 'down') return { number: era.first + (eras[1].start! - 1 - year), label: era.label }
  // An era with no start numbers years as the calendar counts them inside.
  return { number: era.first + (year - (era.start ?? era.first)), label: era.label }
}

/**
 * The year inside that a number in era `index` is. Read as written: a number
 * past the era's end — 0 BC — lands in the era beside it, which is where a
 * picker's spinner going one too far should take it. `yearFromLabel` is the
 * strict reading.
 */
export function yearInEra(cal: WorldCalendar, index: number, number: number): number {
  const eras = erasOf(cal)
  const era = eras[index]
  if (!era) return number
  if (era.counts === 'down') return eras[1].start! - 1 - (number - era.first)
  return (era.start ?? era.first) + (number - era.first)
}

/**
 * The year inside that "19 BBY" names, or null when that era has no such
 * year: no 0 BC, no 3500 of an age that ended at 3441. The label is matched
 * ignoring case. Without eras, only the bare number, or the suffix, names a year.
 */
export function yearFromLabel(cal: WorldCalendar, number: number, label: string): number | null {
  const eras = erasOf(cal)
  const wanted = label.trim().toLowerCase()
  if (eras.length === 0) return wanted === '' || wanted === (cal.yearSuffix?.trim().toLowerCase() ?? '') ? number : null
  const index = eras.findIndex((e) => e.label.trim().toLowerCase() === wanted)
  if (index < 0) return null
  const year = yearInEra(cal, index, number)
  return eraIndexOf(cal, year) === index ? year : null
}

/** A year as dates say it: "19 BBY", "2025". */
export function formatYear(cal: WorldCalendar, year: number): string {
  if (!cal.eras?.length) return `${year}${cal.yearSuffix ? ` ${cal.yearSuffix}` : ''}`
  const { number, label } = yearLabel(cal, year)
  return label ? `${number} ${label}` : String(number)
}

/** BC and AD: BC counting down to 1, AD up from 1, and no year 0 between — the year inside 0 is 1 BC, as astronomers count. */
export function bcAdEras(): CalendarEra[] {
  return [
    { label: 'BC', counts: 'down', first: 1 },
    { label: 'AD', start: 1, counts: 'up', first: 1 },
  ]
}

/** The year era `index` begins after, as the era before it says it: the Third Age begins after 3441 of the Second. */
export function eraBeginsAfter(cal: WorldCalendar, index: number): number | null {
  const start = cal.eras?.[index]?.start
  return index > 0 && start !== undefined ? yearLabel(cal, start - 1).number : null
}

/** Era `index` set to begin after year `number` of the era before it. */
export function withEraBeginningAfter(cal: WorldCalendar, index: number, number: number): WorldCalendar {
  if (!cal.eras || index < 1 || index >= cal.eras.length) return cal
  const start = yearInEra(cal, index - 1, number) + 1
  return { ...cal, eras: cal.eras.map((e, i) => (i === index ? { ...e, start } : e)) }
}

/**
 * Another era, after the last: beginning the year after the story's start
 * year, or after the last era's start where that is later, and counting up
 * from 1, as a new age does. The first one added keeps every year's number:
 * an era with no start says the year as the calendar counts it.
 */
export function withEraAdded(cal: WorldCalendar): WorldCalendar {
  const eras = cal.eras ?? []
  if (eras.length === 0) return { ...cal, eras: [{ label: cal.yearSuffix?.trim() || 'Era 1', counts: 'up', first: 1 }] }
  const last = eras[eras.length - 1].start
  const start = Math.max(cal.startYear + 1, last === undefined ? -Infinity : last + 1)
  return { ...cal, eras: [...eras, { label: `Era ${eras.length + 1}`, start, counts: 'up', first: 1 }] }
}

/** Human-readable date, e.g. "12 Firstmonth, 998 AC". Falls back gracefully. */
export function formatInWorldDate(cal: WorldCalendar, dayNumber: number): string {
  const d = dayNumberToDate(cal, dayNumber)
  const month = cal.months[d.month]
  const monthName = month?.name || `Month ${d.month + 1}`
  // A single day outside the months is a name, not a position in something:
  // "Midyear's Day, 1419", never "1 Midyear's Day, 1419". Longer intercalary
  // runs keep their number, because that is exactly what "2 Lithe" means.
  const bare = month?.intercalary && Math.max(1, Math.floor(month.days)) === 1
  return bare
    ? `${monthName}, ${formatYear(cal, d.year)}`
    : `${d.day} ${monthName}, ${formatYear(cal, d.year)}`
}

/**
 * Whole years between a birth date and the given in-world day. Counts birthdays
 * passed (so it's correct even with variable-length years). Returns null when
 * the day is before the birth date.
 */
export function ageInYears(cal: WorldCalendar, birth: InWorldDate, atDayNumber: number): number | null {
  const at = dayNumberToDate(cal, atDayNumber)
  let years = at.year - birth.year
  if (at.month < birth.month || (at.month === birth.month && at.day < birth.day)) years -= 1
  return years < 0 ? null : years
}

/** The Gregorian week, Monday first. */
export const EARTH_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Index into `EARTH_WEEKDAYS` of 1 January of `year` in the Gregorian calendar (proleptic before 1582). */
export function gregorianFirstWeekday(year: number): number {
  const d = new Date(Date.UTC(2000, 0, 1))
  d.setUTCFullYear(year, 0, 1)
  return (d.getUTCDay() + 6) % 7
}

/** Earth's week for a calendar whose day 0 is 1 January of `startYear`. */
export function earthWeek(startYear: number): CalendarWeek {
  return { days: [...EARTH_WEEKDAYS], first: gregorianFirstWeekday(startYear) }
}

/** Whether a calendar's year is Earth's: twelve months with the Gregorian names and lengths, and nothing between them. */
export function isEarthYear(cal: WorldCalendar): boolean {
  const earth = defaultCalendar().months
  return cal.months.length === earth.length
    && cal.months.every((m, i) => !m.intercalary && m.name === earth[i].name && Math.floor(m.days) === earth[i].days)
}

/** Whether a calendar's week is Earth's, Monday to Sunday: kept in step with the start year when that changes. */
export function isEarthWeek(week: CalendarWeek | undefined): boolean {
  return !!week && week.days.length === 7 && week.days.every((d, i) => d === EARTH_WEEKDAYS[i])
}

/**
 * The weekday of an in-world day, as an index into `cal.week.days`; null with
 * no week, or on a day outside the months, which is outside the week too.
 * Counts only the days in the months, so a festival day does not move the
 * week along.
 */
export function weekdayOf(cal: WorldCalendar, dayNumber: number): number | null {
  const week = cal.week
  if (!week || week.days.length === 0) return null
  const dpy = daysPerYear(cal)
  if (dpy <= 0) return null
  const lengths = cal.months.map((m) => Math.max(1, Math.floor(m.days)))
  const weekDaysPerYear = cal.months.reduce((n, m, i) => n + (m.intercalary ? 0 : lengths[i]), 0)
  const whole = Math.floor(dayNumber)
  const years = Math.floor(whole / dpy)
  let inYear = whole - years * dpy
  let counted = years * weekDaysPerYear
  for (let i = 0; i < cal.months.length; i++) {
    if (inYear < lengths[i]) {
      if (cal.months[i].intercalary) return null
      counted += inYear
      break
    }
    if (!cal.months[i].intercalary) counted += lengths[i]
    inYear -= lengths[i]
  }
  const n = week.days.length
  return (((week.first + counted) % n) + n) % n
}

/** The name of an in-world day's weekday, or null where it has none (`weekdayOf`). */
export function weekdayName(cal: WorldCalendar, dayNumber: number): string | null {
  const i = weekdayOf(cal, dayNumber)
  return i === null ? null : cal.week!.days[i] || null
}

/** A sensible 12-month, ~365-day default calendar for enabling the feature: Earth's, with its week. */
export function defaultCalendar(): WorldCalendar {
  return {
    week: earthWeek(1),
    startYear: 1,
    yearSuffix: '',
    months: [
      { name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: 'March', days: 31 },
      { name: 'April', days: 30 }, { name: 'May', days: 31 }, { name: 'June', days: 30 },
      { name: 'July', days: 31 }, { name: 'August', days: 31 }, { name: 'September', days: 30 },
      { name: 'October', days: 31 }, { name: 'November', days: 30 }, { name: 'December', days: 31 },
    ],
  }
}
