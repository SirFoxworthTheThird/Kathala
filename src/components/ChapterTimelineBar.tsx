import { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Square, GitCompareArrows, MapPin } from 'lucide-react'
import { useActiveWorldId, useActiveEventId, useAppStore, type PlaybackSpeed } from '@/store'
import { useTimelines, useChapters, useTimelineEvents } from '@/db/hooks/useTimeline'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { readingHoldMs } from '@/lib/playbackTiming'
import { BAR_H_SINGLE, BAR_H_STACKED } from '@/lib/useBarHeight'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Timeline, Chapter, WorldEvent } from '@/types'

/** @deprecated import BAR_H_SINGLE from @/lib/useBarHeight instead */
export const BAR_H = BAR_H_SINGLE

const SPEED_NEXT: Record<PlaybackSpeed, PlaybackSpeed> = { slow: 'normal', normal: 'fast', fast: 'slow' }
const SPEED_LABEL: Record<PlaybackSpeed, string> = { slow: '1×', normal: '2×', fast: '3×' }

// ─── Style helpers ────────────────────────────────────────────────────────────

function chapterDotStyle(isActive: boolean): CSSProperties {
  return {
    width: isActive ? '0.8rem' : '0.55rem',
    height: isActive ? '0.8rem' : '0.55rem',
    borderRadius: '50%',
    background: isActive ? 'var(--tl-accent)' : 'var(--tl-border)',
    border: `2px solid ${isActive ? 'var(--tl-accent)' : 'var(--tl-border)'}`,
    flexShrink: 0,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    zIndex: 1,
  }
}

function eventDotStyle(isActive: boolean, hasLocation: boolean): CSSProperties {
  return {
    width: '0.35rem',
    height: '0.35rem',
    borderRadius: '50%',
    background: isActive
      ? (hasLocation ? 'var(--tl-accent)' : 'var(--tl-text-muted)')
      : 'var(--tl-border)',
    flexShrink: 0,
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    zIndex: 1,
  }
}

function navBtnStyle(disabled: boolean): CSSProperties {
  return {
    background: 'none', border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'var(--tl-text-muted)' : 'var(--tl-accent)',
    padding: '0.25rem', opacity: disabled ? 0.3 : 1,
    display: 'flex', alignItems: 'center',
    transition: 'opacity 0.15s', flexShrink: 0,
  }
}

// ─── Callout ──────────────────────────────────────────────────────────────────

interface CalloutProps {
  left: number
  barH: string
  chapterNum: number
  chapterTitle: string
  eventTitle: string
  eventDescription: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

function Callout({ left, barH, chapterNum, chapterTitle, eventTitle, eventDescription, hasPrev, hasNext, onPrev, onNext }: CalloutProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: `calc(${barH} + 0.5rem)`,
      left,
      transform: 'translateX(-50%)',
      background: 'var(--tl-callout-bg)',
      border: '1px solid var(--tl-border)',
      boxShadow: 'var(--tl-callout-shadow)',
      borderRadius: 'var(--radius)',
      width: 'min(340px, 88vw)',
      fontFamily: 'var(--font-body)',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 0.5rem', gap: '0.25rem' }}>
        <button style={navBtnStyle(!hasPrev)} onClick={onPrev} disabled={!hasPrev} aria-label="Previous event">
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0 0.25rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.08em', color: 'var(--tl-text-muted)', marginBottom: '0.2rem' }}>
            Ch. {chapterNum} — {chapterTitle}
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--tl-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {eventTitle}
          </div>
          {eventDescription && (
            <div style={{ fontSize: '0.68rem', color: 'var(--tl-text-muted)', marginTop: '0.2rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.4 }}>
              {eventDescription}
            </div>
          )}
        </div>
        <button style={navBtnStyle(!hasNext)} onClick={onNext} disabled={!hasNext} aria-label="Next event">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="tl-caret" />
    </div>
  )
}

// ─── Stacked Track Row ────────────────────────────────────────────────────────

interface StackedTrackProps {
  timeline: Timeline | undefined
  chapters: Chapter[]
  events: WorldEvent[]
  activeEventId: string | null
  isActiveDepth: boolean
  isPlaying: boolean
  playbackSpeed: PlaybackSpeed
  showDiff: boolean
  onActivate: () => void
  onPlayPause: () => void
  onDeselect: () => void
  onSpeedChange: () => void
  onDiffOpen: () => void
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
  onChapterSelect: (chapterId: string) => void
  activeMarkerRef: React.RefObject<HTMLButtonElement | null>
  scrollerRef: React.RefObject<HTMLDivElement | null>
}

function StackedTrack({
  timeline, chapters, events, activeEventId, isActiveDepth, isPlaying, playbackSpeed,
  showDiff, onActivate, onPlayPause, onDeselect, onSpeedChange, onDiffOpen,
  onEventSelect, onChapterSelect, activeMarkerRef, scrollerRef,
}: StackedTrackProps) {
  const tColor = timeline?.color ?? 'var(--tl-accent)'

  const eventsByChapter = useMemo(() => {
    const map = new Map<string, WorldEvent[]>()
    for (const ch of chapters) {
      map.set(ch.id, events.filter((e) => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
    }
    return map
  }, [chapters, events])

  const activeEvent = activeEventId ? events.find((e) => e.id === activeEventId) ?? null : null
  const activeChapterId = activeEvent?.chapterId ?? null

  return (
    <div
      style={{
        height: '3rem',
        display: 'flex', alignItems: 'center',
        borderLeft: `3px solid ${isActiveDepth ? tColor : 'transparent'}`,
        background: isActiveDepth ? 'color-mix(in srgb, var(--tl-bg) 92%, currentColor 8%)' : 'var(--tl-bg)',
        cursor: isActiveDepth ? 'default' : 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        overflow: 'hidden',
      }}
      onClick={isActiveDepth ? undefined : onActivate}
    >
      {/* Track controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.1rem',
        padding: '0 0.4rem', height: '100%', flexShrink: 0,
        borderRight: '1px solid var(--tl-border)',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onPlayPause() }}
          title={isPlaying ? 'Pause' : `Play ${timeline?.name ?? 'this timeline'} on the map`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: tColor, padding: '0.2rem', display: 'flex', alignItems: 'center', borderRadius: '3px' }}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSpeedChange() }}
          title="Playback speed"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isPlaying ? tColor : 'var(--tl-text-muted)', fontSize: '0.55rem', fontWeight: 700, fontFamily: 'var(--font-body)', padding: '0.2rem 0.1rem', lineHeight: 1, borderRadius: '3px' }}
        >
          {SPEED_LABEL[playbackSpeed]}
        </button>
        {showDiff && activeEventId && (
          <button
            onClick={(e) => { e.stopPropagation(); onDiffOpen() }}
            title="Compare chapters"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-text-muted)', padding: '0.2rem', display: 'flex', alignItems: 'center', borderRadius: '3px' }}
          >
            <GitCompareArrows size={11} />
          </button>
        )}
        <span style={{
          fontSize: '0.55rem', fontWeight: 700, color: tColor,
          fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
          maxWidth: '4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginLeft: '0.15rem', flexShrink: 0,
        }}>
          {timeline?.name ?? '…'}
        </span>
      </div>

      {/* All deselect */}
      <button
        onClick={(e) => { e.stopPropagation(); onDeselect() }}
        style={{
          flexShrink: 0, padding: '0 0.625rem', height: '100%',
          background: 'none', border: 'none', borderRight: '1px solid var(--tl-border)',
          cursor: 'pointer', fontSize: '0.65rem', letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          fontWeight: !activeEventId ? 700 : 400,
          color: !activeEventId ? tColor : 'var(--tl-text-muted)',
          fontFamily: 'var(--font-body)', transition: 'color 0.2s',
        }}
      >
        All
      </button>

      {/* Scrollable chapters + events */}
      <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 0 }}>
        <div ref={scrollerRef} style={{
          display: 'flex', alignItems: 'center',
          overflowX: 'auto', overflowY: 'visible',
          scrollbarWidth: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem',
          height: '100%', gap: 0,
        }}>
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            minWidth: 'max-content', gap: 0,
          }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '50%', height: '1px',
              background: 'var(--tl-border)',
              transform: 'translateY(calc(-50% - 4px))',
              zIndex: 0,
            }} />

            {chapters.map((ch) => {
              const isChActive = activeChapterId === ch.id
              const chEvents = eventsByChapter.get(ch.id) ?? []
              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    title={chEvents.length === 0 ? 'Add an event to this chapter to activate it.' : undefined}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '0 0.3rem', minWidth: '1.75rem',
                      background: 'none', border: 'none', cursor: chEvents.length === 0 ? 'default' : 'pointer',
                      flexShrink: 0, position: 'relative', zIndex: 1,
                      opacity: chEvents.length === 0 ? 0.35 : isChActive ? 1 : 0.7,
                    }}
                    onClick={(e) => { e.stopPropagation(); onChapterSelect(ch.id) }}
                  >
                    <div style={chapterDotStyle(isChActive)} />
                    <span style={{
                      fontSize: '0.55rem', lineHeight: 1, letterSpacing: '0.04em',
                      color: isChActive ? tColor : 'var(--tl-text-muted)',
                      fontWeight: isChActive ? 700 : 400, whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-body)',
                    }}>
                      {ch.number}
                    </span>
                  </button>
                  {chEvents.map((ev, i) => {
                    const isEvActive = ev.id === activeEventId
                    return (
                      <button
                        key={ev.id}
                        ref={isEvActive ? activeMarkerRef : undefined}
                        title={ev.title}
                        onClick={(e) => { e.stopPropagation(); onEventSelect(ev.id, ev.locationMarkerId) }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                          padding: '0 0.3rem', minWidth: '1.25rem',
                          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                          position: 'relative', zIndex: 1,
                          opacity: isChActive ? 1 : 0.5,
                        }}
                      >
                        <div style={eventDotStyle(isEvActive, !!ev.locationMarkerId)}>
                          {ev.locationMarkerId && isEvActive && (
                            <MapPin
                              size={5}
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: 'var(--tl-bg)', pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.47rem', lineHeight: 1,
                          color: isEvActive ? tColor : isChActive ? 'var(--tl-text-muted)' : 'var(--tl-border)',
                          whiteSpace: 'nowrap', fontFamily: 'var(--font-body)',
                        }}>
                          {ch.number}.{i + 1}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChapterTimelineBar() {
  const worldId       = useActiveWorldId()
  const activeEventId = useActiveEventId()
  const {
    setActiveEventId,
    isPlayingStory, setIsPlayingStory,
    playbackSpeed, setPlaybackSpeed,
    setDiffOpen, isAnimating,
    playbackTimelineId, setPlaybackTimelineId,
    activeDepthTimelineId, setActiveDepthTimelineId,
    setActiveOuterEventId,
  } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()

  const timelines              = useTimelines(worldId)
  const relationships          = useTimelineRelationships(worldId)

  // ── Frame narrative detection ──────────────────────────────────────────────
  const frameRel = useMemo(() => {
    const tlIds = new Set(timelines.map((t) => t.id))
    return relationships.find(
      (r) => r.type === 'frame_narrative' && tlIds.has(r.sourceTimelineId) && tlIds.has(r.targetTimelineId)
    ) ?? null
  }, [relationships, timelines])

  const outerTimelineId = frameRel?.sourceTimelineId ?? null
  const innerTimelineId = frameRel?.targetTimelineId ?? null

  // ── Initialize / cleanup active depth when frame narrative appears/disappears ─
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

  // ── Timeline data ──────────────────────────────────────────────────────────
  // Always call all hooks; pick the right set based on mode.
  const outerChapters    = useChapters(outerTimelineId)
  const outerRawEvents   = useTimelineEvents(outerTimelineId)
  const innerChapters    = useChapters(innerTimelineId)
  const innerRawEvents   = useTimelineEvents(innerTimelineId)
  // Single-track fallback: when no frame narrative, use playbackTimelineId ?? timelines[0]
  const singleTimelineId = frameRel ? null : (playbackTimelineId ?? timelines[0]?.id ?? null)
  const singleChapters   = useChapters(singleTimelineId)
  const singleRawEvents  = useTimelineEvents(singleTimelineId)

  const chapters  = frameRel ? (activeDepthTimelineId === innerTimelineId ? innerChapters : outerChapters) : singleChapters
  const allEvents = frameRel ? (activeDepthTimelineId === innerTimelineId ? innerRawEvents : outerRawEvents) : singleRawEvents

  // ── Ordered events for active track ───────────────────────────────────────
  const orderedEvents = useMemo(() => {
    const chapNumById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...allEvents].sort((a, b) => {
      const aN = (chapNumById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
      const bN = (chapNumById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
      return aN - bN
    })
  }, [allEvents, chapters])

  const eventsByChapter = useMemo(() => {
    const map = new Map<string, typeof allEvents>()
    for (const ch of chapters) {
      map.set(ch.id, allEvents.filter((e) => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
    }
    return map
  }, [allEvents, chapters])

  const activeEvent   = activeEventId ? allEvents.find((e) => e.id === activeEventId) ?? null : null
  const activeChapter = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null

  const activeEventIndex = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const prevEvent = activeEventIndex > 0 ? orderedEvents[activeEventIndex - 1] : null
  const nextEvent = activeEventIndex < orderedEvents.length - 1 ? orderedEvents[activeEventIndex + 1] : null

  function selectChapter(chapterId: string, evtsByChapter = eventsByChapter) {
    const events = evtsByChapter.get(chapterId) ?? []
    if (events.length > 0) setActiveEventId(events[0].id)
  }

  // ── Stacked track switching ────────────────────────────────────────────────
  function activateDepth(timelineId: string) {
    setIsPlayingStory(false)
    setActiveDepthTimelineId(timelineId)
    setPlaybackTimelineId(timelineId)
  }

  // ── Playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlayingStory || !orderedEvents.length || isAnimating) return

    if (!activeEventId) {
      setActiveEventId(orderedEvents[0].id)
      return
    }

    const idx = orderedEvents.findIndex((e) => e.id === activeEventId)
    if (idx === -1) return

    const ev = orderedEvents[idx]
    const holdMs = readingHoldMs([ev.title, ev.description ?? ''].join(' '), playbackSpeed)

    const t = setTimeout(() => {
      if (idx >= orderedEvents.length - 1) {
        setIsPlayingStory(false)
        return
      }
      const nextEv = orderedEvents[idx + 1]
      setActiveEventId(nextEv.id)
      // Sync point firing — only when inner track is active
      if (frameRel && activeDepthTimelineId === innerTimelineId) {
        const syncPoint = frameRel.syncPoints.find((sp) => sp.innerEventId === nextEv.id)
        if (syncPoint) setActiveOuterEventId(syncPoint.outerEventId)
      }
    }, holdMs)

    return () => clearTimeout(t)
  }, [isPlayingStory, isAnimating, activeEventId, orderedEvents, playbackSpeed, setActiveEventId, setIsPlayingStory, frameRel, activeDepthTimelineId, innerTimelineId, setActiveOuterEventId])

  function handlePlayPause() {
    if (isPlayingStory) {
      setIsPlayingStory(false)
    } else {
      if (!activeEventId || orderedEvents.findIndex((e) => e.id === activeEventId) >= orderedEvents.length - 1) {
        setActiveEventId(orderedEvents[0]?.id ?? null)
      }
      setIsPlayingStory(true)
      if (worldId && !location.pathname.includes('/maps')) {
        navigate(`/worlds/${worldId}/maps`)
      }
    }
  }

  // ── Callout positioning + scroll state (single-track only) ─────────────────
  const scrollerRef     = useRef<HTMLDivElement>(null)
  const activeMarkerRef = useRef<HTMLButtonElement>(null)
  const [calloutLeft, setCalloutLeft]       = useState<number | null>(null)
  const [calloutVisible, setCalloutVisible] = useState(true)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Stacked-mode scroller refs
  const outerScrollerRef = useRef<HTMLDivElement>(null)
  const innerScrollerRef = useRef<HTMLDivElement>(null)
  const outerMarkerRef   = useRef<HTMLButtonElement>(null)
  const innerMarkerRef   = useRef<HTMLButtonElement>(null)

  const updateScrollArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollArrows()
    el.addEventListener('scroll', updateScrollArrows, { passive: true })
    const ro = new ResizeObserver(updateScrollArrows)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', updateScrollArrows); ro.disconnect() }
  }, [chapters, updateScrollArrows])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el!.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  useEffect(() => {
    setCalloutVisible(true)
    const t = setTimeout(() => setCalloutVisible(false), 4000)
    return () => clearTimeout(t)
  }, [activeEventId])

  useEffect(() => {
    const marker = activeMarkerRef.current
    if (!marker) { setCalloutLeft(null); return }
    marker.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    const id = requestAnimationFrame(() => {
      const rect   = marker.getBoundingClientRect()
      const center = rect.left + rect.width / 2
      const half   = 170
      setCalloutLeft(Math.max(half + 12, Math.min(window.innerWidth - half - 12, center)))
    })
    return () => cancelAnimationFrame(id)
  }, [activeEventId, chapters])

  // Scroll active event into view for stacked mode
  useEffect(() => {
    if (!frameRel) return
    const ref = activeDepthTimelineId === innerTimelineId ? innerMarkerRef : outerMarkerRef
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeEventId, frameRel, activeDepthTimelineId, innerTimelineId])

  const barH = frameRel ? BAR_H_STACKED : BAR_H_SINGLE

  if (!timelines.length) return null
  // Single track: need at least some chapters. Stacked: always render if frame rel exists.
  if (!frameRel && !chapters.length) return null

  // ── Stacked render ─────────────────────────────────────────────────────────
  if (frameRel) {
    const outerTimeline = timelines.find((t) => t.id === outerTimelineId)
    const innerTimeline = timelines.find((t) => t.id === innerTimelineId)
    const isOuterActive = activeDepthTimelineId !== innerTimelineId

    const outerEventsByChapter = useMemo(() => {
      const map = new Map<string, WorldEvent[]>()
      for (const ch of outerChapters) {
        map.set(ch.id, outerRawEvents.filter((e) => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
      }
      return map
    }, [outerChapters, outerRawEvents]) // eslint-disable-line react-hooks/exhaustive-deps

    const innerEventsByChapter = useMemo(() => {
      const map = new Map<string, WorldEvent[]>()
      for (const ch of innerChapters) {
        map.set(ch.id, innerRawEvents.filter((e) => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
      }
      return map
    }, [innerChapters, innerRawEvents]) // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, overflow: 'visible' }}>
        {/* Callout for active event */}
        {activeEvent && activeChapter && calloutLeft !== null && calloutVisible && (
          <Callout
            left={calloutLeft}
            barH={barH}
            chapterNum={activeChapter.number}
            chapterTitle={activeChapter.title}
            eventTitle={activeEvent.title}
            eventDescription={activeEvent.description ?? ''}
            hasPrev={!!prevEvent}
            hasNext={!!nextEvent}
            onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
            onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
          />
        )}

        <div style={{
          height: barH,
          background: 'var(--tl-bg)',
          borderTop: '1px solid var(--tl-border)',
          backdropFilter: 'var(--tl-backdrop)',
          WebkitBackdropFilter: 'var(--tl-backdrop)' as string,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-body)',
        }}>
          {/* Divider between tracks */}
          <StackedTrack
            timeline={outerTimeline}
            chapters={outerChapters}
            events={outerRawEvents}
            activeEventId={isOuterActive ? activeEventId : null}
            isActiveDepth={isOuterActive}
            isPlaying={isPlayingStory && isOuterActive}
            playbackSpeed={playbackSpeed}
            showDiff={isOuterActive}
            onActivate={() => activateDepth(outerTimelineId!)}
            onPlayPause={handlePlayPause}
            onDeselect={() => { setIsPlayingStory(false); setActiveEventId(null) }}
            onSpeedChange={() => setPlaybackSpeed(SPEED_NEXT[playbackSpeed])}
            onDiffOpen={() => setDiffOpen(true)}
            onEventSelect={(id, locId) => {
              setActiveEventId(id)
              if (locId) window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: locId } }))
            }}
            onChapterSelect={(chId) => selectChapter(chId, outerEventsByChapter)}
            activeMarkerRef={outerMarkerRef}
            scrollerRef={outerScrollerRef}
          />
          <div style={{ height: '1px', background: 'var(--tl-border)', flexShrink: 0 }} />
          <StackedTrack
            timeline={innerTimeline}
            chapters={innerChapters}
            events={innerRawEvents}
            activeEventId={!isOuterActive ? activeEventId : null}
            isActiveDepth={!isOuterActive}
            isPlaying={isPlayingStory && !isOuterActive}
            playbackSpeed={playbackSpeed}
            showDiff={!isOuterActive}
            onActivate={() => activateDepth(innerTimelineId!)}
            onPlayPause={handlePlayPause}
            onDeselect={() => { setIsPlayingStory(false); setActiveEventId(null) }}
            onSpeedChange={() => setPlaybackSpeed(SPEED_NEXT[playbackSpeed])}
            onDiffOpen={() => setDiffOpen(true)}
            onEventSelect={(id, locId) => {
              setActiveEventId(id)
              if (locId) window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: locId } }))
            }}
            onChapterSelect={(chId) => selectChapter(chId, innerEventsByChapter)}
            activeMarkerRef={innerMarkerRef}
            scrollerRef={innerScrollerRef}
          />
        </div>
      </div>
    )
  }

  // ── Single-track render (original layout) ──────────────────────────────────
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, overflow: 'visible' }}>

      {/* Callout */}
      {activeEvent && activeChapter && calloutLeft !== null && calloutVisible && (
        <Callout
          left={calloutLeft}
          barH={barH}
          chapterNum={activeChapter.number}
          chapterTitle={activeChapter.title}
          eventTitle={activeEvent.title}
          eventDescription={activeEvent.description ?? ''}
          hasPrev={!!prevEvent}
          hasNext={!!nextEvent}
          onPrev={() => prevEvent && setActiveEventId(prevEvent.id)}
          onNext={() => nextEvent && setActiveEventId(nextEvent.id)}
        />
      )}

      {/* Bar */}
      <div style={{
        height: barH,
        background: 'var(--tl-bg)',
        borderTop: '1px solid var(--tl-border)',
        backdropFilter: 'var(--tl-backdrop)',
        WebkitBackdropFilter: 'var(--tl-backdrop)' as string,
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.125rem', padding: '0 0.5rem', height: '100%', flexShrink: 0, borderRight: '1px solid var(--tl-border)' }}>
          <button onClick={handlePlayPause} title={isPlayingStory ? 'Pause' : 'Plays story movement on the map'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-accent)', padding: '0.25rem', display: 'flex', alignItems: 'center', borderRadius: '3px' }}>
            {isPlayingStory ? <Pause size={14} /> : <Play size={14} />}
          </button>
          {isPlayingStory && (
            <button onClick={() => { setIsPlayingStory(false); setActiveEventId(null) }} title="Stop"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center', borderRadius: '3px' }}>
              <Square size={11} />
            </button>
          )}
          <button onClick={() => setPlaybackSpeed(SPEED_NEXT[playbackSpeed])} title="Playback speed"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isPlayingStory ? 'var(--tl-accent)' : 'var(--tl-text-muted)', fontSize: '0.6rem', fontWeight: 700, fontFamily: 'var(--font-body)', padding: '0.25rem 0.125rem', lineHeight: 1, borderRadius: '3px' }}>
            {SPEED_LABEL[playbackSpeed]}
          </button>
          {activeEventId && (
            <button onClick={() => setDiffOpen(true)} title="Compare chapters"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tl-text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center', borderRadius: '3px' }}>
              <GitCompareArrows size={13} />
            </button>
          )}
        </div>

        {/* "All" deselect */}
        <button
          onClick={() => { setIsPlayingStory(false); setActiveEventId(null) }}
          style={{
            flexShrink: 0, padding: '0 0.875rem', height: '100%',
            background: 'none', border: 'none', borderRight: '1px solid var(--tl-border)',
            cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            fontWeight: !activeEventId ? 700 : 400,
            color: !activeEventId ? 'var(--tl-accent)' : 'var(--tl-text-muted)',
            fontFamily: 'var(--font-body)', transition: 'color 0.2s',
          }}
        >
          All
        </button>

        {/* Scrollable track — chapters + events interleaved */}
        <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 0 }}>
          {/* Left scroll arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scrollBy(-200)}
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 5,
                display: 'flex', alignItems: 'center', paddingInline: '0.25rem',
                background: 'linear-gradient(to right, var(--tl-bg) 60%, transparent)',
                border: 'none', cursor: 'pointer', color: 'var(--tl-accent)',
              }}
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {/* Right scroll arrow */}
          {canScrollRight && (
            <button
              onClick={() => scrollBy(200)}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 5,
                display: 'flex', alignItems: 'center', paddingInline: '0.25rem',
                background: 'linear-gradient(to left, var(--tl-bg) 60%, transparent)',
                border: 'none', cursor: 'pointer', color: 'var(--tl-accent)',
              }}
            >
              <ChevronRight size={14} />
            </button>
          )}
          <div ref={scrollerRef} style={{
            display: 'flex', alignItems: 'center',
            overflowX: 'auto', overflowY: 'visible',
            scrollbarWidth: 'none', paddingLeft: '0.75rem', paddingRight: '0.75rem',
            height: '100%', gap: 0,
          }}>
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            minWidth: 'max-content', gap: 0,
          }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '50%', height: '1px',
              background: 'var(--tl-border)',
              transform: 'translateY(calc(-50% - 5px))',
              zIndex: 0,
            }} />

            {chapters.map((ch) => {
              const isChapterActive = activeChapter?.id === ch.id
              const chEvents        = eventsByChapter.get(ch.id) ?? []

              return (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {/* Chapter marker */}
                  <button
                    ref={isChapterActive && !activeEvent ? activeMarkerRef : undefined}
                    title={chEvents.length === 0 ? 'Add an event to this chapter to activate it.' : undefined}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      padding: '0 0.4rem', minWidth: '2rem',
                      background: 'none', border: 'none', cursor: chEvents.length === 0 ? 'default' : 'pointer',
                      flexShrink: 0, position: 'relative', zIndex: 1,
                      opacity: chEvents.length === 0 ? 0.35 : isChapterActive ? 1 : 0.7, transition: 'opacity 0.2s',
                    }}
                    onClick={() => selectChapter(ch.id)}
                  >
                    <div style={chapterDotStyle(isChapterActive)} className={isChapterActive ? 'tl-dot-active' : ''} />
                    <span style={{
                      fontSize: '0.58rem', lineHeight: 1, letterSpacing: '0.04em',
                      color: isChapterActive ? 'var(--tl-accent)' : 'var(--tl-text-muted)',
                      fontWeight: isChapterActive ? 700 : 400, whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-body)', transition: 'color 0.2s',
                    }}>
                      {ch.number}
                    </span>
                  </button>

                  {/* Individual event markers */}
                  {chEvents.map((ev, i) => {
                    const isEvActive = ev.id === activeEventId
                    return (
                      <button
                        key={ev.id}
                        ref={isEvActive ? activeMarkerRef : undefined}
                        title={ev.title}
                        onClick={() => {
                          setActiveEventId(ev.id)
                          if (ev.locationMarkerId) {
                            window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: ev.locationMarkerId } }))
                          }
                        }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                          padding: '0 0.35rem', minWidth: '1.5rem',
                          background: 'none', border: 'none',
                          cursor: 'pointer', flexShrink: 0,
                          position: 'relative', zIndex: 1,
                          opacity: isChapterActive ? 1 : 0.5, transition: 'opacity 0.2s',
                        }}
                      >
                        <div style={eventDotStyle(isEvActive, !!ev.locationMarkerId)}>
                          {ev.locationMarkerId && isEvActive && (
                            <MapPin
                              size={6}
                              style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: 'var(--tl-bg)',
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.5rem', lineHeight: 1, letterSpacing: '0.02em',
                          color: isEvActive ? 'var(--tl-accent)' : isChapterActive ? 'var(--tl-text-muted)' : 'var(--tl-border)',
                          whiteSpace: 'nowrap', fontFamily: 'var(--font-body)',
                          transition: 'color 0.2s',
                        }}>
                          {ch.number}.{i + 1}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
