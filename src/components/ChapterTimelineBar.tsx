import { useEffect, useRef, useMemo, useState } from 'react'
import { useActiveWorldId, useActiveEventId, useAppStore } from '@/store'
import {
  useTimelines, useChapters, useTimelineEvents, useWorldChapters, useWorldEvents, useAllWorldEvents,
} from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import {
  buildCombinedSequence, groupChapterRuns, type CombinedOrder,
} from '@/lib/combinedTimeline'
import type { Chapter, WorldEvent } from '@/types'
import { useTimelinePlayback } from '@/features/timeline/useTimelinePlayback'
import { SingleTrack } from './timeline/SingleTrack'
import { StackedTrack } from './timeline/StackedTrack'
import { CombinedTrack } from './timeline/CombinedTrack'
import { CollapsedBar } from './timeline/CollapsedBar'
import { TimelineScopeSelect } from './timeline/TimelineScopeSelect'
import { selectFirstEvent, activateEvent } from './timeline/TimelineControls'
import { useRevealAll } from './useRevealAll'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { asksBeforeJumping } from '@/lib/readingAhead'
import { ConfirmDialog } from '@/components/ConfirmDialog'

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
    barCollapsed, setBarCollapsed,
  } = useAppStore()
  const worldId = useActiveWorldId()
  /*
    Clearing the cursor is a full reveal while reading, so it asks first — the
    same guard the top bar's ✕ uses, shared rather than copied. Both tracks
    below route through it: a blind reader run found the combined one, and the
    single-timeline one had the identical fault by a different route
    (`handleStop`, which stops playback *and* clears).
  */
  const { requestClear, revealAllDialog } = useRevealAll(worldId)
  /*
    R14: skipping ahead is the intended way to move your place and must not be
    blocked — but two or more chapters forward is a deliberate skip, and it is
    the one move that shows a reader something they were saving. The next
    chapter, another scene in this one, and any move backwards all go straight
    through.

    The titles are withheld separately (`lib/readingAhead`), because that is the
    half that mattered: the reader's report had the reveal in the *click*, on a
    block reading "9 · Mina Murray's Journal". A confirm arriving after that
    would have been asking about something already read.
  */
  const gate = useGate()
  const [pendingJump, setPendingJump] = useState<{ to: number; go: () => void } | null>(null)
  function handleClearCursor() {
    // Stopping playback is not the destructive half and needs no confirming;
    // discarding the reading position is, and does.
    setIsPlayingStory(false)
    requestClear()
  }

  const timelines     = useTimelines(worldId)
  const relationships = useTimelineRelationships(worldId)

  // ── Frame narrative detection ──────────────────────────────────────────────
  const frameRel = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.find(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    ) ?? null
  }, [relationships, timelines])

  // MT-7: which moments a sync point pairs, so the bar can mark them. The
  // relationship is already loaded here for the frame check, so this is a read
  // of data in hand rather than new plumbing.
  const linkedOuterEventIds = useMemo(
    () => new Set((frameRel?.syncPoints ?? []).map((sp) => sp.outerEventId)),
    [frameRel],
  )
  const linkedInnerEventIds = useMemo(
    () => new Set((frameRel?.syncPoints ?? []).map((sp) => sp.innerEventId)),
    [frameRel],
  )

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
  /*
    The same sequence twice: gated for what the bar draws, ungated for what
    stepping through it may reach.

    `useAllWorldEvents` says why in its own doc — "gating its own list would
    strand the reader at the moment they had reached" — and the single-track
    and frame tracks already obey it, because they feed playback from
    `useTimelineEvents`, which is ungated. Merged mode did not: it handed the
    gated list to `useTimelinePlayback`, so in reading mode the sequence ended
    at the cursor, the very first tick found itself on the last event, and
    playback switched itself off without moving. The button said "Playing…"
    for one hold and then went back to "Play".

    It only showed on a world with two or more timelines and no frame
    relationship between them, which is the one shape that lands in merged
    mode — so it sat here until a world of that shape shipped.
  */
  const allWorldEvents  = useAllWorldEvents(isCombined ? worldId : null)

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
  /*
    Built from the ungated events and used only for stepping. What is drawn
    still comes from `combinedRows`, so an unread chapter's title stays
    withheld (R14) — this list is never rendered, only walked.
  */
  const combinedOrdered = useMemo(
    () => (isCombined
      ? buildCombinedSequence(allWorldEvents, worldChapters, timelines, combinedOrder).map((r) => r.event)
      : []),
    [isCombined, allWorldEvents, worldChapters, timelines, combinedOrder],
  )

  /*
    Chapter numbers for the jump guard, over whichever sets this bar is holding.
    The four track modes load different halves — `useWorldChapters` is only
    asked for in merged mode — so the lookup unions what is present rather than
    picking one, which would leave the guard silently inert in three of them.
  */
  const chapterNumberById = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of [...worldChapters, ...frameChapters, ...singleChapters]) m.set(c.id, c.number)
    return m
  }, [worldChapters, frameChapters, singleChapters])
  const eventChapterId = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of [...worldEvents, ...frameEvents, ...singleRawEvents]) m.set(e.id, e.chapterId)
    return m
  }, [worldEvents, frameEvents, singleRawEvents])

  // ── Playback ───────────────────────────────────────────────────────────────
  // Single & frame → that timeline's events. Merged → the whole combined
  // sequence; the map follows each event's own timeline (see useMapViewState),
  // so playing sweeps every storyline and animates the right cast per event.
  const playbackOrdered = isFrame ? frameOrdered : isCombined ? combinedOrdered : singleOrdered
  const { handlePlayPause, handleStop, cycleSpeed, isPlayingStory, playbackSpeed } =
    useTimelinePlayback(playbackOrdered, frameRel, activeDepthTimelineId, innerTimelineId)

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

  // ── Rolled up (MT-3) ───────────────────────────────────────────────────────
  // One strip in place of whichever track would have rendered, under the same
  // conditions that decide whether there is a bar at all: a world with no
  // chapters to point at gets no strip either.
  if (barCollapsed) {
    if (!isFrame && !multi && !singleChapters.length) return null
    if (isCombined && !combinedRows.length) return null
    const evs = isFrame ? frameEvents : isCombined ? worldEvents : singleRawEvents
    const chs = isFrame ? frameChapters : isCombined ? worldChapters : singleChapters
    const ev  = activeEventId ? evs.find((e) => e.id === activeEventId) ?? null : null
    const ch  = ev ? chs.find((c) => c.id === ev.chapterId) ?? null : null
    return (
      <CollapsedBar
        label={ev && ch ? `Ch.${ch.number} · ${ev.title}` : null}
        onExpand={() => setBarCollapsed(false)}
      />
    )
  }

  // ── Shared handlers ────────────────────────────────────────────────────────
  /** Ask before a move that reads ahead; otherwise just go. */
  function guarded(toChapter: number | undefined, go: () => void) {
    if (toChapter === undefined || !gate.active || !asksBeforeJumping(gate.chapterNumber, toChapter)) {
      go()
      return
    }
    setPendingJump({ to: toChapter, go })
  }

  const handleEventSelect = (id: string, locId?: string | null) => {
    const chId = eventChapterId.get(id)
    guarded(
      chId === undefined ? undefined : chapterNumberById.get(chId),
      () => activateEvent(id, locId, setActiveEventId),
    )
  }
  const handleChapterSelect = (chId: string, events: WorldEvent[]) => guarded(
    chapterNumberById.get(chId),
    () => selectFirstEvent(chId, events, setActiveEventId),
  )

  /*
    Rendered beside `revealAllDialog` at each of the four track returns below,
    so it is one element wherever the bar is drawn.

    The wording says what actually happens rather than warning of damage: the
    reveals are computed from the cursor, so moving back hides them again. What
    it cannot give back is not having seen them.
  */
  const jumpDialog = (
    <ConfirmDialog
      open={!!pendingJump}
      onOpenChange={(v) => { if (!v) setPendingJump(null) }}
      title={pendingJump ? `Read ahead to chapter ${pendingJump.to}?` : ''}
      description={
        gate.chapterNumber !== null && pendingJump
          ? `You are on chapter ${gate.chapterNumber}. Moving there shows everything the story introduces in between — people, places and connections you have not met yet. Coming back hides them again.`
          : undefined
      }
      confirmLabel="Read ahead"
      onConfirm={() => { pendingJump?.go(); setPendingJump(null) }}
    />
  )
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
      <>
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
          linkedOuterEventIds={linkedOuterEventIds}
          linkedInnerEventIds={linkedInnerEventIds}
          setActiveEventId={setActiveEventId}
        />
      {revealAllDialog}
      {jumpDialog}
      </>
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
      <>
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
          onClear={handleClearCursor}
          onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
          onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
          onEventSelect={handleEventSelect}
        />
      {revealAllDialog}
      {jumpDialog}
      </>
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
    <>
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
        onClear={handleClearCursor}
        onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
        onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
        onEventSelect={handleEventSelect}
        onChapterSelect={(chId) => handleChapterSelect(chId, singleRawEvents)}
        scopeSelector={multi ? <TimelineScopeSelect timelines={timelines} value={scope} onChange={setBarScope} /> : undefined}
      />
    {revealAllDialog}
    {jumpDialog}
    </>
  )
}
