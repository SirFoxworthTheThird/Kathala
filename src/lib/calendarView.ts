import type { WorldEvent, Chapter, WorldCalendar, Timeline } from '@/types'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { dayNumberToDate } from '@/lib/calendar'

/**
 * Lays a world's events onto its custom calendar as a sequence of month grids,
 * so the writer can see the story by date. Pure — builds on `computeInWorldDays`
 * (the in-world clock) and `dayNumberToDate` (clock → calendar date).
 */

export interface CalendarEvent {
  id: string
  title: string
  dayNumber: number
  isFlashback: boolean
  chapterNumber: number
}

export interface CalendarMonthGrid {
  /** Stable key `year-month`. */
  key: string
  year: number
  /** 0-based month index into the calendar's `months`. */
  month: number
  monthName: string
  /** Number of days in this month. */
  days: number
  /**
   * Days that belong to no month (`CalendarMonth.intercalary`). The grid is
   * built the same way — they are a stretch of the year like any other — but a
   * one-day stretch drawn as a seven-column month reads as a broken month
   * rather than as the named day it is, so the view is told which it has.
   */
  intercalary: boolean
  /** Events on each 1-based day of the month. */
  eventsByDay: Map<number, CalendarEvent[]>
}

/** Contiguous months beyond this span fall back to only-months-with-events. */
const MAX_CONTIGUOUS_MONTHS = 120

export function buildCalendarMonths({
  events, chapters, calendar, timelines,
}: {
  events: WorldEvent[]
  chapters: Chapter[]
  calendar: WorldCalendar
  /** Supplies per-timeline day offsets so shifted eras land on the right dates. */
  timelines?: Array<Pick<Timeline, 'id' | 'dayOffset'>>
}): CalendarMonthGrid[] {
  const monthsPerYear = calendar.months.length
  if (monthsPerYear === 0) return []

  const dayByEvent = computeInWorldDays(events, chapters, timelines)
  const chapterNumberById = new Map(chapters.map((c) => [c.id, c.number]))

  // Absolute month ordinal so months order across years (and pre-epoch years).
  const ordinalOf = (year: number, month: number) => year * monthsPerYear + month
  const yearOf = (ord: number) => Math.floor(ord / monthsPerYear)
  const monthOf = (ord: number) => ((ord % monthsPerYear) + monthsPerYear) % monthsPerYear

  interface Placed { cal: CalendarEvent; ordinal: number; day: number }
  const placed: Placed[] = []
  for (const ev of events) {
    const dayNumber = dayByEvent.get(ev.id)
    if (dayNumber == null) continue
    const date = dayNumberToDate(calendar, dayNumber)
    placed.push({
      cal: {
        id: ev.id,
        title: ev.title,
        dayNumber,
        isFlashback: ev.isFlashback ?? false,
        chapterNumber: chapterNumberById.get(ev.chapterId) ?? 0,
      },
      ordinal: ordinalOf(date.year, date.month),
      day: date.day,
    })
  }
  if (placed.length === 0) return []

  const ordinals = placed.map((p) => p.ordinal)
  const minOrd = Math.min(...ordinals)
  const maxOrd = Math.max(...ordinals)

  // Which month ordinals to render: contiguous when the span is reasonable, else
  // just the months that actually hold events (keeps huge spans manageable).
  let ordinalsToRender: number[]
  if (maxOrd - minOrd + 1 <= MAX_CONTIGUOUS_MONTHS) {
    ordinalsToRender = []
    for (let o = minOrd; o <= maxOrd; o++) ordinalsToRender.push(o)
  } else {
    ordinalsToRender = [...new Set(ordinals)].sort((a, b) => a - b)
  }

  const byOrdinal = new Map<number, Placed[]>()
  for (const p of placed) {
    const list = byOrdinal.get(p.ordinal)
    if (list) list.push(p)
    else byOrdinal.set(p.ordinal, [p])
  }

  return ordinalsToRender.map((ord) => {
    const year = yearOf(ord)
    const month = monthOf(ord)
    const eventsByDay = new Map<number, CalendarEvent[]>()
    for (const p of byOrdinal.get(ord) ?? []) {
      const list = eventsByDay.get(p.day)
      if (list) list.push(p.cal)
      else eventsByDay.set(p.day, [p.cal])
    }
    // Deterministic order within a day: by clock, then chapter, then title.
    for (const list of eventsByDay.values()) {
      list.sort((a, b) => a.dayNumber - b.dayNumber || a.chapterNumber - b.chapterNumber || a.title.localeCompare(b.title))
    }
    return {
      key: `${year}-${month}`,
      year,
      month,
      monthName: calendar.months[month]?.name ?? `Month ${month + 1}`,
      days: Math.max(1, Math.floor(calendar.months[month]?.days ?? 30)),
      intercalary: !!calendar.months[month]?.intercalary,
      eventsByDay,
    }
  })
}
