import { useRef } from 'react'
import { useAppStore, useActiveEventId } from '@/store'
import { useTimelines, useChapters, useEvents, useTimelineEvents } from '@/db/hooks/useTimeline'
import type { Chapter, WorldEvent } from '@/types'

function EventDot({ event, isActive }: { event: WorldEvent; isActive: boolean }) {
  return (
    <div
      title={event.title}
      className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
        isActive
          ? 'bg-[hsl(var(--foreground))]'
          : 'bg-[hsl(var(--muted-foreground))] opacity-60'
      }`}
    />
  )
}

function ChapterBlock({
  chapter,
  isActive,
  activeEventId,
  onClick,
}: {
  chapter: Chapter
  isActive: boolean
  activeEventId: string | null
  onClick: () => void
}) {
  const events = useEvents(chapter.id)

  return (
    <button
      onClick={onClick}
      title={chapter.title}
      className={`group flex shrink-0 flex-col gap-1 rounded-md border px-3 py-1.5 text-left transition-colors ${
        isActive
          ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]'
      }`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          Ch.{chapter.number}
        </span>
        <span className="max-w-[120px] truncate text-xs font-medium">{chapter.title}</span>
      </div>

      {events.length > 0 && (
        <div className="flex items-center gap-0.5 flex-wrap" style={{ maxWidth: 140 }}>
          {events.map((ev) => (
            <EventDot key={ev.id} event={ev} isActive={ev.id === activeEventId} />
          ))}
        </div>
      )}
    </button>
  )
}

export function MapTimeline({ worldId }: { worldId: string }) {
  const activeEventId = useActiveEventId()
  const { setActiveEventId } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const timelines = useTimelines(worldId)
  const firstTimeline = timelines[0] ?? null
  const chapters = useChapters(firstTimeline?.id ?? null)
  const allEvents = useTimelineEvents(firstTimeline?.id ?? null)

  if (!firstTimeline || chapters.length === 0) {
    return (
      <div className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
          No chapters yet — add chapters in the Timeline view to navigate the map by event.
        </p>
      </div>
    )
  }

  // Derive active chapter from active event
  const activeEvent = activeEventId ? allEvents.find(e => e.id === activeEventId) ?? null : null
  const activeChapterId = activeEvent?.chapterId ?? null

  /** Select the first event of a chapter. */
  function selectChapter(chapterId: string) {
    const events = allEvents
      .filter(e => e.chapterId === chapterId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    if (events.length > 0) setActiveEventId(events[0].id)
  }

  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
      <div
        ref={scrollRef}
        className="flex items-start gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* "None" pill to deselect */}
        <button
          onClick={() => setActiveEventId(null)}
          title="No event selected"
          className={`flex shrink-0 items-center rounded-md border px-2 py-1.5 text-xs transition-colors ${
            !activeEventId
              ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
              : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          —
        </button>

        {/* Connector line */}
        <div className="mt-3 h-px w-2 shrink-0 bg-[hsl(var(--border))]" />

        {chapters.map((ch, i) => (
          <div key={ch.id} className="flex items-start">
            <ChapterBlock
              chapter={ch}
              isActive={activeChapterId === ch.id}
              activeEventId={activeEventId}
              onClick={() => {
                if (activeChapterId === ch.id) setActiveEventId(null)
                else selectChapter(ch.id)
              }}
            />
            {i < chapters.length - 1 && (
              <div className="mt-3 h-px w-2 shrink-0 bg-[hsl(var(--border))]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
