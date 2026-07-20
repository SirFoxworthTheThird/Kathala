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
