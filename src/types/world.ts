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

/** A custom in-world calendar. Day 0 of the in-world clock is 1 <first month> <startYear>. */
export interface WorldCalendar {
  months: CalendarMonth[]
  /** The year that in-world day 0 falls in. */
  startYear: number
  /** Optional suffix shown after the year, e.g. "AC", "TA". */
  yearSuffix?: string
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

export interface AppPreferences {
  id: 1
  activeWorldId: string | null
  theme: 'dark' | 'light'
  sidebarWidth: number
  defaultTimelineId: string | null
}
