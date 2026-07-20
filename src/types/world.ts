/** One month of a world's calendar. */
export interface CalendarMonth {
  name: string
  days: number
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
