import { describe, it, expect } from 'vitest'
import {
  dateToDayNumber, dayNumberToDate, daysInYear, daysPerYear, defaultCalendar, earthWeek, formatInWorldDate,
  gregorianLeap, isLeapYear, monthLength, nextLeapYear, weekdayName, weekdayOf, withEntryInserted, withEntryRemoved,
} from '@/lib/calendar'
import { buildCalendarMonths } from '@/lib/calendarView'
import { readWhen } from '@/lib/sceneTime'
import type { Chapter, WorldCalendar, WorldEvent } from '@/types'

/** Leap years: which years they are, and what they gain. */

// Writer run 9's book: Earth, from 2025, now with the Gregorian rule.
const EARTH_2025: WorldCalendar = { ...defaultCalendar(), startYear: 2025, week: earthWeek(2025) }
const NO_LEAP: WorldCalendar = { ...EARTH_2025, leap: undefined }
const day = (cal: WorldCalendar, year: number, month: number, d: number) => dateToDayNumber(cal, { year, month, day: d })

/** Shire Reckoning: Overlithe after Midyear's Day, only in leap years, outside the week as the Lithe days are. */
const SHIRE: WorldCalendar = {
  startYear: 1416, yearSuffix: '',
  months: [
    { name: '2 Yule', days: 1, intercalary: true },
    ...['Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe'].map((name) => ({ name, days: 30 })),
    { name: '1 Lithe', days: 1, intercalary: true },
    { name: "Midyear's Day", days: 1, intercalary: true },
    { name: 'Overlithe', days: 0, intercalary: true },
    { name: '2 Lithe', days: 1, intercalary: true },
    ...['Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule'].map((name) => ({ name, days: 30 })),
    { name: '1 Yule', days: 1, intercalary: true },
  ],
  week: { days: ['Sterday', 'Sunday', 'Monday', 'Trewsday', 'Hevensday', 'Mersday', 'Highday'], first: 0 },
  leap: { month: 9, days: 1, every: 4, skip: 100 },
}

describe('which years are leap years', () => {
  it('Gregorian: every fourth, except every hundredth, unless every four-hundredth', () => {
    expect([1900, 2000, 2024, 2025, 2028, 2100, 2400].map((y) => isLeapYear(EARTH_2025, y))).toEqual([false, true, true, false, true, false, true])
    // Before year 1 too, as the calendar counts inside: 0 is 1 BC, and a leap year.
    expect([0, -4, -100, -400].map((y) => isLeapYear(EARTH_2025, y))).toEqual([true, true, false, true])
  })

  it('the Shire’s: every fourth, except every hundredth, with nothing to keep it', () => {
    expect([1416, 1418, 1420, 1500, 1600].map((y) => isLeapYear(SHIRE, y))).toEqual([true, false, true, false, false])
  })

  it('no rule, no leap years; a skip that does not fall on a leap year is no rule', () => {
    expect([isLeapYear(NO_LEAP, 2028), nextLeapYear(NO_LEAP, 2025)]).toEqual([false, null])
    expect(isLeapYear({ ...EARTH_2025, leap: { ...gregorianLeap(), skip: 30 } }, 2100)).toBe(true)
  })
})

describe('dates, with leap days', () => {
  it('29 February 2028 is a date, and 1 March after it is a day later than without the rule', () => {
    expect([monthLength(EARTH_2025, 1, 2028), monthLength(EARTH_2025, 1, 2027), daysInYear(EARTH_2025, 2028), daysPerYear(EARTH_2025)]).toEqual([29, 28, 366, 365])
    const feb29 = day(EARTH_2025, 2028, 1, 29)
    expect(dayNumberToDate(EARTH_2025, feb29)).toEqual({ year: 2028, month: 1, day: 29 })
    expect(formatInWorldDate(EARTH_2025, feb29 + 1)).toBe('1 March, 2028')
    expect(day(EARTH_2025, 2028, 2, 1) - day(NO_LEAP, 2028, 2, 1)).toBe(1)
    // From 1 January 2025 to 1 January 2029: four years, one of them leap.
    expect(day(EARTH_2025, 2029, 0, 1)).toBe(365 * 4 + 1)
  })

  it('round trips every day for a few centuries either side of the start, across 1900 and 2000', () => {
    for (let d = -60000; d <= 60000; d += 37) {
      const date = dayNumberToDate(EARTH_2025, d)
      expect(dateToDayNumber(EARTH_2025, date)).toBe(d)
    }
  })

  it('counts the leap years across 2000, which the four-hundredth keeps: 1 January 1999 is 26 years and 7 leap days back', () => {
    expect(day(EARTH_2025, 1999, 0, 1)).toBe(-(26 * 365 + 7))
    expect(dayNumberToDate(EARTH_2025, -(26 * 365 + 7))).toEqual({ year: 1999, month: 0, day: 1 })
    // 1 January 2000 was a Saturday.
    expect(weekdayName(EARTH_2025, day(EARTH_2025, 2000, 0, 1))).toBe('Saturday')
  })

  it('finds the year where leap years are long and come first: the guess from the average year can be past it', () => {
    // Ten days a year, and every other year — starting with the first — ten more.
    const lumpy: WorldCalendar = { startYear: 0, yearSuffix: '', months: [{ name: 'Only', days: 10 }], leap: { month: 0, days: 10, every: 2 } }
    expect([dayNumberToDate(lumpy, 19), dayNumberToDate(lumpy, 20), dayNumberToDate(lumpy, -1)]).toEqual([
      { year: 0, month: 0, day: 20 }, { year: 1, month: 0, day: 1 }, { year: -1, month: 0, day: 10 },
    ])
    for (let d = -200; d <= 200; d++) expect(dateToDayNumber(lumpy, dayNumberToDate(lumpy, d))).toBe(d)
  })

  it('a day in the year 32,878,607, as the library’s Time Machine reaches, without walking the years', () => {
    const far = day(EARTH_2025, 32_878_607, 5, 15)
    expect(dayNumberToDate(EARTH_2025, far)).toEqual({ year: 32_878_607, month: 5, day: 15 })
  })

  it('weekdays stay true across 29 February: 1 March 2028 is a Wednesday, 1 January 2029 a Monday', () => {
    expect(weekdayName(EARTH_2025, day(EARTH_2025, 2028, 1, 29))).toBe('Tuesday')
    expect(weekdayName(EARTH_2025, day(EARTH_2025, 2028, 2, 1))).toBe('Wednesday')
    expect(weekdayName(EARTH_2025, day(EARTH_2025, 2029, 0, 1))).toBe('Monday')
    // Without the rule the week slips a day at the first leap day, as it always did.
    expect(weekdayName(NO_LEAP, day(NO_LEAP, 2029, 0, 1))).toBe('Sunday')
  })

  it('a calendar with no rule works out its dates as it always did', () => {
    for (const d of [-800, 0, 59, 365, 1461, 100000]) {
      const dpy = 365
      const yearOffset = Math.floor(d / dpy)
      expect(dayNumberToDate(NO_LEAP, d).year).toBe(2025 + yearOffset)
    }
  })
})

describe('the Shire’s Overlithe', () => {
  it('is there in a leap year and not in another, outside the week, and said by its name', () => {
    expect([monthLength(SHIRE, 9, 1416), monthLength(SHIRE, 9, 1417)]).toEqual([1, 0])
    const overlithe = day(SHIRE, 1416, 9, 1)
    expect(formatInWorldDate(SHIRE, overlithe)).toBe('Overlithe, 1416')
    expect(weekdayName(SHIRE, overlithe)).toBeNull()
    // In 1417 the day after Midyear's Day is 2 Lithe.
    expect(formatInWorldDate(SHIRE, day(SHIRE, 1417, 8, 1) + 1)).toBe('2 Lithe, 1417')
    // The week does not move for it: in the leap year too, 1 Afterlithe is the weekday after 30 Forelithe.
    const after = (y: number) => (weekdayOf(SHIRE, day(SHIRE, y, 11, 1))! - weekdayOf(SHIRE, day(SHIRE, y, 6, 30))! + 7) % 7
    expect([after(1416), after(1417)]).toEqual([1, 1])
    // Nor from one year to the next: a leap year has 360 days in the week, as a common one does.
    const yearOn = (y: number) => (weekdayOf(SHIRE, day(SHIRE, y + 1, 1, 1))! - weekdayOf(SHIRE, day(SHIRE, y, 1, 1))! + 7) % 7
    expect([yearOn(1416), yearOn(1417)]).toEqual([360 % 7, 360 % 7])
  })
})

describe('a festival day that gains a day in leap years', () => {
  it('is numbered, since it is not always one day: "1 Lithe" in any year', () => {
    const lithe: WorldCalendar = { startYear: 1, yearSuffix: '', months: [{ name: 'Spring', days: 10 }, { name: 'Lithe', days: 1, intercalary: true }, { name: 'Autumn', days: 10 }], leap: { month: 1, days: 1, every: 4 } }
    expect(formatInWorldDate(lithe, 10)).toBe('1 Lithe, 1')
    expect(formatInWorldDate(lithe, day(lithe, 4, 1, 2))).toBe('2 Lithe, 4')
  })
})

describe('the Calendar and the When: line, with leap days', () => {
  const chapter: Chapter = { id: 'c1', worldId: 'w', timelineId: 't', number: 1, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
  const event = (id: string, inWorldTime: number): WorldEvent => ({
    id, worldId: 'w', chapterId: 'c1', timelineId: 't', title: id, description: '', locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder: 0, travelDays: null, inWorldTime, tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0,
  })

  it('February 2028 has 29 days on the Calendar, and 2027’s 28', () => {
    const grids = buildCalendarMonths({ events: [event('a', day(EARTH_2025, 2027, 1, 3)), event('b', day(EARTH_2025, 2028, 1, 29))], chapters: [chapter], calendar: EARTH_2025 })
    const feb = (y: number) => grids.find((g) => g.year === y && g.month === 1)!
    expect([feb(2027).days, feb(2028).days]).toEqual([28, 29])
    expect([...feb(2028).eventsByDay.keys()]).toEqual([29])
  })

  it('a year with no Overlithe has no grid for it', () => {
    const grids = buildCalendarMonths({ events: [event('a', day(SHIRE, 1417, 7, 1)), event('b', day(SHIRE, 1417, 11, 1))], chapters: [chapter], calendar: SHIRE })
    expect(grids.map((g) => g.monthName)).not.toContain('Overlithe')
    expect(grids.map((g) => g.monthName)).toContain("Midyear's Day")
  })

  it('29 February only where the year has it; with no year, the next leap year’s', () => {
    const from = { calendar: EARTH_2025, previousDay: 0 }
    expect(readWhen('29 February 2028', from)).toEqual({ day: day(EARTH_2025, 2028, 1, 29), exact: false })
    expect(readWhen('29 February 2027', from)).toEqual({ error: 'February has 28 days in 2027, so “29 February 2027” is not a date in it.' })
    expect(readWhen('29 February', from)).toEqual({ day: day(EARTH_2025, 2028, 1, 29), exact: false })
    expect(readWhen('30 February', from)).toEqual({ error: 'February has 29 days, so “30 February” is not a date in it.' })
    expect(readWhen('Overlithe 1416', { calendar: SHIRE, previousDay: 0 })).toEqual({ day: day(SHIRE, 1416, 9, 1), exact: false })
  })
})

describe('editing the months keeps the leap rule on its entry', () => {
  it('a day put after January leaves February the one that gains a day', () => {
    const inserted = withEntryInserted(EARTH_2025, 0, { name: "Midyear's Day", days: 1, intercalary: true })
    expect([inserted.leap?.month, inserted.months[inserted.leap!.month].name]).toEqual([2, 'February'])
    // And the day put in reads as its name, gaining nothing.
    expect(formatInWorldDate(inserted, 31)).toBe("Midyear's Day, 2025")
    // One put after February leaves the rule where it was.
    expect(withEntryInserted(EARTH_2025, 5, { name: 'Fair', days: 1, intercalary: true }).leap?.month).toBe(1)
  })

  it('removing an entry before it moves the rule down; removing its own entry takes the rule away', () => {
    const lessJanuary = withEntryRemoved(EARTH_2025, 0)
    expect(lessJanuary.months[lessJanuary.leap!.month].name).toBe('February')
    expect(withEntryRemoved(EARTH_2025, 1).leap).toBeUndefined()
    expect(withEntryRemoved(EARTH_2025, 6).leap?.month).toBe(1)
    // Without a rule, as it always was.
    expect(withEntryRemoved(NO_LEAP, 0).months.length).toBe(11)
  })
})
