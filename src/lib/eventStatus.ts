import type { EventStatus } from '@/types'

export const EVENT_STATUSES: EventStatus[] = ['idea', 'outline', 'draft', 'revised', 'final']

// All five background colors have relative luminance > 0.18, giving < 3.4:1 contrast with
// white text — well below the WCAG AA threshold of 4.5:1. Dark text (#1f2937) passes for
// all five (minimum ratio ~5.0:1 for the darkest, #a78bfa purple).
export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string; textColor: string }> = {
  idea:    { label: 'Idea',    color: '#9ca3af', textColor: '#1f2937' },
  outline: { label: 'Outline', color: '#60a5fa', textColor: '#1f2937' },
  draft:   { label: 'Draft',   color: '#fbbf24', textColor: '#1f2937' },
  revised: { label: 'Revised', color: '#a78bfa', textColor: '#1f2937' },
  final:   { label: 'Final',   color: '#4ade80', textColor: '#1f2937' },
}

/**
 * The display config for a status, for any value at all.
 *
 * `WorldEvent['status']` is typed as EventStatus, but nothing enforces that at
 * runtime: `validateImport` checks that arrays are arrays and never inspects a
 * single enum value, so a `.pwk` — hand-written, AI-generated, or produced by
 * an older build — can carry any string it likes. Indexing the record directly
 * then yields undefined, and the very next `.color` throws, which is a blank
 * screen rather than a mildly wrong badge.
 *
 * An unrecognised status is shown as itself in a neutral colour rather than
 * relabelled as one of the five. Quietly calling someone's "published" a
 * "Draft" would be a lie the user cannot see through.
 */
export function eventStatusConfig(status: unknown): { label: string; color: string; textColor: string } {
  // Membership is checked against the list, not with `in`: `'toString' in
  // EVENT_STATUS_CONFIG` is true through the prototype chain, and would hand
  // back a function to read `.label` off.
  if (typeof status === 'string' && (EVENT_STATUSES as readonly string[]).includes(status)) {
    return EVENT_STATUS_CONFIG[status as EventStatus]
  }
  const label = typeof status === 'string' && status.trim() ? status.trim() : 'Unknown'
  return { label, color: '#94a3b8', textColor: '#1f2937' }
}
