import type { WorldCalendar, InWorldDate } from '@/types'

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

/** A sensible 12-month, ~365-day default calendar for enabling the feature. */
export function defaultCalendar(): WorldCalendar {
  return {
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
