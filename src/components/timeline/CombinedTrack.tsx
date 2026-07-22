import { type CSSProperties, type RefObject } from 'react'
import { BAR_H_SINGLE } from '@/lib/useBarHeight'
import type { Chapter, Timeline, WorldEvent } from '@/types'
import type { ChapterRun } from '@/lib/combinedTimeline'
import type { PlaybackSpeed } from '@/store'
import { Controls, EventPanel } from './TimelineControls'
import { CombinedScrubber } from './TimelineScrubber'
import { TimelineScopeSelect } from './TimelineScopeSelect'

export interface CombinedTrackProps {
  timelines: Timeline[]
  scope: string
  onScopeChange: (scope: string) => void
  runs: ChapterRun[]
  activeEventId: string | null
  activeEvent: WorldEvent | null
  activeChapter: Chapter | null
  activeTimeline: Timeline | null
  hasPrev: boolean
  hasNext: boolean
  isPlaying: boolean
  playbackSpeed: PlaybackSpeed
  scrollerRef: RefObject<HTMLDivElement | null>
  activeMarkerRef: RefObject<HTMLButtonElement | null>
  onPlayPause: () => void
  onStop: () => void
  onSpeedChange: () => void
  onDiffOpen: () => void
  onClear: () => void
  onPrev: () => void
  onNext: () => void
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
}

/**
 * Single-height bottom bar for a multi-timeline world when the user chooses to
 * see every storyline at once: a scope selector, the active event panel, and a
 * combined scrubber of chapter runs tinted by timeline. Play is an in-place
 * read-through of the merged sequence (the fill sweeps the whole strip and the
 * side panels update) — map animation stays per-timeline.
 */
export function CombinedTrack({
  timelines, scope, onScopeChange, runs,
  activeEventId, activeEvent, activeChapter, activeTimeline,
  hasPrev, hasNext, isPlaying, playbackSpeed, scrollerRef, activeMarkerRef,
  onPlayPause, onStop, onSpeedChange, onDiffOpen, onClear, onPrev, onNext, onEventSelect,
}: CombinedTrackProps) {
  const accent = activeTimeline?.color ?? 'var(--tl-accent)'
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 'var(--pw-nav-w, 0px)', right: 0, zIndex: 1000 }}>
      <div style={{
        height: BAR_H_SINGLE,
        background: 'var(--tl-bg)',
        borderTop: '1px solid var(--tl-border)',
        backdropFilter: 'var(--tl-backdrop)',
        WebkitBackdropFilter: 'var(--tl-backdrop)' as CSSProperties['WebkitBackdropFilter'],
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}>
        <TimelineScopeSelect timelines={timelines} value={scope} onChange={onScopeChange} />
        <Controls
          isPlaying={isPlaying}
          speed={playbackSpeed}
          showStop={isPlaying}
          showDiff={!!activeEventId}
          showClear={!!activeEventId && !isPlaying}
          color={accent}
          onPlayPause={onPlayPause}
          onStop={onStop}
          onSpeedChange={onSpeedChange}
          onDiffOpen={onDiffOpen}
          onClear={onClear}
          playLabel="Play through the merged sequence"
        />
        {activeEvent && activeChapter && (
          <EventPanel
            chapterNum={activeChapter.number}
            chapterTitle={activeChapter.title}
            eventTitle={activeEvent.title}
            hasPrev={hasPrev} hasNext={hasNext}
            color={accent}
            timelineLabel={activeTimeline?.name}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}
        <CombinedScrubber
          runs={runs}
          activeEventId={activeEventId}
          scrollerRef={scrollerRef}
          activeMarkerRef={activeMarkerRef}
          onEventSelect={onEventSelect}
        />
      </div>
    </div>
  )
}
