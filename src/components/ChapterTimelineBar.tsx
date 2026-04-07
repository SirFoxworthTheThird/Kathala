import { useEffect, useRef, useState, useMemo, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Square, GitCompareArrows, MapPin } from 'lucide-react'
import { useActiveWorldId, useActiveEventId, useAppStore, type PlaybackSpeed } from '@/store'
import { useTimelines, useChapters, useTimelineEvents } from '@/db/hooks/useTimeline'
import { readingHoldMs } from '@/lib/playbackTiming'

const SPEED_NEXT: Record<PlaybackSpeed, PlaybackSpeed> = { slow: 'normal', normal: 'fast', fast: 'slow' }
const SPEED_LABEL: Record<PlaybackSpeed, string> = { slow: '1×', normal: '2×', fast: '3×' }

export const BAR_H = '3.25rem'

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
  chapterNum: number
  title: string
  synopsis: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

function Callout({ left, chapterNum, title, synopsis, hasPrev, hasNext, onPrev, onNext }: CalloutProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: `calc(${BAR_H} + 0.5rem)`,
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
        <button style={navBtnStyle(!hasPrev)} onClick={onPrev} disabled={!hasPrev} aria-label="Previous chapter">
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0 0.25rem' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tl-accent)', marginBottom: '0.2rem', fontWeight: 600 }}>
            Chapter {chapterNum}
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--tl-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          {synopsis && (
            <div style={{ fontSize: '0.68rem', color: 'var(--tl-text-muted)', marginTop: '0.2rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.4 }}>
              {synopsis}
            </div>
          )}
        </div>
        <button style={navBtnStyle(!hasNext)} onClick={onNext} disabled={!hasNext} aria-label="Next chapter">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="tl-caret" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChapterTimelineBar() {
  const worldId        = useActiveWorldId()
  const activeEventId  = useActiveEventId()
  const { setActiveEventId, isPlayingStory, setIsPlayingStory, playbackSpeed, setPlaybackSpeed, setDiffOpen } = useAppStore()

  const timelines       = useTimelines(worldId)
  const firstTimelineId = timelines[0]?.id ?? null
  const chapters        = useChapters(firstTimelineId)
  const allEvents       = useTimelineEvents(firstTimelineId)

  // All events in global order: chapter.number (primary) → sortOrder (secondary)
  const orderedEvents = useMemo(() => {
    const chapterNumberById = new Map(chapters.map(c => [c.id, c.number]))
    return [...allEvents].sort((a, b) => {
      const aN = (chapterNumberById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
      const bN = (chapterNumberById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
      return aN - bN
    })
  }, [allEvents, chapters])

  // Events grouped by chapter, sorted by sortOrder
  const eventsByChapter = useMemo(() => {
    const map = new Map<string, typeof allEvents>()
    for (const ch of chapters) {
      map.set(ch.id, allEvents.filter(e => e.chapterId === ch.id).sort((a, b) => a.sortOrder - b.sortOrder))
    }
    return map
  }, [allEvents, chapters])

  // Derive active chapter from active event
  const activeEvent   = activeEventId ? allEvents.find(e => e.id === activeEventId) ?? null : null
  const activeChapter = activeEvent ? chapters.find(c => c.id === activeEvent.chapterId) ?? null : null
  const chapterIndex  = activeChapter ? chapters.findIndex(c => c.id === activeChapter.id) : -1
  const prevChapter   = chapterIndex > 0 ? chapters[chapterIndex - 1] : null
  const nextChapter   = chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null

  /** Select the first event of a chapter, or null if the chapter has no events. */
  function selectChapter(chapterId: string) {
    const events = eventsByChapter.get(chapterId) ?? []
    if (events.length > 0) setActiveEventId(events[0].id)
    // If no events yet, do nothing (can't set a valid event ID)
  }

  // ── Playback — advance through events in global order ───────────────────────
  useEffect(() => {
    if (!isPlayingStory || !orderedEvents.length) return

    if (!activeEventId) {
      setActiveEventId(orderedEvents[0].id)
      return
    }

    const idx = orderedEvents.findIndex(e => e.id === activeEventId)
    if (idx === -1) return

    const ev = orderedEvents[idx]
    const chapter = chapters.find(c => c.id === ev.chapterId)
    const holdMs = readingHoldMs([ev.title, chapter?.synopsis ?? ''].join(' '), playbackSpeed)

    const t = setTimeout(() => {
      if (idx >= orderedEvents.length - 1) setIsPlayingStory(false)
      else setActiveEventId(orderedEvents[idx + 1].id)
    }, holdMs)

    return () => clearTimeout(t)
  }, [isPlayingStory, activeEventId, orderedEvents, chapters, playbackSpeed, setActiveEventId, setIsPlayingStory])

  function handlePlayPause() {
    if (isPlayingStory) {
      setIsPlayingStory(false)
    } else {
      if (!activeEventId || orderedEvents.findIndex(e => e.id === activeEventId) >= orderedEvents.length - 1) {
        setActiveEventId(orderedEvents[0]?.id ?? null)
      }
      setIsPlayingStory(true)
    }
  }

  // ── Callout positioning ─────────────────────────────────────────────────────
  const scrollerRef     = useRef<HTMLDivElement>(null)
  const activeMarkerRef = useRef<HTMLButtonElement>(null)
  const [calloutLeft, setCalloutLeft]       = useState<number | null>(null)
  const [calloutVisible, setCalloutVisible] = useState(true)

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
      const rect    = marker.getBoundingClientRect()
      const center  = rect.left + rect.width / 2
      const half    = 170
      setCalloutLeft(Math.max(half + 12, Math.min(window.innerWidth - half - 12, center)))
    })
    return () => cancelAnimationFrame(id)
  }, [activeEventId, chapters])

  if (!timelines.length || !chapters.length) return null

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, overflow: 'visible' }}>

      {/* Callout */}
      {activeChapter && calloutLeft !== null && calloutVisible && (
        <Callout
          left={calloutLeft}
          chapterNum={activeChapter.number}
          title={activeChapter.title}
          synopsis={activeChapter.synopsis ?? ''}
          hasPrev={!!prevChapter}
          hasNext={!!nextChapter}
          onPrev={() => prevChapter && selectChapter(prevChapter.id)}
          onNext={() => nextChapter && selectChapter(nextChapter.id)}
        />
      )}

      {/* Bar */}
      <div style={{
        height: BAR_H,
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
          <button onClick={handlePlayPause} title={isPlayingStory ? 'Pause' : 'Play story'}
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
        <div ref={scrollerRef} style={{
          display: 'flex', alignItems: 'center', flex: 1,
          overflowX: 'auto', overflowY: 'visible',
          scrollbarWidth: 'none', paddingLeft: '0.75rem', paddingRight: '0.75rem',
          height: '100%', gap: 0,
        }}>
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            width: '100%', justifyContent: 'space-between',
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
                  {/* Chapter marker — selects first event of the chapter */}
                  <button
                    ref={isChapterActive && !activeEvent ? activeMarkerRef : undefined}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                      padding: '0 0.4rem', minWidth: '2rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      flexShrink: 0, position: 'relative', zIndex: 1,
                      opacity: isChapterActive ? 1 : 0.7, transition: 'opacity 0.2s',
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
  )
}
