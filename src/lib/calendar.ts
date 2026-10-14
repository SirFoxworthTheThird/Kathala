import type { CalendarWeek, WorldCalendar, InWorldDate } from '@/types'

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

/** Human-readable date, e.g. "12 Firstmonth, 998 AC". Falls back gracefully. */
export function formatInWorldDate(cal: WorldCalendar, dayNumber: number): string {
  const d = dayNumberToDate(cal, dayNumber)
  const month = cal.months[d.month]
  const monthName = month?.name || `Month ${d.month + 1}`
  const suffix = cal.yearSuffix ? ` ${cal.yearSuffix}` : ''
  // A single day outside the months is a name, not a position in something:
  // "Midyear's Day, 1419", never "1 Midyear's Day, 1419". Longer intercalary
  // runs keep their number, because that is exactly what "2 Lithe" means.
  const bare = month?.intercalary && Math.max(1, Math.floor(month.days)) === 1
  return bare
    ? `${monthName}, ${d.year}${suffix}`
    : `${d.day} ${monthName}, ${d.year}${suffix}`
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
