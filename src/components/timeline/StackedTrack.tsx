import { type CSSProperties, type RefObject } from 'react'
import { BAR_H_STACKED } from '@/lib/useBarHeight'
import type { Chapter, WorldEvent } from '@/types'
import type { PlaybackSpeed } from '@/store'
import { Controls } from './TimelineControls'
import { EventPanel } from './TimelineControls'
import { Scrubber } from './TimelineScrubber'

export interface StackedTrackProps {
  outerChapters: Chapter[]
  outerRawEvents: WorldEvent[]
  innerChapters: Chapter[]
  innerRawEvents: WorldEvent[]
  outerTimelineId: string
  innerTimelineId: string
  outerTimelineLabel: string
  innerTimelineLabel: string
  isFrameNarrative: boolean
  isOuterActive: boolean
  outerColor: string
  innerColor: string
  isPlayingStory: boolean
  playbackSpeed: PlaybackSpeed
  activeEventId: string | null
  activeEvent: WorldEvent | null
  activeChapter: Chapter | null
  prevEvent: WorldEvent | null
  nextEvent: WorldEvent | null
  outerScrollerRef: RefObject<HTMLDivElement | null>
  innerScrollerRef: RefObject<HTMLDivElement | null>
  outerMarkerRef: RefObject<HTMLButtonElement | null>
  innerMarkerRef: RefObject<HTMLButtonElement | null>
  onPlayPause: () => void
  onStop: () => void
  onSpeedChange: () => void
  onDiffOpen: () => void
  onPrev: () => void
  onNext: () => void
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
  onChapterSelect: (chapterId: string, events: WorldEvent[]) => void
  onActivateDepth: (timelineId: string) => void
  setActiveEventId: (id: string) => void
}

export function StackedTrack({
  outerChapters, outerRawEvents, innerChapters, innerRawEvents,
  outerTimelineId, innerTimelineId, outerTimelineLabel, innerTimelineLabel,
  isFrameNarrative, isOuterActive,
  outerColor, innerColor, isPlayingStory, playbackSpeed,
  activeEventId, activeEvent, activeChapter, prevEvent, nextEvent,
  outerScrollerRef, innerScrollerRef, outerMarkerRef, innerMarkerRef,
  onPlayPause, onStop, onSpeedChange, onDiffOpen,
  onPrev, onNext, onEventSelect, onChapterSelect, onActivateDepth,
}: StackedTrackProps) {
  const badgeStyle = (active: boolean, color: string): CSSProperties => ({
    fontSize: '0.48rem', fontWeight: 800, letterSpacing: '0.12em',
    color: active ? color : 'var(--tl-text-muted)',
    fontFamily: 'var(--font-body)', textTransform: 'uppercase',
    transition: 'color 0.2s', whiteSpace: 'nowrap',
  })

  const trackStyle = (active: boolean, height: string): CSSProperties => ({
    height, display: 'flex', alignItems: 'center', overflow: 'hidden',
    opacity: active ? 1 : 0.55, transition: 'opacity 0.2s',
    cursor: active ? 'default' : 'pointer',
  })

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
      <div style={{
        height: BAR_H_STACKED,
        background: 'var(--tl-bg)',
        borderTop: '1px solid var(--tl-border)',
        backdropFilter: 'var(--tl-backdrop)',
        WebkitBackdropFilter: 'var(--tl-backdrop)' as CSSProperties['WebkitBackdropFilter'],
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-body)',
      }}>

        {/* ── Outer (frame) track — thin ── */}
        <div
          style={trackStyle(isOuterActive, isFrameNarrative ? '2.25rem' : 'calc(50% - 0.5px)')}
          onClick={isOuterActive ? undefined : () => onActivateDepth(outerTimelineId)}
        >
          <div style={{
            padding: '0 0.5rem', height: '100%', display: 'flex', alignItems: 'center',
            borderRight: '1px solid var(--tl-border)', flexShrink: 0, gap: '0.35rem',
          }}>
            <span style={badgeStyle(isOuterActive, outerColor)}>{outerTimelineLabel}</span>
          </div>
          <Controls
            isPlaying={isPlayingStory && isOuterActive}
            speed={playbackSpeed}
            showStop={isPlayingStory && isOuterActive}
            showDiff={isOuterActive && !!activeEventId}
            showClear={isOuterActive && !!activeEventId}
            color={outerColor}
            onPlayPause={onPlayPause}
            onStop={onStop}
            onSpeedChange={onSpeedChange}
            onDiffOpen={onDiffOpen}
            onClear={onStop}
          />
          {isOuterActive && activeEvent && activeChapter && (
            <EventPanel
              chapterNum={activeChapter.number}
              chapterTitle={activeChapter.title}
              eventTitle={activeEvent.title}
              hasPrev={!!prevEvent} hasNext={!!nextEvent}
              color={outerColor}
              onPrev={onPrev}
              onNext={onNext}
            />
          )}
          <Scrubber
            chapters={outerChapters}
            events={outerRawEvents}
            activeEventId={isOuterActive ? activeEventId : null}
            color={outerColor}
            compact={isFrameNarrative}
            scrollerRef={outerScrollerRef}
            activeMarkerRef={outerMarkerRef}
            onEventSelect={onEventSelect}
            onChapterSelect={(chId) => onChapterSelect(chId, outerRawEvents)}
          />
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--tl-border)', flexShrink: 0 }} />

        {/* ── Inner (story) track — full height ── */}
        <div
          style={trackStyle(!isOuterActive, isFrameNarrative ? 'calc(100% - 2.25rem - 1px)' : 'calc(50% - 0.5px)')}
          onClick={!isOuterActive ? undefined : () => onActivateDepth(innerTimelineId)}
        >
          <div style={{
            padding: '0 0.5rem', height: '100%', display: 'flex', alignItems: 'center',
            borderRight: '1px solid var(--tl-border)', flexShrink: 0,
          }}>
            <span style={badgeStyle(!isOuterActive, innerColor)}>{innerTimelineLabel}</span>
          </div>
          <Controls
            isPlaying={isPlayingStory && !isOuterActive}
            speed={playbackSpeed}
            showStop={isPlayingStory && !isOuterActive}
            showDiff={!isOuterActive && !!activeEventId}
            showClear={!isOuterActive && !!activeEventId}
            color={innerColor}
            onPlayPause={onPlayPause}
            onStop={onStop}
            onSpeedChange={onSpeedChange}
            onDiffOpen={onDiffOpen}
            onClear={onStop}
          />
          {!isOuterActive && activeEvent && activeChapter && (
            <EventPanel
              chapterNum={activeChapter.number}
              chapterTitle={activeChapter.title}
              eventTitle={activeEvent.title}
              hasPrev={!!prevEvent} hasNext={!!nextEvent}
              color={innerColor}
              onPrev={onPrev}
              onNext={onNext}
            />
          )}
          <Scrubber
            chapters={innerChapters}
            events={innerRawEvents}
            activeEventId={!isOuterActive ? activeEventId : null}
            color={innerColor}
            compact={false}
            scrollerRef={innerScrollerRef}
            activeMarkerRef={innerMarkerRef}
            onEventSelect={onEventSelect}
            onChapterSelect={(chId) => onChapterSelect(chId, innerRawEvents)}
          />
        </div>

      </div>
    </div>
  )
}
