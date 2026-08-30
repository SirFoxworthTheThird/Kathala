import { ChevronUp } from 'lucide-react'
import { BAR_H_COLLAPSED } from '@/lib/useBarHeight'

export interface CollapsedBarProps {
  /** Where the cursor is, as "Ch.3 · The gate opens", or null when nothing is selected. */
  label: string | null
  onExpand: () => void
}

/**
 * The chapter bar rolled up (MT-3). It is fixed chrome on every screen in a
 * world, and the map and the manuscript both want that height; this gives most
 * of it back while keeping the two things the bar is for at this size — knowing
 * where the cursor is, and getting the bar back.
 *
 * The whole strip is the button, so hitting it needs no aim. Its accessible
 * name comes from aria-label rather than its content, which changes with the
 * cursor.
 */
export function CollapsedBar({ label, onExpand }: CollapsedBarProps) {
  return (
    <div
      data-chapter-bar="collapsed"
      style={{ position: 'fixed', bottom: 0, left: 'var(--pw-nav-w, 0px)', right: 0, zIndex: 1000 }}
    >
      <button
        onClick={onExpand}
        aria-label="Show the chapter bar"
        title="Show the chapter bar"
        style={{
          width: '100%', height: BAR_H_COLLAPSED,
          background: 'var(--tl-bg)',
          borderTop: '1px solid var(--tl-border)',
          borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0 0.6rem', cursor: 'pointer', overflow: 'hidden',
          fontFamily: 'var(--font-body)', textAlign: 'left',
        }}
      >
        <ChevronUp size={12} style={{ color: 'var(--tl-accent)', flexShrink: 0 }} />
        <span style={{
          fontSize: '0.6rem', color: label ? 'var(--tl-text)' : 'var(--tl-text-muted)',
          letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label ?? 'Chapter bar'}
        </span>
      </button>
    </div>
  )
}
