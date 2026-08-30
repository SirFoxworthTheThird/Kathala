import { describe, it, expect } from 'vitest'
import { daysPerYear, dayNumberToDate, dateToDayNumber, formatInWorldDate, ageInYears, defaultCalendar } from '@/lib/calendar'
import type { WorldCalendar } from '@/types'

// A simple 3-month calendar: 10 + 20 + 5 = 35 days/year, starting in year 100.
const cal: WorldCalendar = {
  startYear: 100,
  yearSuffix: 'AC',
  months: [{ name: 'Frost', days: 10 }, { name: 'Bloom', days: 20 }, { name: 'Harvest', days: 5 }],
}

describe('daysPerYear', () => {
  it('sums the month lengths', () => {
    expect(daysPerYear(cal)).toBe(35)
  })
})

describe('dayNumberToDate', () => {
  it('day 0 is the first day of the start year', () => {
    expect(dayNumberToDate(cal, 0)).toEqual({ year: 100, month: 0, day: 1 })
  })
  it('walks into later months', () => {
    expect(dayNumberToDate(cal, 9)).toEqual({ year: 100, month: 0, day: 10 })  // last of Frost
    expect(dayNumberToDate(cal, 10)).toEqual({ year: 100, month: 1, day: 1 })  // first of Bloom
    expect(dayNumberToDate(cal, 30)).toEqual({ year: 100, month: 2, day: 1 })  // first of Harvest
  })
  it('rolls over the year', () => {
    expect(dayNumberToDate(cal, 35)).toEqual({ year: 101, month: 0, day: 1 })
    expect(dayNumberToDate(cal, 71)).toEqual({ year: 102, month: 0, day: 2 })
  })
  it('handles days before the epoch', () => {
    expect(dayNumberToDate(cal, -1)).toEqual({ year: 99, month: 2, day: 5 }) // last day of year 99
  })
  it('places fractional story-clock times on their containing calendar day', () => {
    expect(dayNumberToDate(cal, 10.1)).toEqual({ year: 100, month: 1, day: 1 })
    expect(dayNumberToDate(cal, 10.9)).toEqual({ year: 100, month: 1, day: 1 })
    expect(dayNumberToDate(cal, -0.1)).toEqual({ year: 99, month: 2, day: 5 })
  })
})

describe('dateToDayNumber round-trips with dayNumberToDate', () => {
  it('is the inverse across several days', () => {
    for (const n of [0, 9, 10, 30, 34, 35, 71, -1, -35]) {
      expect(dateToDayNumber(cal, dayNumberToDate(cal, n))).toBe(n)
    }
  })
})

describe('formatInWorldDate', () => {
  it('renders day, month name, year and suffix', () => {
    expect(formatInWorldDate(cal, 10)).toBe('1 Bloom, 100 AC')
    expect(formatInWorldDate(cal, 71)).toBe('2 Frost, 102 AC')
  })
})

describe('ageInYears', () => {
  const birth = { year: 100, month: 1, day: 5 } // 5 Bloom, 100
  it('is 0 before the first birthday', () => {
    expect(ageInYears(cal, birth, dateToDayNumber(cal, { year: 100, month: 2, day: 1 }))).toBe(0)
  })
  it('ticks up on the birthday', () => {
    expect(ageInYears(cal, birth, dateToDayNumber(cal, { year: 101, month: 1, day: 4 }))).toBe(0) // day before
    expect(ageInYears(cal, birth, dateToDayNumber(cal, { year: 101, month: 1, day: 5 }))).toBe(1) // birthday
    expect(ageInYears(cal, birth, dateToDayNumber(cal, { year: 105, month: 2, day: 1 }))).toBe(5)
  })
  it('is null before birth', () => {
    expect(ageInYears(cal, birth, dateToDayNumber(cal, { year: 100, month: 0, day: 1 }))).toBeNull()
  })
})

describe('defaultCalendar', () => {
  it('is a 12-month, 365-day year', () => {
    expect(defaultCalendar().months).toHaveLength(12)
    expect(daysPerYear(defaultCalendar())).toBe(365)
  })
})

/**
 * Days that belong to no month.
 *
 * The Shire Reckoning is twelve thirty-day months plus five named days that sit
 * outside them — 1 Yule, 1 Lithe, Midyear's Day, 2 Lithe, 2 Yule — and the
 * Lithedays fall in the *middle* of the year rather than at the end. It was
 * always enterable, because the arithmetic only ever asks how long each entry
 * is; what it could not do was read right. `intercalary` is that display flag.
 */
const MONTHS = [
  'Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe',
  'Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule',
]
const day = (name: string) => ({ name, days: 1, intercalary: true })
const shire: WorldCalendar = {
  startYear: 1418,
  yearSuffix: 'S.R.',
  months: [
    day('2 Yule'),
    ...MONTHS.slice(0, 6).map((name) => ({ name, days: 30 })),
    day('1 Lithe'), day("Midyear's Day"), day('2 Lithe'),
    ...MONTHS.slice(6).map((name) => ({ name, days: 30 })),
    day('1 Yule'),
  ],
}

describe('a calendar with intercalary days', () => {
  it('adds up to a real year', () => {
    expect(daysPerYear(shire)).toBe(365)
  })

  it('prints a lone named day as its name, with no day number in front of it', () => {
    // Day 0 is 2 Yule; the six months and 1 Lithe follow.
    expect(formatInWorldDate(shire, 0)).toBe('2 Yule, 1418 S.R.')
    expect(formatInWorldDate(shire, 1 + 180)).toBe('1 Lithe, 1418 S.R.')
    expect(formatInWorldDate(shire, 1 + 180 + 1)).toBe("Midyear's Day, 1418 S.R.")
  })

  it('still numbers within an ordinary month, which is the pairing that matters', () => {
    expect(formatInWorldDate(shire, 1)).toBe('1 Afteryule, 1418 S.R.')
    expect(formatInWorldDate(shire, 30)).toBe('30 Afteryule, 1418 S.R.')
  })

  it('keeps the number on a multi-day intercalary run, which is what "2 Lithe" means', () => {
    const merged: WorldCalendar = {
      ...shire,
      months: [{ name: 'Lithe', days: 3, intercalary: true }, { name: 'Afteryule', days: 30 }],
    }
    expect(formatInWorldDate(merged, 1)).toBe('2 Lithe, 1418 S.R.')
  })

  it('round-trips a named day through the day number', () => {
    const midyear = 1 + 180 + 1
    const d = dayNumberToDate(shire, midyear)
    expect(shire.months[d.month].name).toBe("Midyear's Day")
    expect(dateToDayNumber(shire, d)).toBe(midyear)
  })

  it('counts a birthday on a named day like any other', () => {
    const born = dayNumberToDate(shire, 1 + 180 + 1)
    expect(ageInYears(shire, born, 1 + 180 + 1 + 365)).toBe(1)
    expect(ageInYears(shire, born, 1 + 180 + 365)).toBe(0)
  })

  it('leaves a calendar written before the flag existed alone', () => {
    // `intercalary` absent is an ordinary month, so nothing already stored moves.
    expect(formatInWorldDate(cal, 0)).toBe('1 Frost, 100 AC')
  })
})
