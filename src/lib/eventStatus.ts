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
