import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Network, StickyNote, ChevronDown, ChevronRight } from 'lucide-react'
import { useChapter, useEvents, updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { useChapterEventSnapshots } from '@/db/hooks/useSnapshots'
import { useEventRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { Button } from '@/components/ui/button'
import { EventCard } from './EventCard'
import { SnapshotCard } from './SnapshotCard'
import { AddEventDialog } from './AddEventDialog'
import type { WorldEvent } from '@/types'

// Collapsible section for one event's character snapshots
function EventSnapshotSection({
  event,
  snapshots,
}: {
  event: WorldEvent
  snapshots: ReturnType<typeof useChapterEventSnapshots>
}) {
  const [open, setOpen] = useState(true)
  const eventSnapshots = snapshots.filter((s) => s.eventId === event.id)

  if (eventSnapshots.length === 0) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        }
        <span className="truncate flex-1">{event.title}</span>
        <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{eventSnapshots.length}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[hsl(var(--border))] p-2">
          {eventSnapshots.map((s) => (
            <SnapshotCard key={s.id} snapshot={s} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChapterDetailView() {
  const { worldId, chapterId } = useParams<{ worldId: string; chapterId: string }>()
  const navigate = useNavigate()
  const chapter = useChapter(chapterId ?? null)
  const events = useEvents(chapterId ?? null)
  const characters = useCharacters(worldId ?? null)
  const relationships = useRelationships(worldId ?? null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [notes, setNotes] = useState('')

  const sortedEvents = [...events].sort((a, b) => a.sortOrder - b.sortOrder)
  const eventIds = sortedEvents.map((e) => e.id)
  const lastEventId = eventIds.length > 0 ? eventIds[eventIds.length - 1] : null

  const allSnapshots = useChapterEventSnapshots(eventIds)
  const relSnapshots = useEventRelationshipSnapshots(lastEventId)

  async function moveEvent(eventId: string, direction: 'up' | 'down') {
    const idx = sortedEvents.findIndex((e) => e.id === eventId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === sortedEvents.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = sortedEvents[idx]
    const b = sortedEvents[swapIdx]
    await Promise.all([
      updateEvent(a.id, { sortOrder: b.sortOrder }),
      updateEvent(b.id, { sortOrder: a.sortOrder }),
    ])
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (chapter) setNotes(chapter.notes ?? '')
  }, [chapter?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleNotesChange(value: string) {
    setNotes(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (chapterId) updateChapter(chapterId, { notes: value })
    }, 600)
  }

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Chapter not found.
      </div>
    )
  }

  // Characters with no snapshot in the entire chapter
  const snapshotCharIds = new Set(allSnapshots.map((s) => s.characterId))
  const missingSnapshots = characters.filter((c) => !snapshotCharIds.has(c.id))

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Ch. {chapter.number} — {chapter.title}</h2>
          {chapter.synopsis && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2" title={chapter.synopsis}>{chapter.synopsis}</p>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Events */}
        <div className="flex flex-1 flex-col border-r border-[hsl(var(--border))]">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
            <span className="text-sm font-medium">Events ({events.length})</span>
            <Button size="sm" onClick={() => setAddEventOpen(true)}>
              <Plus className="h-4 w-4" /> Add Event
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
            {events.length === 0 ? (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No events yet.</p>
            ) : (
              sortedEvents.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  isFirst={i === 0}
                  isLast={i === sortedEvents.length - 1}
                  onMoveUp={() => moveEvent(e.id, 'up')}
                  onMoveDown={() => moveEvent(e.id, 'down')}
                />
              ))
            )}
          </div>
        </div>

        {/* Character snapshots — per-event breakdown */}
        <div className="flex w-80 shrink-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
            <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-sm font-medium">Character States</span>
          </div>
          <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
            {events.length === 0 && (
              <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No events yet.
              </p>
            )}

            {sortedEvents.map((ev) => (
              <EventSnapshotSection
                key={ev.id}
                event={ev}
                snapshots={allSnapshots}
              />
            ))}

            {/* Characters with no snapshot anywhere in this chapter */}
            {missingSnapshots.length > 0 && (
              <div className="mt-1">
                <p className="mb-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {missingSnapshots.length} character{missingSnapshots.length !== 1 ? 's' : ''} not in any event:
                </p>
                {missingSnapshots.map((c) => (
                  <div key={c.id} className="mb-1 flex items-center gap-2 rounded border border-dashed border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                    {c.name}
                    <span className="ml-auto italic">no snapshot</span>
                  </div>
                ))}
              </div>
            )}

            {/* Relationship snapshots (end of chapter state) */}
            {relationships.length > 0 && (
              <div className="mt-1 border-t border-[hsl(var(--border))] pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Relationship States</span>
                  <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">end of chapter</span>
                </div>
                {relSnapshots.length === 0 ? (
                  <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No relationship states recorded.</p>
                ) : (
                  relSnapshots.map((rs) => {
                    const rel = relationships.find((r) => r.id === rs.relationshipId)
                    const charA = characters.find((c) => c.id === rel?.characterAId)
                    const charB = characters.find((c) => c.id === rel?.characterBId)
                    if (!rel || !charA || !charB) return null
                    return (
                      <div key={rs.id} className="mb-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-1 font-medium">
                          <span>{charA.name}</span>
                          <span className="text-[hsl(var(--muted-foreground))]">↔</span>
                          <span>{charB.name}</span>
                          {!rs.isActive && (
                            <span className="ml-1 rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">inactive</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{rs.label} · {rs.sentiment} · {rs.strength}</p>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Writer's Notes */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
            <StickyNote className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-sm font-medium">Writer's Notes</span>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <textarea
              className="flex-1 resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none focus:border-[hsl(var(--ring))] transition-colors leading-relaxed"
              placeholder="Freeform notes for this chapter — reminders, things to fix, ideas, open questions…"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
            />
            <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">Auto-saved</p>
          </div>
        </div>
      </div>

      {chapterId && worldId && (
        <AddEventDialog
          open={addEventOpen}
          onOpenChange={setAddEventOpen}
          worldId={worldId}
          chapterId={chapterId}
          timelineId={chapter.timelineId}
          nextSortOrder={events.length}
        />
      )}
    </div>
  )
}
