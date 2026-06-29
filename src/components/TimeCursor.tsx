import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { useActiveEventId, useAppStore } from '@/store'
import { useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { cn } from '@/lib/utils'

/**
 * Always-visible readout + stepper for the global time cursor (`activeEventId`).
 *
 * The chapter cursor is the heart of the app — every view reads state relative
 * to it — but it previously lived only in the bottom timeline bar, which is
 * hidden on several sections (Dashboard, Arc, Lore, Factions, Settings). This
 * surfaces "what moment am I viewing" in the TopBar on every page, and lets the
 * writer step through time or jump to the full timeline from anywhere.
 *
 * It reads and writes the same `activeEventId` as the bottom bar, so the two
 * stay perfectly in sync wherever both are shown.
 */
export function TimeCursor({ worldId }: { worldId: string }) {
  const navigate = useNavigate()
  const activeEventId = useActiveEventId()
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  const chapters = useWorldChapters(worldId)
  const events = useWorldEvents(worldId)

  // Order events the same way the timeline bar does: by chapter number, then
  // by the event's sort order within its chapter.
  const orderedEvents = useMemo(() => {
    const numById = new Map(chapters.map((c) => [c.id, c.number]))
    return [...events].sort((a, b) => {
      const an = (numById.get(a.chapterId) ?? 0) * 10_000 + a.sortOrder
      const bn = (numById.get(b.chapterId) ?? 0) * 10_000 + b.sortOrder
      return an - bn
    })
  }, [events, chapters])

  const activeIndex = activeEventId ? orderedEvents.findIndex((e) => e.id === activeEventId) : -1
  const activeEvent = activeIndex >= 0 ? orderedEvents[activeIndex] : null
  const activeChapter = activeEvent ? chapters.find((c) => c.id === activeEvent.chapterId) ?? null : null
  const prevEvent = activeIndex > 0 ? orderedEvents[activeIndex - 1] : null
  const nextEvent =
    activeIndex >= 0
      ? activeIndex < orderedEvents.length - 1
        ? orderedEvents[activeIndex + 1]
        : null
      : (orderedEvents[0] ?? null) // from "All", stepping forward lands on the first moment

  // Nothing to point at yet — stay out of the way until the story has a moment.
  if (orderedEvents.length === 0) return null

  const stepBtn =
    'flex h-6 w-5 items-center justify-center rounded text-[hsl(var(--muted-foreground))] transition-colors enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30'

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => prevEvent && setActiveEventId(prevEvent.id)}
        disabled={!prevEvent}
        aria-label="Previous moment"
        title="Previous moment"
        className={stepBtn}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <button
        onClick={() => navigate(`/worlds/${worldId}/timeline`)}
        title={
          activeEvent
            ? `Ch.${activeChapter?.number} · ${activeChapter?.title} — ${activeEvent.title || 'Untitled event'} (open timeline)`
            : 'Viewing all chapters — open the timeline to pick a moment'
        }
        className={cn(
          'flex h-7 max-w-[200px] items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
          activeEvent
            ? 'border-[hsl(var(--ring)/0.4)] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {activeEvent ? (
          <span className="truncate">
            <span className="font-semibold">Ch.{activeChapter?.number ?? '—'}</span>
            <span className="text-[hsl(var(--muted-foreground))]">
              {' · '}
              {activeEvent.title || activeChapter?.title || 'Untitled'}
            </span>
          </span>
        ) : (
          <span className="truncate">All chapters</span>
        )}
      </button>

      <button
        onClick={() => nextEvent && setActiveEventId(nextEvent.id)}
        disabled={!nextEvent}
        aria-label="Next moment"
        title="Next moment"
        className={stepBtn}
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {activeEvent && (
        <button
          onClick={() => setActiveEventId(null)}
          aria-label="View all chapters"
          title="View all chapters"
          className={stepBtn}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
