import { type CSSProperties } from 'react'
import type { Timeline } from '@/types'

export interface TimelineScopeSelectProps {
  timelines: Timeline[]
  /** A timeline id, or 'all-chrono' / 'all-chapter'. */
  value: string
  onChange: (value: string) => void
}

/**
 * Compact picker at the left of the bottom bar in a multi-timeline world: view
 * one timeline, or all of them merged in chronological or chapter order. A
 * native <select> keeps it small and keyboard-accessible inside the thin bar.
 */
export function TimelineScopeSelect({ timelines, value, onChange }: TimelineScopeSelectProps) {
  const active = value === 'all-chrono' || value === 'all-chapter'
    ? 'var(--tl-accent)'
    : (timelines.find((t) => t.id === value)?.color ?? 'var(--tl-accent)')

  const wrap: CSSProperties = {
    display: 'flex', alignItems: 'center', height: '100%', flexShrink: 0,
    padding: '0 0.4rem', borderRight: '1px solid var(--tl-border)',
    maxWidth: '9rem',
  }
  const select: CSSProperties = {
    background: 'transparent', border: 'none', outline: 'none', cursor: 'pointer',
    color: active, fontWeight: 700, fontSize: '0.6rem', fontFamily: 'var(--font-body)',
    letterSpacing: '0.02em', maxWidth: '8.5rem', textOverflow: 'ellipsis',
  }

  return (
    <div style={wrap}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Timeline bar scope"
        title="Choose which timeline(s) the bar shows"
        style={select}
      >
        <optgroup label="One timeline">
          {timelines.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </optgroup>
        <optgroup label="All timelines">
          <option value="all-chapter">All · Chapter order</option>
          <option value="all-chrono">All · Chronological</option>
        </optgroup>
      </select>
    </div>
  )
}
