import { useState, useMemo, useEffect, useCallback, type ReactNode, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Chapter, WorldEvent } from '@/types'
import type { ChapterRun } from '@/lib/combinedTimeline'

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
  /** See `ScrubberProps.linkedEventIds`. */
  linked?: ReadonlySet<string>
}

const NO_LINKS: ReadonlySet<string> = new Set()

export function ChapterSegment({
  chapter, events, segmentState, activeEventId, color, compact,
  activeMarkerRef, onEventSelect, onChapterSelect, linked = NO_LINKS,
}: ChapterSegmentProps) {
  const isActive = segmentState === 'active'
  const isPast   = segmentState === 'past'
  const isEmpty  = segmentState === 'empty'

  const activeIdx  = activeEventId ? events.findIndex((e) => e.id === activeEventId) : -1
  const fillRatio  = isPast ? 1 : (isActive && activeIdx >= 0) ? (activeIdx + 0.5) / events.length : 0
  const opacity    = isEmpty ? 0.28 : (!isActive && !isPast) ? 0.42 : 1
  /*
    W19-10, the same rule as the panel beside it: a timeline's stored colour is
    an identity mark, not ink. The active chapter's name was painted in it at
    0.56rem — `#6366f1` on Paper's active segment measures **3.63:1**, under the
    4.5 this size needs. The colour is already all over this component as marks
    — the fill rail, every event tick, the active tick's glow — so the label
    only has to stop competing with them, not replace them.
  */
  const labelColor = isActive ? 'var(--tl-text)' : 'var(--tl-text-muted)'

  const slotRem  = compact ? 1.5 : 2
  /*
    MT-1: the frame track used to fall back to a 2.5rem segment, which fits a
    chapter number and nothing else — so the outer track of a frame narrative
    read `0 1 2 3 4 5 6 13 17 …` directly above an inner track reading
    *8 · Thie…*, *12 · Puz…*. The same component at two densities, and the
    *frame* of a frame narrative was the half you could not read. The floor is
    now wide enough for a title to survive truncation, which is all the inner
    track ever promised either.
  */
  const minRem   = compact ? 5.5 : 3
  const widthRem = Math.max(minRem, events.length * slotRem)
  const railH    = compact ? 2 : 3

  return (
    <div
      style={{
        /*
          EV-7: a fixed width meant a one-chapter world drew a 48px stub in a
          1300px bar — the title cut to "1 · L…" and the rail so short that it
          and its single tick read as a clipped "+". Growing shares whatever the
          chapters do not fill, in proportion to how many scenes each holds, so
          the track is the width of the bar whenever it can be. Past that, the
          minimum holds and the scroller takes over exactly as before.
        */
        flexGrow: Math.max(1, events.length), flexShrink: 0, flexBasis: `${widthRem}rem`,
        minWidth: `${widthRem}rem`, height: '100%',
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
      // A truncated title is still worth having in full on hover, and the
      // frame track truncates sooner than the story track does.
      title={isEmpty
        ? 'Add a scene to this chapter to activate it.'
        : `Ch. ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ''}`}
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

      {/*
        The rail and its ticks are absolutely positioned, so without a height of
        its own this box collapses and the rail draws straight through the label
        beneath it. Invisible while the compact label was a bare digit; obvious
        the moment it carries a title (MT-1). 14px clears the tallest tick.
      */}
      <div style={{
        position: 'relative', flex: compact ? undefined : 1,
        display: 'flex', alignItems: 'center',
        margin: compact ? 0 : '0.2rem 0',
        minHeight: compact ? '14px' : `${railH * 6}px`,
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
          const isLinked   = linked.has(ev.id)
          return (
            <button
              key={ev.id}
              ref={isEvActive ? activeMarkerRef : undefined}
              title={isLinked ? `${ev.title} — paired with a moment on the other track` : ev.title}
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
              {/* MT-7: a paired moment carries a dot above its tick, so a
                  pairing is visible on the bar rather than only in the
                  relationship editor. Above rather than on the tick, which
                  already encodes position and whether playback has passed it. */}
              {isLinked && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: color, opacity: hasFired ? 1 : 0.6,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {compact && (
        <div style={{
          fontSize: '0.48rem', color: labelColor, fontFamily: 'var(--font-body)',
          fontWeight: isActive ? 700 : 400, letterSpacing: '0.04em',
          textAlign: 'center', lineHeight: 1, flexShrink: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'color 0.2s',
        }}>
          <span style={{ opacity: 0.6 }}>{chapter.number}</span>
          {chapter.title && <span> · {chapter.title}</span>}
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
  /**
   * Events paired with a moment on the other track by a sync point (MT-7).
   * Nothing on the bar said a pairing existed, so the only way to know was to
   * open the relationship editor and read the list.
   */
  linkedEventIds?: ReadonlySet<string>
}

/** Horizontal scroller shell shared by both scrubbers: edge fade-arrows,
 *  wheel-to-scroll, and hidden native scrollbar. `depKey` re-measures the
 *  arrows when the content changes. */
function ScrubberShell({
  scrollerRef, compact, depKey, children,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>
  compact: boolean
  depKey: unknown
  children: ReactNode
}) {
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
  }, [depKey, updateArrows, scrollerRef])

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
        {children}
      </div>
    </div>
  )
}

export function Scrubber({
  chapters, events, activeEventId, color, compact,
  scrollerRef, activeMarkerRef, onEventSelect, onChapterSelect,
  linkedEventIds = NO_LINKS,
}: ScrubberProps) {
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

  return (
    <ScrubberShell scrollerRef={scrollerRef} compact={compact} depKey={chapters}>
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
          linked={linkedEventIds}
        />
      ))}
    </ScrubberShell>
  )
}

// ── Combined scrubber (all timelines) ──────────────────────────────────────────

export interface CombinedScrubberProps {
  runs: ChapterRun[]
  activeEventId: string | null
  scrollerRef: RefObject<HTMLDivElement | null>
  activeMarkerRef: RefObject<HTMLButtonElement | null>
  onEventSelect: (eventId: string, locationMarkerId?: string | null) => void
}

/** Lays a merged, cross-timeline sequence out as a strip of chapter runs, each
 *  tinted with its own timeline's colour so the braiding of storylines reads at
 *  a glance. Reuses {@link ChapterSegment} for each run. */
export function CombinedScrubber({
  runs, activeEventId, scrollerRef, activeMarkerRef, onEventSelect,
}: CombinedScrubberProps) {
  const activeRunIdx = activeEventId
    ? runs.findIndex((r) => r.events.some((e) => e.id === activeEventId))
    : -1

  function getSegmentState(idx: number): SegmentState {
    if (activeRunIdx === -1) return 'future'
    if (idx === activeRunIdx) return 'active'
    return idx < activeRunIdx ? 'past' : 'future'
  }

  return (
    <ScrubberShell scrollerRef={scrollerRef} compact={false} depKey={runs}>
      {runs.map((run, idx) => (
        <ChapterSegment
          key={run.key}
          chapter={run.chapter ?? { id: run.key, number: 0, title: '' } as Chapter}
          events={run.events}
          segmentState={getSegmentState(idx)}
          activeEventId={activeEventId}
          color={run.timeline?.color ?? 'var(--tl-accent)'}
          compact={false}
          activeMarkerRef={activeMarkerRef}
          onEventSelect={onEventSelect}
          onChapterSelect={() => onEventSelect(run.events[0].id, run.events[0].locationMarkerId)}
        />
      ))}
    </ScrubberShell>
  )
}
