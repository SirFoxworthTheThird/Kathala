import { describe, it, expect } from 'vitest'
import {
  bcAdEras, dateToDayNumber, daysPerYear, defaultCalendar, eraBeginsAfter, eraIndexOf, formatInWorldDate, formatYear,
  withEraAdded, withEraBeginningAfter, yearFromLabel, yearInEra, yearLabel,
} from '@/lib/calendar'
import type { CalendarEra, WorldCalendar } from '@/types'

/**
 * Eras (docs/records/scene-time-plan.md, Part 2): a year inside the calendar
 * is one signed count; an era is how a stretch of it is said.
 */

const months = [{ name: 'Harvest', days: 30 }, { name: 'Frost', days: 30 }]
const at = (eras: CalendarEra[], startYear = 0): WorldCalendar => ({ startYear, yearSuffix: '', months, eras })

// Star Wars: BBY counting down to the Battle of Yavin; ABY up from 0, the battle's own year.
const STAR_WARS = at([{ label: 'BBY', counts: 'down', first: 1 }, { label: 'ABY', start: 0, counts: 'up', first: 0 }])
// Earth's: BC down to 1, AD up from 1, no year 0. Inside, as astronomers count, 0 is 1 BC.
const BC_AD = at(bcAdEras())
// Tolkien's Ages: the Second counting up as the calendar does, the Third again from 1 after 3441 of it.
const AGES = at([{ label: 'SA', counts: 'up', first: 1 }, { label: 'TA', start: 3442, counts: 'up', first: 1 }])

const said = (cal: WorldCalendar, year: number) => { const { number, label } = yearLabel(cal, year); return `${number} ${label}` }

describe('eras, both ways round', () => {
  it('Star Wars: 19 BBY, then 18 BBY a year later, then 0 ABY', () => {
    expect([-19, -18, -1, 0, 4].map((y) => said(STAR_WARS, y))).toEqual(['19 BBY', '18 BBY', '1 BBY', '0 ABY', '4 ABY'])
    expect([yearFromLabel(STAR_WARS, 19, 'BBY'), yearFromLabel(STAR_WARS, 1, 'bby'), yearFromLabel(STAR_WARS, 4, 'ABY')]).toEqual([-19, -1, 4])
  })

  it('BC and AD across the missing year 0', () => {
    expect([-1, 0, 1, 2025].map((y) => said(BC_AD, y))).toEqual(['2 BC', '1 BC', '1 AD', '2025 AD'])
    expect([yearFromLabel(BC_AD, 1, 'BC'), yearFromLabel(BC_AD, 1, 'AD'), yearFromLabel(BC_AD, 2025, 'AD')]).toEqual([0, 1, 2025])
    // There is no year 0 in either.
    expect([yearFromLabel(BC_AD, 0, 'BC'), yearFromLabel(BC_AD, 0, 'AD')]).toEqual([null, null])
  })

  it('the Ages: the Third counts again from 1, and the Second ends where it begins', () => {
    expect([3441, 3442, 3442 + 3017].map((y) => said(AGES, y))).toEqual(['3441 SA', '1 TA', '3018 TA'])
    expect([yearFromLabel(AGES, 3018, 'TA'), yearFromLabel(AGES, 3500, 'SA'), yearFromLabel(AGES, 1, 'XA')]).toEqual([6459, null, null])
  })

  it('a year past its era’s end, read as written, lands in the era beside it — a picker going one too far', () => {
    expect(yearInEra(BC_AD, 0, 0)).toBe(1)
    expect(said(BC_AD, yearInEra(BC_AD, 0, 0))).toBe('1 AD')
  })

  it('in dates: ordered by the count inside, said by the era', () => {
    const cal = { ...BC_AD, startYear: -1 }
    const year = daysPerYear(cal)
    expect([0, year, 2 * year].map((d) => formatInWorldDate(cal, d))).toEqual(['1 Harvest, 2 BC', '1 Harvest, 1 BC', '1 Harvest, 1 AD'])
    expect(formatYear(STAR_WARS, -19)).toBe('19 BBY')
  })

  it('a calendar with no eras is as it was, suffix and all', () => {
    const noted: WorldCalendar = { startYear: 1893, yearSuffix: ' (editorial)', months }
    expect(formatInWorldDate(noted, 0)).toBe('1 Harvest, 1893  (editorial)')
    expect([eraIndexOf(noted, 1893), yearLabel(noted, 1893)]).toEqual([null, { number: 1893, label: '(editorial)' }])
    expect([yearFromLabel(noted, 1893, ''), yearFromLabel(noted, 1893, '(editorial)'), yearFromLabel(noted, 1893, 'AD')]).toEqual([1893, 1893, null])
  })

  it('counting down needs an era to count to: alone, it counts up', () => {
    const alone = at([{ label: 'BBY', counts: 'down', first: 1 }])
    expect(said(alone, 5)).toBe('5 BBY')
  })
})

describe('editing eras', () => {
  it('BC and AD on an Earth calendar keep 2025 as 2025', () => {
    expect(formatYear({ ...defaultCalendar(), startYear: 2025, eras: bcAdEras() }, 2025)).toBe('2025 AD')
  })

  it('an age begins after a year of the one before it, said in that one’s numbers', () => {
    expect(eraBeginsAfter(AGES, 1)).toBe(3441)
    const moved = withEraBeginningAfter(AGES, 1, 3000)
    expect([moved.eras![1].start, said(moved, 3001), said(moved, 3000)]).toEqual([3001, '1 TA', '3000 SA'])
    // The first era begins after nothing.
    expect(eraBeginsAfter(AGES, 0)).toBeNull()
  })

  it('the first era added keeps every year’s number, and takes the suffix as its label; the next begins after the story’s start year', () => {
    const one = withEraAdded({ startYear: 998, yearSuffix: 'AC', months })
    expect([one.eras, formatYear(one, 998)]).toEqual([[{ label: 'AC', counts: 'up', first: 1 }], '998 AC'])
    const two = withEraAdded(one)
    expect([two.eras![1].start, said(two, 998), said(two, 999)]).toEqual([999, '998 AC', '1 Era 2'])
  })

  it('a date’s day is unchanged by eras: only how its year is said', () => {
    const plain: WorldCalendar = { startYear: 2025, yearSuffix: '', months }
    expect(dateToDayNumber({ ...plain, eras: bcAdEras() }, { year: 2026, month: 1, day: 3 })).toBe(dateToDayNumber(plain, { year: 2026, month: 1, day: 3 }))
  })
})
