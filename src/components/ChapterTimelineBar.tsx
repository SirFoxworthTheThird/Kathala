import { useEffect, useRef, useMemo } from 'react'
import { useActiveWorldId, useActiveEventId, useAppStore } from '@/store'
import {
  useTimelines, useChapters, useTimelineEvents, useWorldChapters, useWorldEvents,
} from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { BAR_H_SINGLE } from '@/lib/useBarHeight'
import {
  buildCombinedSequence, groupChapterRuns, type CombinedOrder,
} from '@/lib/combinedTimeline'
import type { Chapter, WorldEvent } from '@/types'
import { useTimelinePlayback } from '@/features/timeline/useTimelinePlayback'
import { SingleTrack } from './timeline/SingleTrack'
import { StackedTrack } from './timeline/StackedTrack'
import { CombinedTrack } from './timeline/CombinedTrack'
import { TimelineScopeSelect } from './timeline/TimelineScopeSelect'
import { selectFirstEvent, activateEvent } from './timeline/TimelineControls'

/** @deprecated import BAR_H_SINGLE from @/lib/useBarHeight instead */
export const BAR_H = BAR_H_SINGLE

/** Narrative order within a single timeline: chapter number, then sortOrder. */
function orderByChapter(events: WorldEvent[], chapters: Chapter[]): WorldEvent[] {
  const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
  return [...events].sort((a, b) => {
    const aN = (chapNumById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
    const bN = (chapNumById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
    return aN - bN
  })
}

export function ChapterTimelineBar() {
  const activeEventId = useActiveEventId()
  const {
    setActiveEventId,
    setDiffOpen,
    setIsPlayingStory,
    playbackTimelineId, setPlaybackTimelineId,
    activeDepthTimelineId, setActiveDepthTimelineId,
    barScope, setBarScope,
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

  const isFrame = !!frameRel
  const multi   = !isFrame && timelines.length >= 2

  // ── Scope resolution (multi-timeline worlds) ───────────────────────────────
  // barScope is a timeline id, or 'all-chrono' / 'all-chapter'. Default merges
  // in chapter order. A stale id (deleted timeline) falls back to the merge.
  const scope = multi ? (barScope ?? 'all-chapter') : ''
  const scopedTimelineId = multi && timelines.some((t) => t.id === scope) ? scope : null
  const isCombined = multi && !scopedTimelineId
  const combinedOrder: CombinedOrder = scope === 'all-chrono' ? 'chrono' : 'chapter'

  const outerTimelineId = frameRel?.sourceTimelineId ?? null
  const innerTimelineId = frameRel?.targetTimelineId ?? null
  const outerTimelineName = timelines.find((t) => t.id === outerTimelineId)?.name ?? 'Timeline 1'
  const innerTimelineName = timelines.find((t) => t.id === innerTimelineId)?.name ?? 'Timeline 2'

  // ── Initialize / cleanup active depth (frame narratives only) ──────────────
  useEffect(() => {
    if (isFrame && outerTimelineId && innerTimelineId) {
      if (activeDepthTimelineId !== outerTimelineId && activeDepthTimelineId !== innerTimelineId) {
        setActiveDepthTimelineId(outerTimelineId)
        setPlaybackTimelineId(outerTimelineId)
      }
    } else if (activeDepthTimelineId !== null) {
      setActiveDepthTimelineId(null)
    }
  }, [isFrame, outerTimelineId, innerTimelineId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the map's playback timeline in step with the bar scope, so a chosen
  // timeline drives the map and a merged view falls back to the first timeline.
  useEffect(() => {
    if (!multi) return
    setPlaybackTimelineId(scopedTimelineId)
  }, [multi, scopedTimelineId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timeline data — all hooks unconditional ────────────────────────────────
  const outerChapters   = useChapters(outerTimelineId)
  const outerRawEvents  = useTimelineEvents(outerTimelineId)
  const innerChapters   = useChapters(innerTimelineId)
  const innerRawEvents  = useTimelineEvents(innerTimelineId)

  const singleId        = isFrame ? null : (multi ? scopedTimelineId : (playbackTimelineId ?? timelines[0]?.id ?? null))
  const singleChapters  = useChapters(singleId)
  const singleRawEvents = useTimelineEvents(singleId)

  const worldChapters   = useWorldChapters(isCombined ? worldId : null)
  const worldEvents     = useWorldEvents(isCombined ? worldId : null)

  // ── Frame-track derived data ───────────────────────────────────────────────
  const frameChapters = activeDepthTimelineId === innerTimelineId ? innerChapters  : outerChapters
  const frameEvents   = activeDepthTimelineId === innerTimelineId ? innerRawEvents : outerRawEvents
  const frameOrdered  = useMemo(() => orderByChapter(frameEvents, frameChapters), [frameEvents, frameChapters])

  // ── Single-track derived data ──────────────────────────────────────────────
  const singleOrdered = useMemo(() => orderByChapter(singleRawEvents, singleChapters), [singleRawEvents, singleChapters])

  // ── Combined derived data ──────────────────────────────────────────────────
  const combinedRows = useMemo(
    () => (isCombined ? buildCombinedSequence(worldEvents, worldChapters, timelines, combinedOrder) : []),
    [isCombined, worldEvents, worldChapters, timelines, combinedOrder],
  )
  const runs          = useMemo(() => groupChapterRuns(combinedRows), [combinedRows])
  const combinedOrdered = useMemo(() => combinedRows.map((r) => r.event), [combinedRows])

  // ── Playback ───────────────────────────────────────────────────────────────
  // Single track & frame → the events of that timeline (map animation). Merged
  // view → the combined sequence, played in place (no map jump).
  const playbackOrdered = isFrame ? frameOrdered : isCombined ? combinedOrdered : singleOrdered
  const { handlePlayPause, handleStop, cycleSpeed, isPlayingStory, playbackSpeed } =
    useTimelinePlayback(playbackOrdered, frameRel, activeDepthTimelineId, innerTimelineId, !isCombined)

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
    if (!isFrame) return
    const ref = activeDepthTimelineId === innerTimelineId ? innerMarkerRef : outerMarkerRef
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeEventId, isFrame, activeDepthTimelineId, innerTimelineId])

  // ── Colors ─────────────────────────────────────────────────────────────────
  const accentColor = timelines.find((t) => t.id === singleId)?.color ?? 'var(--tl-accent)'
  const outerColor  = timelines.find((t) => t.id === outerTimelineId)?.color ?? 'var(--tl-accent)'
  const innerColor  = timelines.find((t) => t.id === innerTimelineId)?.color ?? 'var(--tl-accent)'

  if (!timelines.length) return null

  // ── Shared handlers ────────────────────────────────────────────────────────
  const handleEventSelect = (id: string, locId?: string | null) => activateEvent(id, locId, setActiveEventId)
  const handleChapterSelect = (chId: string, events: WorldEvent[]) => selectFirstEvent(chId, events, setActiveEventId)
  const handleActivateDepth = (timelineId: string) => {
    setIsPlayingStory(false)
    setActiveDepthTimelineId(timelineId)
    setPlaybackTimelineId(timelineId)
  }

  // ── Frame narrative (stacked, synced) ──────────────────────────────────────
  if (isFrame && outerTimelineId && innerTimelineId) {
    const activeEvent   = activeEventId ? frameEvents.find((e) => e.id === activeEventId) ?? null : null
    const activeChapter = activeEvent  ? frameChapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
    const idx           = activeEventId ? frameOrdered.findIndex((e) => e.id === activeEventId) : -1
    const prevEvent     = idx > 0 ? frameOrdered[idx - 1] : null
    const nextEvent     = idx >= 0 && idx < frameOrdered.length - 1 ? frameOrdered[idx + 1] : null
    return (
      <StackedTrack
        outerChapters={outerChapters}
        outerRawEvents={outerRawEvents}
        innerChapters={innerChapters}
        innerRawEvents={innerRawEvents}
        outerTimelineId={outerTimelineId}
        innerTimelineId={innerTimelineId}
        outerTimelineLabel={outerTimelineName}
        innerTimelineLabel={innerTimelineName}
        isFrameNarrative
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

  // ── Combined (all timelines merged) ─────────────────────────────────────────
  if (isCombined) {
    if (!combinedRows.length) return null
    const activeEvent    = activeEventId ? worldEvents.find((e) => e.id === activeEventId) ?? null : null
    const activeChapter  = activeEvent  ? worldChapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
    const activeTimeline = activeEvent  ? timelines.find((t) => t.id === activeEvent.timelineId) ?? null : null
    const idx            = activeEventId ? combinedOrdered.findIndex((e) => e.id === activeEventId) : -1
    const prevEvent      = idx > 0 ? combinedOrdered[idx - 1] : null
    const nextEvent      = idx >= 0 && idx < combinedOrdered.length - 1 ? combinedOrdered[idx + 1] : null
    return (
      <CombinedTrack
        timelines={timelines}
        scope={scope}
        onScopeChange={setBarScope}
        runs={runs}
        activeEventId={activeEventId}
        activeEvent={activeEvent}
        activeChapter={activeChapter}
        activeTimeline={activeTimeline}
        hasPrev={!!prevEvent}
        hasNext={!!nextEvent}
        isPlaying={isPlayingStory}
        playbackSpeed={playbackSpeed}
        scrollerRef={scrollerRef}
        activeMarkerRef={activeMarkerRef}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onSpeedChange={cycleSpeed}
        onDiffOpen={() => setDiffOpen(true)}
        onClear={() => setActiveEventId(null)}
        onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
        onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
        onEventSelect={handleEventSelect}
      />
    )
  }

  // ── Single track (single-timeline world, or a chosen timeline) ─────────────
  // A single-timeline world with no chapters shows nothing; a multi-timeline
  // world keeps the bar so the scope selector stays reachable.
  if (!multi && !singleChapters.length) return null

  const activeEvent   = activeEventId ? singleRawEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter = activeEvent  ? singleChapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const idx           = activeEventId ? singleOrdered.findIndex((e) => e.id === activeEventId) : -1
  const prevEvent     = idx > 0 ? singleOrdered[idx - 1] : null
  const nextEvent     = idx >= 0 && idx < singleOrdered.length - 1 ? singleOrdered[idx + 1] : null

  return (
    <SingleTrack
      chapters={singleChapters}
      allEvents={singleRawEvents}
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
      onChapterSelect={(chId) => handleChapterSelect(chId, singleRawEvents)}
      scopeSelector={multi ? <TimelineScopeSelect timelines={timelines} value={scope} onChange={setBarScope} /> : undefined}
    />
  )
}
