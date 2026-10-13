import type { ChapterHeadingStyle } from '@/lib/chapterHeading'
/**
 * One stretch of a world's calendar year: an ordinary month, or a run of days
 * that belongs to no month.
 *
 * The arithmetic never cared which — `daysPerYear` and `dayNumberToDate` walk
 * this list and only ever ask how long each entry is — so a calendar with
 * intercalary days (the Shire Reckoning's Yule and Lithe, the Four Corners'
 * span days) could always be *entered* correctly, as one-day entries. What it
 * could not do was read correctly: "1 Midyear's Day" rather than "Midyear's
 * Day". `intercalary` is that display flag and nothing more.
 */
export interface CalendarMonth {
  name: string
  days: number
  /**
   * Days outside the month cycle. A one-day entry prints as its bare name; a
   * longer one still numbers within itself, which is what "2 Lithe" wants.
   *
   * Absent means an ordinary month, so every calendar written before this
   * existed keeps its meaning.
   */
  intercalary?: boolean
}

/**
 * A calendar's week: its days' names, in order, and which of them in-world
 * day 0 falls on. Days outside the months (`CalendarMonth.intercalary`) are
 * outside the week too, as the calendars that have them keep them.
 */
export interface CalendarWeek {
  days: string[]
  /** Index into `days` of the weekday of in-world day 0. */
  first: number
}

/** A custom in-world calendar. Day 0 of the in-world clock is 1 <first month> <startYear>. */
export interface WorldCalendar {
  months: CalendarMonth[]
  /** The year that in-world day 0 falls in. */
  startYear: number
  /** Optional suffix shown after the year, e.g. "AC", "TA". */
  yearSuffix?: string
  /** Optional week; absent means the calendar has none, and its dates no weekdays (writer run 9). */
  week?: CalendarWeek
}

/** A date on the world calendar. `month` is 0-based; `day` is 1-based. */
export interface InWorldDate {
  year: number
  month: number
  day: number
}

export interface World {
  id: string
  name: string
  description: string
  coverImageId: string | null
  /** Per-world theme class name. null = inherit the global app theme. */
  theme: string | null
  /** Consecutive involved-events without a snapshot update before a stale-state warning fires. Default 5. */
  continuityStaleThreshold: number
  /** Optional custom calendar; null/absent = no calendar (dates shown as "Day N"). */
  calendar?: WorldCalendar | null
  /**
   * What a scene pinned to a date does to the scenes after it (a flashback's
   * pin is only ever its own date):
   * - `true` — it sets the clock: the scenes after it count on from its date.
   * - absent or `false` — it keeps only its own date, and the scenes after it
   *   count on from where the clock was before it.
   *
   * New books are made with `true` (`createWorld`). Absent is the old rule, so a
   * book written before the choice existed — or imported from before it — keeps
   * the dates it had. See `computeInWorldDays`.
   */
  pinsSetClock?: boolean
  /**
   * How chapters are headed in an exported book (`chapterHeading`), as last
   * chosen in the export dialog. Absent is "Ch. 1 — Title", as before it existed.
   */
  chapterHeading?: ChapterHeadingStyle
  /** Optional book-level manuscript word target, for the writing-progress burndown. */
  wordTarget?: number | null
  /** Optional manuscript deadline (`YYYY-MM-DD`), for the words/day and finish projection. */
  targetDate?: string | null
  /**
   * Reading mode: the world is presented to someone reading the book rather
   * than writing it. Entities the story has not introduced yet are hidden, the
   * manuscript is out of the way, and editing is not offered.
   *
   * Stored on the world rather than in UI state so it travels in `.pwk` — the
   * library worlds arrive with it on, which is the point of them.
   */
  readingMode?: boolean
  createdAt: number
  updatedAt: number
}

