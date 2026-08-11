import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Network, StickyNote, ChevronDown, ChevronRight, Scroll } from 'lucide-react'
import { useChapter, useEvents, useWorldEvents, useWorldChapters, useTimelines, updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { journalGroup } from '@/db/hooks/useOperations'
import { useChapterEventSnapshots } from '@/db/hooks/useSnapshots'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { useEventRelationshipSnapshots } from '@/db/hooks/useRelationshipSnapshots'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { Button } from '@/components/ui/button'
import { EventCard } from './EventCard'
import { SnapshotCard } from './SnapshotCard'
import { AddEventDialog } from './AddEventDialog'
import { EmptyState } from '@/components/EmptyState'
import type { Character, WorldEvent } from '@/types'
import { useAppStore } from '@/store'
import { cursorForChapter } from '@/lib/chapterCursor'
import { castWithoutState, charactersNotInChapter, hasAnyCharacterState } from '@/lib/chapterCast'

/**
 * One scene's cast and the state each of them is in (CD-1).
 *
 * This used to list only the snapshots that happened to exist, which meant a
 * scene with five named characters and no snapshots yet showed nothing at all —
 * and the panel's dominant content became the world's other thirty-six
 * characters, each marked *no snapshot*. The writer's question is "who is here
 * and what state are they in"; the answer starts from the scene's own cast, and
 * a cast member with nothing recorded is a gap worth showing rather than a
 * reason to leave them out.
 */
function EventSnapshotSection({
  event,
  snapshots,
  characters,
}: {
  event: WorldEvent
  snapshots: ReturnType<typeof useChapterEventSnapshots>
  characters: Character[]
}) {
  const [open, setOpen] = useState(true)
  const eventSnapshots = snapshots.filter((s) => s.eventId === event.id)
  const uncast = castWithoutState(event, snapshots, characters)

  const total = eventSnapshots.length + uncast.length
  if (total === 0) return null

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        }
        <span className="truncate flex-1">{event.title}</span>
        <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{total}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-[hsl(var(--border))] p-2">
          {eventSnapshots.map((s) => (
            <SnapshotCard key={s.id} snapshot={s} />
          ))}
          {uncast.map((c) => (
            <div
              key={c.id}
              data-cast-without-state={c.id}
              className="flex items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-3 py-2 text-xs"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="ml-auto shrink-0 italic text-[hsl(var(--muted-foreground))]">in the scene, no state recorded</span>
            </div>
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
  const worldEvents = useWorldEvents(worldId ?? null)
  const worldChapters = useWorldChapters(worldId ?? null)
  const worldTimelines = useTimelines(worldId ?? null)
  const world = useWorld(worldId ?? null)
  const inWorldDays = computeInWorldDays(worldEvents, worldChapters, worldTimelines)
  const characters = useCharacters(worldId ?? null)
  const relationships = useRelationships(worldId ?? null)
  const gate = useGate()
  const activeEventId = useAppStore((st) => st.activeEventId)
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)

  /**
   * Opening a chapter puts you in it.
   *
   * It used to leave the cursor on "All chapters", so every per-moment tool
   * stayed dark — the Writer's Brief opened empty, still asking for an event,
   * while the chapter was on screen. Keyed on the chapter so it fires once per
   * arrival rather than fighting a cursor the writer moves afterwards.
   *
   * Never while reading: there the cursor is the reader's own place in the book,
   * and moving it forward to wherever they happened to open would hand them the
   * chapter they had not reached yet.
   */
  const settledChapterRef = useRef<string | null>(null)
  useEffect(() => {
    if (gate.active || !chapterId) return
    if (settledChapterRef.current === chapterId) return
    // The live query still holds the previous chapter's rows for a render after
    // the route changes. Settling on those marks this chapter done and then
    // finds the old cursor among the old events, so nothing moves — which is
    // exactly the bug this effect exists to fix, one chapter late.
    const mine = events.filter((e) => e.chapterId === chapterId)
    if (mine.length === 0) return
    settledChapterRef.current = chapterId
    const target = cursorForChapter(mine, activeEventId)
    if (target) setActiveEventId(target)
  }, [gate.active, chapterId, events, activeEventId, setActiveEventId])

  const [addEventOpen, setAddEventOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [showAbsent, setShowAbsent] = useState(false)

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
    // Two records, one act: undo has to swap them back together, or the
    // ordering is left half-applied.
    await journalGroup(() => Promise.all([
      updateEvent(a.id, { sortOrder: b.sortOrder }),
      updateEvent(b.id, { sortOrder: a.sortOrder }),
    ]))
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (chapter) setNotes(chapter.notes ?? '')
  }, [chapter?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleNotesChange(value: string) {
    setNotes(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // One writing burst is one undo step, not one per typing pause.
      if (chapterId) updateChapter(chapterId, { notes: value }, { coalesce: true })
    }, 600)
  }

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center text-[hsl(var(--muted-foreground))]">
        Chapter not found.
      </div>
    )
  }

  // The rest of the world's characters are not in this chapter, which is
  // ordinary rather than a finding — so the roll-call of them is folded away by
  // default (CD-1) instead of being the panel's dominant content.
  const missingSnapshots = charactersNotInChapter(characters, sortedEvents, allSnapshots)
  const anyState = hasAnyCharacterState(sortedEvents, allSnapshots)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Back" title="Back" onClick={() => navigate(-1)}>
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
      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Events */}
        <div className="flex flex-col border-b border-[hsl(var(--border))] lg:flex-1 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2">
            <span className="text-sm font-medium">Events ({events.length})</span>
            {!gate.active && (
              <Button size="sm" onClick={() => setAddEventOpen(true)}>
                <Plus className="h-4 w-4" /> Add Event
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 p-4 lg:flex-1 lg:overflow-auto">
            {events.length === 0 ? (
              <EmptyState
                icon={Scroll}
                title="No events yet"
                description="Add the first event to this chapter."
                action={<Button size="sm" onClick={() => setAddEventOpen(true)}><Plus className="h-4 w-4" /> Add Event</Button>}
              />
            ) : (
              sortedEvents.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  isFirst={i === 0}
                  isLast={i === sortedEvents.length - 1}
                  onMoveUp={() => moveEvent(e.id, 'up')}
                  onMoveDown={() => moveEvent(e.id, 'down')}
                  inWorldDay={inWorldDays.get(e.id)}
                  calendar={world?.calendar ?? null}
                />
              ))
            )}
          </div>
        </div>

        {/* Character snapshots — per-event breakdown */}
        <div className="flex flex-col border-b border-[hsl(var(--border))] lg:w-80 lg:shrink-0 lg:overflow-hidden lg:border-b-0">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
            <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-sm font-medium">Character States</span>
          </div>
          <div className="flex flex-col gap-2 p-3 lg:flex-1 lg:overflow-auto">
            {events.length === 0 && (
              <EmptyState icon={Scroll} title="No events yet" className="py-4" />
            )}

            {/* EV-2: with events but nobody in them the column used to be a
                blank column with no explanation at all. */}
            {events.length > 0 && !anyState && (
              <EmptyState
                icon={Users}
                title="No one in this chapter yet"
                description="Add characters to a scene's cast, or record their state on the map, and they will appear here."
                className="py-4"
              />
            )}

            {sortedEvents.map((ev) => (
              <EventSnapshotSection
                key={ev.id}
                event={ev}
                snapshots={allSnapshots}
                characters={characters}
              />
            ))}

            {/* Everyone else in the world, folded away (CD-1) */}
            {missingSnapshots.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setShowAbsent((v) => !v)}
                  aria-expanded={showAbsent}
                  className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {showAbsent
                    ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  }
                  {missingSnapshots.length} other character{missingSnapshots.length !== 1 ? 's' : ''} not in this chapter
                </button>
                {showAbsent && missingSnapshots.map((c) => (
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
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No relationship states recorded.</p>
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
        <div className="flex flex-col lg:w-72 lg:shrink-0 lg:overflow-hidden lg:border-l lg:border-[hsl(var(--border))]">
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-2">
            <StickyNote className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <span className="text-sm font-medium">Writer's Notes</span>
          </div>
          <div className="flex flex-col p-3 lg:flex-1">
            <textarea
              className="min-h-[10rem] resize-y rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors focus:border-[hsl(var(--ring))] leading-relaxed lg:min-h-0 lg:flex-1 lg:resize-none lg:text-xs"
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
