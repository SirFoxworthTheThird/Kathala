import { useEffect, useRef, useMemo } from 'react'
import { useActiveWorldId, useActiveEventId, useAppStore } from '@/store'
import { useTimelines, useChapters, useTimelineEvents } from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { BAR_H_SINGLE } from '@/lib/useBarHeight'
import { useTimelinePlayback } from '@/features/timeline/useTimelinePlayback'
import { SingleTrack } from './timeline/SingleTrack'
import { StackedTrack } from './timeline/StackedTrack'
import { selectFirstEvent, activateEvent } from './timeline/TimelineControls'

/** @deprecated import BAR_H_SINGLE from @/lib/useBarHeight instead */
export const BAR_H = BAR_H_SINGLE

export function ChapterTimelineBar() {
  const activeEventId = useActiveEventId()
  const {
    setActiveEventId,
    setDiffOpen,
    setIsPlayingStory,
    playbackTimelineId, setPlaybackTimelineId,
    activeDepthTimelineId, setActiveDepthTimelineId,
  } = useAppStore()
  const worldId = useActiveWorldId()

  const timelines     = useTimelines(worldId)
  const relationships = useTimelineRelationships(worldId)

  // ── Frame narrative detection ──────────────────────────────────────────────
  const frameRel = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.find(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    ) ?? null
  }, [relationships, timelines])

  const outerTimelineId = frameRel?.sourceTimelineId ?? null
  const innerTimelineId = frameRel?.targetTimelineId ?? null

  // ── Initialize / cleanup active depth ─────────────────────────────────────
  useEffect(() => {
    if (frameRel) {
      if (activeDepthTimelineId !== frameRel.sourceTimelineId && activeDepthTimelineId !== frameRel.targetTimelineId) {
        setActiveDepthTimelineId(frameRel.sourceTimelineId)
        setPlaybackTimelineId(frameRel.sourceTimelineId)
      }
    } else if (activeDepthTimelineId !== null) {
      setActiveDepthTimelineId(null)
      setPlaybackTimelineId(null)
    }
  }, [frameRel?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timeline data — all hooks unconditional ────────────────────────────────
  const outerChapters   = useChapters(outerTimelineId)
  const outerRawEvents  = useTimelineEvents(outerTimelineId)
  const innerChapters   = useChapters(innerTimelineId)
  const innerRawEvents  = useTimelineEvents(innerTimelineId)
  const singleId        = frameRel ? null : (playbackTimelineId ?? timelines[0]?.id ?? null)
  const singleChapters  = useChapters(singleId)
  const singleRawEvents = useTimelineEvents(singleId)

  const chapters  = frameRel ? (activeDepthTimelineId === innerTimelineId ? innerChapters  : outerChapters)  : singleChapters
  const allEvents = frameRel ? (activeDepthTimelineId === innerTimelineId ? innerRawEvents : outerRawEvents) : singleRawEvents

  // ── Ordered events for playback ────────────────────────────────────────────
  const orderedEvents = useMemo(() => {
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...allEvents].sort((a, b) => {
      const aN = (chapNumById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
      const bN = (chapNumById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
      return aN - bN
    })
  }, [allEvents, chapters])

  const activeEvent      = activeEventId ? allEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter    = activeEvent   ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const activeEventIndex = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const prevEvent        = activeEventIndex > 0 ? orderedEvents[activeEventIndex - 1] : null
  const nextEvent        = activeEventIndex < orderedEvents.length - 1 ? orderedEvents[activeEventIndex + 1] : null

  // ── Playback ───────────────────────────────────────────────────────────────
  const { handlePlayPause, handleStop, cycleSpeed, isPlayingStory, playbackSpeed } =
    useTimelinePlayback(orderedEvents, frameRel, activeDepthTimelineId, innerTimelineId)

  // ── Scroll refs ────────────────────────────────────────────────────────────
  const scrollerRef      = useRef<HTMLDivElement>(null)
  const activeMarkerRef  = useRef<HTMLButtonElement>(null)
  const outerScrollerRef = useRef<HTMLDivElement>(null)
  const innerScrollerRef = useRef<HTMLDivElement>(null)
  const outerMarkerRef   = useRef<HTMLButtonElement>(null)
  const innerMarkerRef   = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeMarkerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeEventId])

  useEffect(() => {
    if (!frameRel) return
    const ref = activeDepthTimelineId === innerTimelineId ? innerMarkerRef : outerMarkerRef
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeEventId, frameRel, activeDepthTimelineId, innerTimelineId])

  // ── Color resolution ───────────────────────────────────────────────────────
  const accentColor = timelines.find((t) => t.id === singleId)?.color ?? 'var(--tl-accent)'
  const outerColor  = timelines.find((t) => t.id === outerTimelineId)?.color ?? 'var(--tl-accent)'
  const innerColor  = timelines.find((t) => t.id === innerTimelineId)?.color ?? 'var(--tl-accent)'

  if (!timelines.length) return null
  if (!frameRel && !chapters.length) return null

  // ── Shared handlers ────────────────────────────────────────────────────────
  const handleEventSelect = (id: string, locId?: string | null) => activateEvent(id, locId, setActiveEventId)
  const handleChapterSelect = (chId: string, events = allEvents) => selectFirstEvent(chId, events, setActiveEventId)
  const handleActivateDepth = (timelineId: string) => {
    setIsPlayingStory(false)
    setActiveDepthTimelineId(timelineId)
    setPlaybackTimelineId(timelineId)
  }

  // ── Stacked render (frame narrative) ──────────────────────────────────────
  if (frameRel && outerTimelineId && innerTimelineId) {
    return (
      <StackedTrack
        outerChapters={outerChapters}
        outerRawEvents={outerRawEvents}
        innerChapters={innerChapters}
        innerRawEvents={innerRawEvents}
        outerTimelineId={outerTimelineId}
        innerTimelineId={innerTimelineId}
        isOuterActive={activeDepthTimelineId !== innerTimelineId}
        outerColor={outerColor}
        innerColor={innerColor}
        isPlayingStory={isPlayingStory}
        playbackSpeed={playbackSpeed}
        activeEventId={activeEventId}
        activeEvent={activeEvent}
        activeChapter={activeChapter}
        prevEvent={prevEvent}
        nextEvent={nextEvent}
        outerScrollerRef={outerScrollerRef}
        innerScrollerRef={innerScrollerRef}
        outerMarkerRef={outerMarkerRef}
        innerMarkerRef={innerMarkerRef}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onSpeedChange={cycleSpeed}
        onDiffOpen={() => setDiffOpen(true)}
        onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
        onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
        onEventSelect={handleEventSelect}
        onChapterSelect={handleChapterSelect}
        onActivateDepth={handleActivateDepth}
        setActiveEventId={setActiveEventId}
      />
    )
  }

  // ── Single-track render ────────────────────────────────────────────────────
  return (
    <SingleTrack
      chapters={chapters}
      allEvents={allEvents}
      activeEventId={activeEventId}
      activeEvent={activeEvent}
      activeChapter={activeChapter}
      prevEvent={prevEvent}
      nextEvent={nextEvent}
      accentColor={accentColor}
      isPlayingStory={isPlayingStory}
      playbackSpeed={playbackSpeed}
      scrollerRef={scrollerRef}
      activeMarkerRef={activeMarkerRef}
      onPlayPause={handlePlayPause}
      onStop={handleStop}
      onSpeedChange={cycleSpeed}
      onDiffOpen={() => setDiffOpen(true)}
      onClear={handleStop}
      onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
      onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
      onEventSelect={handleEventSelect}
      onChapterSelect={handleChapterSelect}
    />
  )
}
