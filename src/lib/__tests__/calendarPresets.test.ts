import { describe, it, expect } from 'vitest'
import { CALENDAR_PRESETS } from '@/lib/calendarPresets'
import { daysPerYear, defaultCalendar } from '@/lib/calendar'

/**
 * HB-9. A preset exists to save a writer building a shape by hand, so what is
 * worth asserting is the shape: how long the year is, how many things are
 * months, and which entries fall outside them.
 */
describe('CALENDAR_PRESETS', () => {
  it('offers distinct presets', () => {
    const ids = CALENDAR_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(1)
  })

  it('builds a year of the length each one advertises', () => {
    const byId = Object.fromEntries(CALENDAR_PRESETS.map((p) => [p.id, p.build()]))
    expect(daysPerYear(byId.earth)).toBe(365)
    expect(daysPerYear(byId.seasons)).toBe(364)
    expect(daysPerYear(byId['twelve-thirty'])).toBe(365)
  })

  it('keeps one definition of Earth rather than two that can drift', () => {
    const earth = CALENDAR_PRESETS.find((p) => p.id === 'earth')!
    // The plain "Enable calendar" button uses `defaultCalendar` directly.
    expect(earth.build()).toEqual(defaultCalendar())
  })

  it('puts the festival days outside the months, which is the fiddly part', () => {
    const cal = CALENDAR_PRESETS.find((p) => p.id === 'twelve-thirty')!.build()
    const months = cal.months.filter((m) => !m.intercalary)
    const outside = cal.months.filter((m) => m.intercalary)
    expect(months).toHaveLength(12)
    expect(months.every((m) => m.days === 30)).toBe(true)
    expect(outside).toHaveLength(1)
    expect(outside[0].days).toBe(5)
  })

  /**
   * The pair to the test above: the other presets have no entries outside the
   * months, so `intercalary` is not something every preset simply sets.
   */
  it('leaves the other presets with no days outside the months', () => {
    for (const id of ['earth', 'seasons']) {
      const cal = CALENDAR_PRESETS.find((p) => p.id === id)!.build()
      expect(cal.months.some((m) => m.intercalary)).toBe(false)
    }
  })

  it('builds a fresh object each time, so editing one world does not touch another', () => {
    const a = CALENDAR_PRESETS[0].build()
    const b = CALENDAR_PRESETS[0].build()
    expect(a).not.toBe(b)
    a.months[0].name = 'Renamed'
    expect(b.months[0].name).not.toBe('Renamed')
  })
})
