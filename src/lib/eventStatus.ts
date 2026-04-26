import type { EventStatus } from '@/types'

export const EVENT_STATUSES: EventStatus[] = ['idea', 'outline', 'draft', 'revised', 'final']

export const EVENT_STATUS_CONFIG: Record<EventStatus, { label: string; color: string }> = {
  idea:    { label: 'Idea',    color: '#9ca3af' },
  outline: { label: 'Outline', color: '#60a5fa' },
  draft:   { label: 'Draft',   color: '#fbbf24' },
  revised: { label: 'Revised', color: '#a78bfa' },
  final:   { label: 'Final',   color: '#4ade80' },
}
