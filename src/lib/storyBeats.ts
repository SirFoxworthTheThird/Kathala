/**
 * A compact, genre-agnostic three-act beat sheet. Each event may be tagged with
 * at most one beat; the curve and timeline surface them as structural landmarks
 * so a writer can see whether their intensity actually peaks where the structure
 * says it should.
 */
export interface StoryBeat {
  id: string
  label: string
  /** Compact label for tight spots like the pacing-curve annotations. */
  short: string
  /** Which act the beat conventionally sits in (1–3) — drives grouping/tint. */
  act: 1 | 2 | 3
  /** One-line reminder of the beat's job, shown as a hint. */
  hint: string
}

export const STORY_BEATS: readonly StoryBeat[] = [
  { id: 'hook', label: 'Hook', short: 'Hook', act: 1, hint: 'Opens the story and poses its question.' },
  { id: 'inciting-incident', label: 'Inciting Incident', short: 'Incite', act: 1, hint: 'The event that disrupts the ordinary world.' },
  { id: 'plot-point-1', label: 'Plot Point 1', short: 'PP1', act: 1, hint: 'The protagonist commits — end of Act 1.' },
  { id: 'midpoint', label: 'Midpoint', short: 'Mid', act: 2, hint: 'A reversal or revelation that raises the stakes.' },
  { id: 'plot-point-2', label: 'Plot Point 2', short: 'PP2', act: 2, hint: 'The low point that launches Act 3.' },
  { id: 'climax', label: 'Climax', short: 'Climax', act: 3, hint: 'The final confrontation — peak intensity.' },
  { id: 'resolution', label: 'Resolution', short: 'Resolve', act: 3, hint: 'The aftermath and new normal.' },
] as const

const BEAT_BY_ID = new Map(STORY_BEATS.map((b) => [b.id, b]))

/** Look up a beat by id, or undefined for null/unknown ids. */
export function beatById(id: string | null | undefined): StoryBeat | undefined {
  if (id == null) return undefined
  return BEAT_BY_ID.get(id)
}

/** Human label for a beat id; falls back to the raw id, or 'None' for null. */
export function beatLabel(id: string | null | undefined): string {
  if (id == null) return 'None'
  return BEAT_BY_ID.get(id)?.label ?? id
}

/** A subtle per-act accent color (hsl string) for tinting beat chips/markers. */
export function beatActColor(act: 1 | 2 | 3): string {
  switch (act) {
    case 1: return 'hsl(200, 70%, 55%)'
    case 2: return 'hsl(275, 60%, 60%)'
    case 3: return 'hsl(15, 75%, 58%)'
  }
}
