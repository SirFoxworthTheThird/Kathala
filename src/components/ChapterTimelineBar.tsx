import { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Square, GitCompareArrows, X } from 'lucide-react'
import { useActiveWorldId, useActiveEventId, useAppStore, type PlaybackSpeed } from '@/store'
import { useTimelines, useChapters, useTimelineEvents } from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { BAR_H_SINGLE, BAR_H_STACKED } from '@/lib/useBarHeight'
import type { Chapter, WorldEvent } from '@/types'
import { useTimelinePlayback, SPEED_LABEL } from '@/features/timeline/useTimelinePlayback'

/** @deprecated import BAR_H_SINGLE from @/lib/useBarHeight instead */
export const BAR_H = BAR_H_SINGLE

// ── Playback controls ─────────────────────────────────────────────────────────

interface ControlsProps {
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

function Controls({ isPlaying, speed, showStop, showDiff, showClear, color, onPlayPause, onStop, onSpeedChange, onDiffOpen, onClear }: ControlsProps) {
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
// Persistent always-visible display of the active event. Replaces the
// disappearing callout popover.

interface EventPanelProps {
  chapterNum: number
  chapterTitle: string
  eventTitle: string
  hasPrev: boolean
  hasNext: boolean
  color: string
  onPrev: () => void
  onNext: () => void
}

function EventPanel({ chapterNum, chapterTitle, eventTitle, hasPrev, hasNext, color, onPrev, onNext }: EventPanelProps) {
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

// ── Chapter segment ───────────────────────────────────────────────────────────

type SegmentState = 'past' | 'active' | 'future' | 'empty'

interface ChapterSegmentProps {
  chapter: Chapter
  events: WorldEvent[]
  segmentState: SegmentState
  activeEventId: string | null
  color: string
  compact: boolean
  activeMarkerRef: RefObject<HTMLButtonElement | null>
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
  onChapterSelect: () => void
}

function ChapterSegment({
  chapter, events, segmentState, activeEventId, color, compact,
  activeMarkerRef, onEventSelect, onChapterSelect,
}: ChapterSegmentProps) {
  const isActive = segmentState === 'active'
  const isPast   = segmentState === 'past'
  const isEmpty  = segmentState === 'empty'

  const activeIdx  = activeEventId ? events.findIndex((e) => e.id === activeEventId) : -1
  const fillRatio  = isPast ? 1 : (isActive && activeIdx >= 0) ? (activeIdx + 0.5) / events.length : 0
  const opacity    = isEmpty ? 0.28 : (!isActive && !isPast) ? 0.42 : 1
  const labelColor = isActive ? color : 'var(--tl-text-muted)'

  // Each event gets a fixed slot width so ticks have a predictable hit target
  const slotRem = compact ? 1.5 : 2
  const minRem  = compact ? 2.5 : 3
  const widthRem = Math.max(minRem, events.length * slotRem)

  const railH = compact ? 2 : 3

  return (
    <div
      style={{
        width: `${widthRem}rem`, flexShrink: 0, height: '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: compact ? 'center' : 'space-between',
        padding: compact ? '0.3rem 0.5rem 0.25rem' : '0.45rem 0.5rem 0.4rem',
        boxSizing: 'border-box',
        borderRight: '1px solid var(--tl-border)',
        opacity,
        cursor: isEmpty ? 'not-allowed' : 'pointer',
        background: isActive ? `color-mix(in srgb, var(--tl-bg) 94%, ${color} 6%)` : 'transparent',
        transition: 'opacity 0.2s, background 0.25s',
      } as CSSProperties}
      onClick={isEmpty ? undefined : onChapterSelect}
      title={isEmpty ? 'Add an event to this chapter to activate it.' : undefined}
    >
      {/* Chapter label — full-height mode only */}
      {!compact && (
        <div style={{
          fontSize: '0.56rem', lineHeight: 1,
          color: labelColor, fontFamily: 'var(--font-body)',
          fontWeight: isActive ? 700 : 400, letterSpacing: '0.03em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'color 0.2s', flexShrink: 0,
        }}>
          <span style={{ opacity: 0.6 }}>{chapter.number}</span>
          {chapter.title && <span> · {chapter.title}</span>}
        </div>
      )}

      {/* Rail + ticks */}
      <div style={{
        position: 'relative', flex: compact ? undefined : 1,
        display: 'flex', alignItems: 'center',
        margin: compact ? 0 : '0.2rem 0',
        minHeight: compact ? undefined : `${railH * 6}px`,
      }}>
        {/* Rail background */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          height: railH, background: 'var(--tl-border)',
          borderRadius: railH, transform: 'translateY(-50%)',
        }} />
        {/* Rail fill */}
        <div style={{
          position: 'absolute', left: 0, top: '50%',
          height: railH, width: `${fillRatio * 100}%`,
          background: color, borderRadius: railH,
          transform: 'translateY(-50%)',
          transition: 'width 0.25s ease', zIndex: 1,
        }} />
        {/* Event ticks */}
        {events.map((ev, i) => {
          const isEvActive = ev.id === activeEventId
          const hasFired   = isPast || (isActive && i <= activeIdx)
          const pct        = events.length <= 1 ? 50 : (i / (events.length - 1)) * 100
          const tickH      = isEvActive ? (compact ? 13 : 20) : (compact ? 8 : 12)
          const tickW      = isEvActive ? 3 : 2
          return (
            <button
              key={ev.id}
              ref={isEvActive ? activeMarkerRef : undefined}
              title={ev.title}
              onClick={(e) => { e.stopPropagation(); onEventSelect(ev.id, ev.locationMarkerId) }}
              style={{
                position: 'absolute', left: `${pct}%`, top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 22, height: Math.max(tickH + 10, 24),
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <div style={{
                width: tickW, height: tickH,
                background: hasFired ? color : 'var(--tl-border)',
                borderRadius: 2,
                boxShadow: isEvActive ? `0 0 5px ${color}99` : 'none',
                transition: 'height 0.15s, box-shadow 0.15s',
              }} />
            </button>
          )
        })}
      </div>

      {/* Chapter number label — compact mode only */}
      {compact && (
        <div style={{
          fontSize: '0.48rem', color: labelColor, fontFamily: 'var(--font-body)',
          fontWeight: isActive ? 700 : 400, letterSpacing: '0.04em',
          textAlign: 'center', lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0,
          transition: 'color 0.2s',
        }}>
          {chapter.number}
        </div>
      )}
    </div>
  )
}

// ── Scrubber track ────────────────────────────────────────────────────────────
// Self-contained: manages its own scroll state and wheel handler.

interface ScrubberProps {
  chapters: Chapter[]
  events: WorldEvent[]
  activeEventId: string | null
  color: string
  compact: boolean
  scrollerRef: RefObject<HTMLDivElement | null>
  activeMarkerRef: RefObject<HTMLButtonElement | null>
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
  onChapterSelect: (chapterId: string) => void
}

function Scrubber({
  chapters, events, activeEventId, color, compact,
  scrollerRef, activeMarkerRef, onEventSelect, onChapterSelect,
}: ScrubberProps) {
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [scrollerRef])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect() }
  }, [chapters, updateArrows])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scrollerRef])

  const eventsByChapter = useMemo(() => {
    const map = new Map<string, WorldEvent[]>()
    for (const ch of chapters) {
      map.set(ch.id, events.filter((e) => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
    }
    return map
  }, [chapters, events])

  const activeChapterId  = activeEventId ? (events.find((e) => e.id === activeEventId)?.chapterId ?? null) : null
  const activeChapterIdx = chapters.findIndex((c) => c.id === activeChapterId)

  function getSegmentState(chIdx: number, chId: string): SegmentState {
    if ((eventsByChapter.get(chId) ?? []).length === 0) return 'empty'
    if (chId === activeChapterId) return 'active'
    if (activeChapterId === null) return 'future'
    return chIdx < activeChapterIdx ? 'past' : 'future'
  }

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 0 }}>
      {/* Scroll arrows — full-height mode only */}
      {!compact && canScrollLeft && (
        <button onClick={() => scrollBy(-200)} style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', paddingInline: '0.2rem',
          background: 'linear-gradient(to right, var(--tl-bg) 55%, transparent)',
          border: 'none', cursor: 'pointer', color: 'var(--tl-accent)',
        }}>
          <ChevronLeft size={12} />
        </button>
      )}
      {!compact && canScrollRight && (
        <button onClick={() => scrollBy(200)} style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', paddingInline: '0.2rem',
          background: 'linear-gradient(to left, var(--tl-bg) 55%, transparent)',
          border: 'none', cursor: 'pointer', color: 'var(--tl-accent)',
        }}>
          <ChevronRight size={12} />
        </button>
      )}
      <div
        ref={scrollerRef}
        style={{
          display: 'flex', alignItems: 'stretch',
          overflowX: 'auto', overflowY: 'visible',
          scrollbarWidth: 'none', height: '100%',
        }}
      >
        {chapters.map((ch, idx) => (
          <ChapterSegment
            key={ch.id}
            chapter={ch}
            events={eventsByChapter.get(ch.id) ?? []}
            segmentState={getSegmentState(idx, ch.id)}
            activeEventId={activeEventId}
            color={color}
            compact={compact}
            activeMarkerRef={activeMarkerRef}
            onEventSelect={onEventSelect}
            onChapterSelect={() => onChapterSelect(ch.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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

  // Select first event in a chapter from a flat events array
  function selectChapter(chapterId: string, events: WorldEvent[]) {
    const first = events
      .filter((e) => e.chapterId === chapterId)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (first) setActiveEventId(first.id)
  }

  function activateDepth(timelineId: string) {
    setIsPlayingStory(false)
    setActiveDepthTimelineId(timelineId)
    setPlaybackTimelineId(timelineId)
  }

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

  const commonEventSelectHandler = (id: string, locId?: string | null) => {
    setActiveEventId(id)
    if (locId) window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: locId } }))
  }

  // ── Stacked render (frame narrative) ──────────────────────────────────────
  if (frameRel) {
    const isOuterActive = activeDepthTimelineId !== innerTimelineId

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
          WebkitBackdropFilter: 'var(--tl-backdrop)' as string,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-body)',
        }}>

          {/* ── Outer (frame) track — thin ── */}
          <div
            style={trackStyle(isOuterActive, '2.25rem')}
            onClick={isOuterActive ? undefined : () => activateDepth(outerTimelineId!)}
          >
            <div style={{
              padding: '0 0.5rem', height: '100%', display: 'flex', alignItems: 'center',
              borderRight: '1px solid var(--tl-border)', flexShrink: 0, gap: '0.35rem',
            }}>
              <span style={badgeStyle(isOuterActive, outerColor)}>Frame</span>
            </div>
            <Controls
              isPlaying={isPlayingStory && isOuterActive}
              speed={playbackSpeed}
              showStop={isPlayingStory && isOuterActive}
              showDiff={isOuterActive && !!activeEventId}
              showClear={isOuterActive && !!activeEventId}
              color={outerColor}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onSpeedChange={cycleSpeed}
              onDiffOpen={() => setDiffOpen(true)}
              onClear={handleStop}
            />
            {isOuterActive && activeEvent && activeChapter && (
              <EventPanel
                chapterNum={activeChapter.number}
                chapterTitle={activeChapter.title}
                eventTitle={activeEvent.title}
                hasPrev={!!prevEvent} hasNext={!!nextEvent}
                color={outerColor}
                onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
                onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
              />
            )}
            <Scrubber
              chapters={outerChapters}
              events={outerRawEvents}
              activeEventId={isOuterActive ? activeEventId : null}
              color={outerColor}
              compact
              scrollerRef={outerScrollerRef}
              activeMarkerRef={outerMarkerRef}
              onEventSelect={commonEventSelectHandler}
              onChapterSelect={(chId) => selectChapter(chId, outerRawEvents)}
            />
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--tl-border)', flexShrink: 0 }} />

          {/* ── Inner (story) track — full height ── */}
          <div
            style={trackStyle(!isOuterActive, 'calc(100% - 2.25rem - 1px)')}
            onClick={!isOuterActive ? undefined : () => activateDepth(innerTimelineId!)}
          >
            <div style={{
              padding: '0 0.5rem', height: '100%', display: 'flex', alignItems: 'center',
              borderRight: '1px solid var(--tl-border)', flexShrink: 0,
            }}>
              <span style={badgeStyle(!isOuterActive, innerColor)}>Story</span>
            </div>
            <Controls
              isPlaying={isPlayingStory && !isOuterActive}
              speed={playbackSpeed}
              showStop={isPlayingStory && !isOuterActive}
              showDiff={!isOuterActive && !!activeEventId}
              showClear={!isOuterActive && !!activeEventId}
              color={innerColor}
              onPlayPause={handlePlayPause}
              onStop={handleStop}
              onSpeedChange={cycleSpeed}
              onDiffOpen={() => setDiffOpen(true)}
              onClear={handleStop}
            />
            {!isOuterActive && activeEvent && activeChapter && (
              <EventPanel
                chapterNum={activeChapter.number}
                chapterTitle={activeChapter.title}
                eventTitle={activeEvent.title}
                hasPrev={!!prevEvent} hasNext={!!nextEvent}
                color={innerColor}
                onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
                onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
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
              onEventSelect={commonEventSelectHandler}
              onChapterSelect={(chId) => selectChapter(chId, innerRawEvents)}
            />
          </div>

        </div>
      </div>
    )
  }

  // ── Single-track render ────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
      <div style={{
        height: BAR_H_SINGLE,
        background: 'var(--tl-bg)',
        borderTop: '1px solid var(--tl-border)',
        backdropFilter: 'var(--tl-backdrop)',
        WebkitBackdropFilter: 'var(--tl-backdrop)' as string,
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
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onSpeedChange={cycleSpeed}
          onDiffOpen={() => setDiffOpen(true)}
          onClear={handleStop}
        />
        {activeEvent && activeChapter && (
          <EventPanel
            chapterNum={activeChapter.number}
            chapterTitle={activeChapter.title}
            eventTitle={activeEvent.title}
            hasPrev={!!prevEvent} hasNext={!!nextEvent}
            color={accentColor}
            onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
            onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
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
          onEventSelect={commonEventSelectHandler}
          onChapterSelect={(chId) => selectChapter(chId, allEvents)}
        />
      </div>
    </div>
  )
}
