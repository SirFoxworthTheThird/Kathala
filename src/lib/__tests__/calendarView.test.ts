import { describe, it, expect } from 'vitest'
import { buildCalendarMonths } from '@/lib/calendarView'
import { dateToDayNumber } from '@/lib/calendar'
import type { WorldEvent, Chapter, WorldCalendar } from '@/types'

// 3-month calendar: Frost 10 + Bloom 20 + Harvest 5 = 35 days/year, from year 100.
const calendar: WorldCalendar = {
  startYear: 100,
  yearSuffix: 'AC',
  months: [{ name: 'Frost', days: 10 }, { name: 'Bloom', days: 20 }, { name: 'Harvest', days: 5 }],
}

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number, extra: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], tags: [],
    threadIds: [], motifIds: [], sortOrder,
    travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
    status: 'draft', povCharacterId: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...extra,
  }
}

describe('buildCalendarMonths', () => {
  it('places an event on its derived date (day 0 = 1 Frost, startYear)', () => {
    const chapters = [chapter('c1', 1)]
    const events = [event('e1', 'c1', 0)] // day 0
    const months = buildCalendarMonths({ events, chapters, calendar })
    expect(months).toHaveLength(1)
    expect(months[0]).toMatchObject({ year: 100, month: 0, monthName: 'Frost', days: 10 })
    expect(months[0].eventsByDay.get(1)!.map((e) => e.id)).toEqual(['e1'])
  })

  it('advances by travelDays and spans the intervening months contiguously', () => {
    const chapters = [chapter('c1', 1), chapter('c2', 2)]
    const events = [
      event('e1', 'c1', 0),                          // day 0 → 1 Frost 100
      event('e2', 'c2', 0, { travelDays: 15 }),      // day 15 → 6 Bloom 100
    ]
    const months = buildCalendarMonths({ events, chapters, calendar })
    // Frost and Bloom both rendered (contiguous), Harvest not needed.
    expect(months.map((m) => m.monthName)).toEqual(['Frost', 'Bloom'])
    expect(months[1].eventsByDay.get(6)!.map((e) => e.id)).toEqual(['e2'])
  })

  it('honours an explicit in-world date pin', () => {
    const chapters = [chapter('c1', 1)]
    // Pin to 3 Harvest, 101 AC.
    const pin = dateToDayNumber(calendar, { year: 101, month: 2, day: 3 })
    const events = [event('e1', 'c1', 0, { inWorldTime: pin })]
    const months = buildCalendarMonths({ events, chapters, calendar })
    const last = months[months.length - 1]
    expect(last).toMatchObject({ year: 101, month: 2 })
    expect(last.eventsByDay.get(3)!.map((e) => e.id)).toEqual(['e1'])
  })

  it('groups multiple events on the same day, ordered by clock', () => {
    const chapters = [chapter('c1', 1)]
    const events = [event('b', 'c1', 1), event('a', 'c1', 0)] // both day 0
    const months = buildCalendarMonths({ events, chapters, calendar })
    // Same day/clock → tie-broken by chapter then title → a before b.
    expect(months[0].eventsByDay.get(1)!.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('the drop target day maps back to a poke-able in-world day number', () => {
    // Dropping an event on (year 100, Bloom, day 6) should pin it to that date.
    const dayNumber = dateToDayNumber(calendar, { year: 100, month: 1, day: 6 })
    // Building with that pin lands the event on the same cell.
    const chapters = [chapter('c1', 1)]
    const events = [event('e1', 'c1', 0, { inWorldTime: dayNumber })]
    const months = buildCalendarMonths({ events, chapters, calendar })
    const bloom = months.find((m) => m.monthName === 'Bloom')!
    expect(bloom.eventsByDay.get(6)!.map((e) => e.id)).toEqual(['e1'])
  })

  it('returns nothing when there are no events', () => {
    expect(buildCalendarMonths({ events: [], chapters: [], calendar })).toEqual([])
  })
})
