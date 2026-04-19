import { type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Square, GitCompareArrows, X } from 'lucide-react'
import type { PlaybackSpeed } from '@/store'
import { SPEED_LABEL } from '@/features/timeline/useTimelinePlayback'
import type { Chapter, WorldEvent } from '@/types'

// ── Controls bar ──────────────────────────────────────────────────────────────

export interface ControlsProps {
  isPlaying: boolean
  speed: PlaybackSpeed
  showStop: boolean
  showDiff: boolean
  showClear: boolean
  color: string
  onPlayPause: () => void
  onStop: () => void
  onSpeedChange: () => void
  onDiffOpen: () => void
  onClear: () => void
}

export function Controls({ isPlaying, speed, showStop, showDiff, showClear, color, onPlayPause, onStop, onSpeedChange, onDiffOpen, onClear }: ControlsProps) {
  const btn = (clr: string): CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', color: clr,
    padding: '0.2rem', display: 'flex', alignItems: 'center',
    borderRadius: '3px', flexShrink: 0,
  })
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.05rem',
      padding: '0 0.4rem', height: '100%', flexShrink: 0,
      borderRight: '1px solid var(--tl-border)',
    }}>
      <button onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play story on the map'} style={btn(color)}>
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>
      {showStop && (
        <button onClick={onStop} title="Stop" style={btn('var(--tl-text-muted)')}>
          <Square size={9} />
        </button>
      )}
      <button onClick={onSpeedChange} title="Playback speed" style={{
        background: 'none', border: 'none', cursor: 'pointer', borderRadius: '3px', flexShrink: 0,
        color: isPlaying ? color : 'var(--tl-text-muted)',
        fontSize: '0.55rem', fontWeight: 700, fontFamily: 'var(--font-body)',
        minWidth: '1.75rem', padding: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {SPEED_LABEL[speed]}
      </button>
      {showDiff && (
        <button onClick={onDiffOpen} title="Compare chapters" style={btn('var(--tl-text-muted)')}>
          <GitCompareArrows size={11} />
        </button>
      )}
      {showClear && (
        <button onClick={onClear} title="Clear selection" style={btn('var(--tl-text-muted)')}>
          <X size={10} />
        </button>
      )}
    </div>
  )
}

// ── Event panel ───────────────────────────────────────────────────────────────

export interface EventPanelProps {
  chapterNum: number
  chapterTitle: string
  eventTitle: string
  hasPrev: boolean
  hasNext: boolean
  color: string
  onPrev: () => void
  onNext: () => void
}

export function EventPanel({ chapterNum, chapterTitle, eventTitle, hasPrev, hasNext, color, onPrev, onNext }: EventPanelProps) {
  const navBtn = (enabled: boolean): CSSProperties => ({
    background: 'none', border: 'none', cursor: enabled ? 'pointer' : 'default',
    color: enabled ? 'var(--tl-accent)' : 'var(--tl-border)', padding: '0.1rem',
    display: 'flex', alignItems: 'center', opacity: enabled ? 1 : 0.25,
    transition: 'opacity 0.15s', flexShrink: 0,
  })
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      width: '13rem', flexShrink: 0, height: '100%',
      borderRight: '1px solid var(--tl-border)', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, minWidth: 0, padding: '0 0.4rem 0 0.6rem' }}>
        <div style={{
          fontSize: '0.54rem', color: 'var(--tl-text-muted)', fontFamily: 'var(--font-body)',
          letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Ch.{chapterNum} · {chapterTitle}
        </div>
        <div style={{
          fontSize: '0.76rem', fontWeight: 700, color, fontFamily: 'var(--font-body)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.25, marginTop: '2px', transition: 'color 0.2s',
        }}>
          {eventTitle}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '0.3rem', gap: '1px' }}>
        <button onClick={onPrev} disabled={!hasPrev} style={navBtn(hasPrev)}><ChevronLeft size={11} /></button>
        <button onClick={onNext} disabled={!hasNext} style={navBtn(hasNext)}><ChevronRight size={11} /></button>
      </div>
    </div>
  )
}

// ── Shared nav helpers ────────────────────────────────────────────────────────

/** Select the first event in a chapter from a flat sorted list. */
export function selectFirstEvent(chapterId: string, events: WorldEvent[], setActiveEventId: (id: string) => void) {
  const first = events
    .filter((e) => e.chapterId === chapterId)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
  if (first) setActiveEventId(first.id)
}

/** Dispatch a map focus event and set the active event. */
export function activateEvent(
  eventId: string,
  locationMarkerId: string | null | undefined,
  setActiveEventId: (id: string) => void
) {
  setActiveEventId(eventId)
  if (locationMarkerId) {
    window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: locationMarkerId } }))
  }
}

export type { Chapter, WorldEvent }
