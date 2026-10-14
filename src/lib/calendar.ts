import type { CalendarEra, CalendarLeap, CalendarWeek, WorldCalendar, InWorldDate } from '@/types'

/**
 * Maps the in-world day clock (see `computeInWorldDays`) onto a custom calendar
 * and computes character ages. Day 0 of the clock is day 1 of the first month
 * of `startYear`. Pure and dependency-free.
 */

/*
  ── Leap years ────────────────────────────────────────────────────────────
  Without a rule every year is the same length, and a year's first day is
  simple multiplication. With one, it is that plus the leap years before it,
  counted in closed form rather than by walking the years: the library's
  Time Machine reaches the year 32,878,607.
*/

/** The leap rule as it is read: a `skip` that is not a multiple of `every`, or a `keep` not of `skip`, is no rule at all. */
function leapOf(cal: WorldCalendar): CalendarLeap | null {
  const leap = cal.leap
  if (!leap || !(leap.every >= 1) || !(leap.days >= 1) || !cal.months[leap.month]) return null
  const every = Math.floor(leap.every)
  const skip = leap.skip && Math.floor(leap.skip) % every === 0 ? Math.floor(leap.skip) : undefined
  const keep = skip && leap.keep && Math.floor(leap.keep) % skip === 0 ? Math.floor(leap.keep) : undefined
  return { month: leap.month, days: Math.floor(leap.days), every, skip, keep }
}

/** Whether a year, as the calendar counts it inside, is a leap year. */
export function isLeapYear(cal: WorldCalendar, year: number): boolean {
  const leap = leapOf(cal)
  if (!leap) return false
  const divides = (n: number) => ((year % n) + n) % n === 0
  return divides(leap.every) && !(leap.skip && divides(leap.skip) && !(leap.keep && divides(leap.keep)))
}

/** Leap years before `year`, less a constant: only differences between two of these mean anything. */
function leapsBefore(leap: CalendarLeap, year: number): number {
  const multiples = (n: number) => Math.floor((year - 1) / n)
  return multiples(leap.every) - (leap.skip ? multiples(leap.skip) : 0) + (leap.keep ? multiples(leap.keep) : 0)
}

/**
 * An entry's length in a common year. At least a day, as always — except the
 * entry a leap rule adds to, which may have none outside leap years.
 */
function commonLength(cal: WorldCalendar, index: number): number {
  const days = Math.floor(cal.months[index]?.days ?? 0)
  return leapOf(cal)?.month === index ? Math.max(0, days) : Math.max(1, days)
}

/** An entry's length in a given year: 29 for February 2028, 28 for 2027. */
export function monthLength(cal: WorldCalendar, index: number, year: number): number {
  const leap = leapOf(cal)
  return commonLength(cal, index) + (leap && leap.month === index && isLeapYear(cal, year) ? leap.days : 0)
}

/** An entry's longest length, in a leap year if it has one: what a day number in it may go up to. */
export function longestLength(cal: WorldCalendar, index: number): number {
  const leap = leapOf(cal)
  return commonLength(cal, index) + (leap && leap.month === index ? leap.days : 0)
}

/** Days in a common year of this calendar. */
export function daysPerYear(cal: WorldCalendar): number {
  return cal.months.reduce((sum, _m, i) => sum + commonLength(cal, i), 0)
}

/** Days in a given year: a common year's, and the leap days where it is one. */
export function daysInYear(cal: WorldCalendar, year: number): number {
  const leap = leapOf(cal)
  return daysPerYear(cal) + (leap && isLeapYear(cal, year) ? leap.days : 0)
}

/** The day number of the first day of `year`. */
function yearStart(cal: WorldCalendar, year: number): number {
  const leap = leapOf(cal)
  const common = (year - cal.startYear) * daysPerYear(cal)
  return leap ? common + leap.days * (leapsBefore(leap, year) - leapsBefore(leap, cal.startYear)) : common
}

/** Convert an absolute in-world day number to a calendar date. */
export function dayNumberToDate(cal: WorldCalendar, dayNumber: number): InWorldDate {
  const dpy = daysPerYear(cal)
  if (dpy <= 0 || cal.months.length === 0) return { year: cal.startYear, month: 0, day: 1 }
  // The story clock may use fractions to preserve time-of-day ordering. A
  // calendar date represents the containing whole day, so 10.75 and 10.1 both
  // belong to day 10 rather than producing fractional grid-cell keys.
  const wholeDay = Math.floor(dayNumber)
  const leap = leapOf(cal)
  // A first guess from the average year, then the year it is.
  const average = dpy + (leap ? leap.days / leap.every : 0)
  let year = cal.startYear + Math.floor(wholeDay / average)
  while (yearStart(cal, year) > wholeDay) year--
  while (yearStart(cal, year + 1) <= wholeDay) year++
  let dayInYear = wholeDay - yearStart(cal, year) // 0-based, in [0, days in the year)
  let month = 0
  for (let i = 0; i < cal.months.length; i++) {
    // An entry with no days this year — Overlithe outside a leap year — holds none of them.
    const len = monthLength(cal, i, year)
    if (dayInYear < len) { month = i; break }
    dayInYear -= len
  }
  return { year, month, day: dayInYear + 1 }
}

/** Convert a calendar date back to an absolute in-world day number. */
export function dateToDayNumber(cal: WorldCalendar, date: InWorldDate): number {
  const month = Math.max(0, Math.min(cal.months.length - 1, date.month))
  let daysBeforeMonth = 0
  for (let i = 0; i < month; i++) daysBeforeMonth += monthLength(cal, i, date.year)
  return yearStart(cal, date.year) + daysBeforeMonth + (Math.max(1, date.day) - 1)
}

/** The first leap year at or after `year`, or null without a rule (or none within a few cycles). */
export function nextLeapYear(cal: WorldCalendar, year: number): number | null {
  if (!leapOf(cal)) return null
  for (let y = year; y <= year + 1000; y++) if (isLeapYear(cal, y)) return y
  return null
}

/** Earth's leap years, the Gregorian rule: February gains a day every fourth year, except every hundredth, unless every four-hundredth. */
export function gregorianLeap(): CalendarLeap {
  return { month: 1, days: 1, every: 4, skip: 100, keep: 400 }
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
  const bare = month?.intercalary && longestLength(cal, d.month) === 1
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
  if (daysPerYear(cal) <= 0 || cal.months.length === 0) return null
  const d = dayNumberToDate(cal, dayNumber)
  if (cal.months[d.month]?.intercalary) return null
  // The week's days before this year: a common year's, and a leap day each where it falls in a month.
  const commonWeekDays = cal.months.reduce((n, m, i) => n + (m.intercalary ? 0 : commonLength(cal, i)), 0)
  const leap = leapOf(cal)
  const leapWeekDays = leap && !cal.months[leap.month].intercalary ? leap.days : 0
  let counted = (d.year - cal.startYear) * commonWeekDays
    + (leap ? leapWeekDays * (leapsBefore(leap, d.year) - leapsBefore(leap, cal.startYear)) : 0)
  for (let i = 0; i < d.month; i++) if (!cal.months[i].intercalary) counted += monthLength(cal, i, d.year)
  counted += d.day - 1
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
    // Earth's leap years. Only a new calendar gets them: added to one already written, every date after the first 29 February would move.
    leap: gregorianLeap(),
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
