import type { WorldEvent, Chapter } from '@/types'

/** The rateable dramatic-intensity levels, low → high. */
export const TENSION_LEVELS = [1, 2, 3, 4, 5] as const

const TENSION_LABELS: Record<number, string> = {
  1: 'Calm',
  2: 'Simmering',
  3: 'Charged',
  4: 'Intense',
  5: 'Climactic',
}

/** Human label for a tension level. Falls back to the number for anything unexpected. */
export function tensionLabel(level: number | null | undefined): string {
  if (level == null) return 'Unrated'
  return TENSION_LABELS[level] ?? `Level ${level}`
}

/**
 * A calm-blue → hot-red ramp for a 1–5 tension level. Returns an hsl() string
 * so callers can drop it straight into an inline style. null/undefined levels
 * get a neutral muted tone.
 */
export function tensionColor(level: number | null | undefined): string {
  if (level == null) return 'hsl(var(--muted-foreground))'
  // Hue sweeps 210° (blue) → 0° (red) across levels 1..5.
  const t = Math.min(1, Math.max(0, (level - 1) / 4))
  const hue = 210 - 210 * t
  return `hsl(${Math.round(hue)}, 75%, 52%)`
}

/** One plotted point on the pacing curve. */
export interface PacingPoint {
  eventId: string
  title: string
  chapterNumber: number | null
  /** 1–5 rating, or null when the event is unrated (drawn as a gap). */
  tension: number | null
  isFlashback: boolean
}

/**
 * Builds the ordered sequence of pacing points for a set of events.
 *
 * `order` chooses the reading axis:
 *  - 'narrative'      — chapter number then sortOrder (the page order).
 *  - 'chronological'  — the resolved in-world day, falling back to narrative
 *                       order for events that share (or lack) a day.
 *
 * Pure and derived; nothing is stored. Unrated events are kept in the sequence
 * with `tension: null` so the caller can render them as gaps rather than zeros.
 */
export function computePacingCurve({
  events,
  chapters,
  order,
  inWorldDayByEvent,
}: {
  events: WorldEvent[]
  chapters: Chapter[]
  order: 'narrative' | 'chronological'
  /** Resolved in-world day per event id — only consulted for chronological order. */
  inWorldDayByEvent?: Map<string, number>
}): PacingPoint[] {
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))

  const narrativeKey = (e: WorldEvent): number =>
    (chapterNumber.get(e.chapterId) ?? 0) * 1_000_000 + e.sortOrder

  const sorted = [...events].sort((a, b) => {
    if (order === 'chronological') {
      const da = inWorldDayByEvent?.get(a.id)
      const db = inWorldDayByEvent?.get(b.id)
      if (da != null && db != null && da !== db) return da - db
    }
    return narrativeKey(a) - narrativeKey(b)
  })

  return sorted.map((e) => ({
    eventId: e.id,
    title: e.title,
    chapterNumber: chapterNumber.get(e.chapterId) ?? null,
    tension: e.tension ?? null,
    isFlashback: e.isFlashback ?? false,
  }))
}
