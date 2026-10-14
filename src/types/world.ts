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
  /**
   * Optional eras, in order: how stretches of years are numbered and named —
   * BBY counting down to ABY, BC to AD, the Second Age to the Third. Absent
   * means one count up from `startYear`, with `yearSuffix` after it; with eras,
   * each era's label is said after the year instead
   * (docs/records/scene-time-plan.md, Part 2).
   */
  eras?: CalendarEra[]
  /**
   * Optional leap years: absent means every year is the same length, as every
   * calendar was before this existed — and as the library's are still, since
   * their dates were worked out that way.
   */
  leap?: CalendarLeap
}

/**
 * Which years are leap years, and what they gain. A year inside the calendar
 * (`startYear` is one) is a leap year when it divides by `every`, except when
 * it divides by `skip`, unless it divides by `keep`: the Gregorian rule is 4,
 * 100 and 400; the Julian, 4 alone; the Shire's, 4 and 100.
 */
export interface CalendarLeap {
  /**
   * The entry, an index into `months`, that gains `days` in a leap year:
   * February; or a day outside the months, as the Shire's Overlithe, which has
   * no days at all in other years — the one entry that may have none.
   */
  month: number
  days: number
  every: number
  skip?: number
  keep?: number
}

/**
 * An era: a stretch of years with its own label and count. The calendar's
 * years inside stay one signed count — `startYear` is one of them — and an era
 * is how that count is *said*.
 */
export interface CalendarEra {
  /** Said after the year: "BBY", "AD", "TA". */
  label: string
  /** The year, as the calendar counts inside, this era begins in. Absent on the first, which runs back without end. */
  start?: number
  /**
   * `down` counts towards the next era's start — 19 BBY, then 18 BBY. Only the
   * first era can, and only with an era after it to count to; any other is
   * read as `up`.
   */
  counts: 'up' | 'down'
  /** What its first year is numbered — for an era counting down, its last: 1 BC, 1 BBY. */
  first: number
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

