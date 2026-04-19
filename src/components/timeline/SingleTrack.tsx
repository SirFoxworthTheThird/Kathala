import { type CSSProperties, type RefObject } from 'react'
import { BAR_H_SINGLE } from '@/lib/useBarHeight'
import type { Chapter, WorldEvent } from '@/types'
import type { PlaybackSpeed } from '@/store'
import { Controls } from './TimelineControls'
import { EventPanel } from './TimelineControls'
import { Scrubber } from './TimelineScrubber'

export interface SingleTrackProps {
  chapters: Chapter[]
  allEvents: WorldEvent[]
  activeEventId: string | null
  activeEvent: WorldEvent | null
  activeChapter: Chapter | null
  prevEvent: WorldEvent | null
  nextEvent: WorldEvent | null
  accentColor: string
  isPlayingStory: boolean
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
  onChapterSelect: (chapterId: string) => void
}

export function SingleTrack({
  chapters, allEvents, activeEventId, activeEvent, activeChapter,
  prevEvent, nextEvent, accentColor, isPlayingStory, playbackSpeed,
  scrollerRef, activeMarkerRef,
  onPlayPause, onStop, onSpeedChange, onDiffOpen, onClear,
  onPrev, onNext, onEventSelect, onChapterSelect,
}: SingleTrackProps) {
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
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
        <Controls
          isPlaying={isPlayingStory}
          speed={playbackSpeed}
          showStop={isPlayingStory}
          showDiff={!!activeEventId}
          showClear={!!activeEventId}
          color={accentColor}
          onPlayPause={onPlayPause}
          onStop={onStop}
          onSpeedChange={onSpeedChange}
          onDiffOpen={onDiffOpen}
          onClear={onClear}
        />
        {activeEvent && activeChapter && (
          <EventPanel
            chapterNum={activeChapter.number}
            chapterTitle={activeChapter.title}
            eventTitle={activeEvent.title}
            hasPrev={!!prevEvent} hasNext={!!nextEvent}
            color={accentColor}
            onPrev={onPrev}
            onNext={onNext}
          />
        )}
        <Scrubber
          chapters={chapters}
          events={allEvents}
          activeEventId={activeEventId}
          color={accentColor}
          compact={false}
          scrollerRef={scrollerRef}
          activeMarkerRef={activeMarkerRef}
          onEventSelect={onEventSelect}
          onChapterSelect={onChapterSelect}
        />
      </div>
    </div>
  )
}
