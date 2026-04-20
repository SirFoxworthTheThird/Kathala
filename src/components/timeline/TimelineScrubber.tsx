import { useState, useMemo, useEffect, useCallback, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Chapter, WorldEvent } from '@/types'

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

  const slotRem  = compact ? 1.5 : 2
  const minRem   = compact ? 2.5 : 3
  const widthRem = Math.max(minRem, events.length * slotRem)
  const railH    = compact ? 2 : 3

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
      }}
      onClick={isEmpty ? undefined : onChapterSelect}
      title={isEmpty ? 'Add an event to this chapter to activate it.' : undefined}
    >
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

      <div style={{
        position: 'relative', flex: compact ? undefined : 1,
        display: 'flex', alignItems: 'center',
        margin: compact ? 0 : '0.2rem 0',
        minHeight: compact ? undefined : `${railH * 6}px`,
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '50%',
          height: railH, background: 'var(--tl-border)',
          borderRadius: railH, transform: 'translateY(-50%)',
        }} />
        <div style={{
          position: 'absolute', left: 0, top: '50%',
          height: railH, width: `${fillRatio * 100}%`,
          background: color, borderRadius: railH,
          transform: 'translateY(-50%)',
          transition: 'width 0.25s ease', zIndex: 1,
        }} />
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

export interface ScrubberProps {
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

export function Scrubber({
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
