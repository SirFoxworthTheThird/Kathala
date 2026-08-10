import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, GripVertical, LayoutGrid } from 'lucide-react'
import { useWorldChapters, useWorldEvents, useTimelines, moveEventOnBoard, updateEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { chapterProgress, describeProgress, describeBoard } from '@/lib/chapterProgress'
import { EVENT_STATUSES, eventStatusConfig } from '@/lib/eventStatus'
import { charColor } from '@/lib/characterColor'
import { useAppStore } from '@/store'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import type { WorldEvent, Character } from '@/types'

interface DragState {
  eventId: string
  fromChapterId: string
}

// ── One scene card ─────────────────────────────────────────────────────────────

function SceneCard({
  event, pov, words, isCurrent, onOpen, onStatusChange, onDragStart, onDragEnd, dragging,
}: {
  event: WorldEvent
  pov: Character | null
  /** Words of prose written for this scene, 0 when none (CB-3). */
  words: number
  /** The scene the time cursor is on (W-1). */
  isCurrent: boolean
  onOpen: () => void
  onStatusChange: (s: WorldEvent['status']) => void
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const status = event.status ?? 'draft'
  const cfg = eventStatusConfig(status)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      // W-1: the board now answers to the cursor, which is what earns it the
      // chapter bar — a control that moved nothing would have been worse than
      // its absence.
      aria-current={isCurrent ? 'true' : undefined}
      className={`group rounded-md border bg-[hsl(var(--background))] p-2.5 text-left shadow-sm transition-opacity ${
        isCurrent ? 'border-[hsl(var(--ring))] ring-1 ring-[hsl(var(--ring))]' : 'border-[hsl(var(--border))]'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-[hsl(var(--muted-foreground))] opacity-40 group-hover:opacity-100" aria-hidden="true" />
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">
            {event.title || <span className="italic opacity-60">Untitled scene</span>}
          </p>
          {event.description && (
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {event.description}
            </p>
          )}
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {pov && (
          // `min-w-0` so the name yields space to the word count beside it
          // rather than pushing it out of a 256px column.
          <span className="flex min-w-0 items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]" title={`POV: ${pov.name}`}>
            <Eye className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: charColor(pov) }} />
            <span className="truncate">{pov.name}</span>
          </span>
        )}
        {/* CB-3: the corkboard is where scene length should be comparable at a
            glance. A scene with no prose yet shows nothing rather than "0
            words" — the outlining is the work that has been done. */}
        {words > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
          </span>
        )}
        {/* Status pill doubles as a quick-change select. */}
        <label className="relative ml-auto" title="Scene status">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: cfg.color, color: cfg.textColor }}
          >
            {cfg.label}
          </span>
          <select
            aria-label="Scene status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as WorldEvent['status'])}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>{eventStatusConfig(s).label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

// ── Board ──────────────────────────────────────────────────────────────────────

export default function CorkboardView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId } = useAppStore()

  const chapters   = useWorldChapters(worldId ?? null)
  const events     = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const timelines  = useTimelines(worldId ?? null)
  const sceneTexts = useWorldSceneTexts(worldId ?? null)

  const [drag, setDrag] = useState<DragState | null>(null)
  const [overChapter, setOverChapter] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
  const wordsByEvent = useMemo(
    () => new Map(sceneTexts.map((t) => [t.eventId, t.wordCount ?? 0])),
    [sceneTexts],
  )
  const multiTimeline = timelines.length > 1
  const timelineById = useMemo(() => new Map(timelines.map((t) => [t.id, t])), [timelines])

  // Chapters in reading order; events grouped per chapter in sortOrder.
  const columns = useMemo(() => {
    const ordered = [...chapters].sort((a, b) => a.number - b.number)
    const byChapter = new Map<string, WorldEvent[]>()
    for (const ev of events) {
      const list = byChapter.get(ev.chapterId) ?? []
      list.push(ev)
      byChapter.set(ev.chapterId, list)
    }
    for (const list of byChapter.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)
    return ordered.map((ch) => ({ chapter: ch, events: byChapter.get(ch.id) ?? [] }))
  }, [chapters, events])

  // Which way there is more board (CB-2). Recomputed on scroll, on resize, and
  // whenever the column count changes — the last of these matters because a
  // world's chapters arrive from a live query after the first paint, so
  // measuring only once would always measure an empty board.
  const measureEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    measureEdges()
    window.addEventListener('resize', measureEdges)
    return () => window.removeEventListener('resize', measureEdges)
  }, [measureEdges, columns.length])

  /** Move about a screenful, so a press lands on columns you have not seen. */
  function nudge(direction: 1 | -1) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  function openEvent(ev: WorldEvent) {
    setActiveEventId(ev.id)
    navigate(`/worlds/${worldId}/timeline/${ev.chapterId}`)
  }

  // Drop the dragged card before `index` in `chapterId` (index = column length → append).
  async function dropAt(chapterId: string, index: number) {
    setOverChapter(null)
    const d = drag
    setDrag(null)
    if (!d) return
    await moveEventOnBoard(d.eventId, chapterId, index)
  }

  if (chapters.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={LayoutGrid}
          title="No chapters yet"
          description="The corkboard shows a card for each scene, grouped by chapter. Add chapters and events on the Timeline to populate it."
          action={(
            <Button size="sm" variant="outline" onClick={() => navigate(`/worlds/${worldId}/timeline`)}>
              Go to Timeline
            </Button>
          )}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[hsl(var(--border))] px-6 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Corkboard</h1>
          {/* CB-2: five of seventeen columns fit on screen, and nothing said the
              other twelve existed. The board's size belongs where you look
              first. */}
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
            {describeBoard(columns.length, events.length)}
          </span>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Drag scene cards to reorder them within a chapter or move them to another.
        </p>
      </div>

      {/*
        CB-2, the other half: the board runs off the right-hand edge and the
        only thing that said so was the platform scrollbar — which draws as an
        overlay here, measured at a 0px gutter, so it is invisible until you are
        already scrolling. These are drawn by the app instead, so they are
        present before the first gesture and reachable from the keyboard. Each
        appears only when there is board in that direction.
      */}
      <div className="relative min-h-0 flex-1">
        {edges.left && (
          <button
            aria-label="Scroll to earlier chapters"
            onClick={() => nudge(-1)}
            className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 text-[hsl(var(--muted-foreground))] shadow-md hover:text-[hsl(var(--foreground))]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {edges.right && (
          <button
            aria-label="Scroll to later chapters"
            onClick={() => nudge(1)}
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 text-[hsl(var(--muted-foreground))] shadow-md hover:text-[hsl(var(--foreground))]"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <div ref={scrollRef} onScroll={measureEdges} className="h-full overflow-x-auto p-4">
        <div className="flex h-full gap-4">
          {columns.map(({ chapter, events: colEvents }) => {
            const isOver = overChapter === chapter.id
            const tl = timelineById.get(chapter.timelineId)
            const progress = chapterProgress(colEvents, wordsByEvent)
            return (
              <div
                key={chapter.id}
                className={`flex w-64 shrink-0 flex-col rounded-lg border ${isOver ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.3)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOverChapter(chapter.id) } }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverChapter((c) => (c === chapter.id ? null : c)) }}
                onDrop={(e) => { e.preventDefault(); dropAt(chapter.id, colEvents.filter((ev) => ev.id !== drag?.eventId).length) }}
              >
                <div className="border-b border-[hsl(var(--border))] px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Chapter {chapter.number}{multiTimeline && tl ? ` · ${tl.name}` : ''}
                  </p>
                  <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{chapter.title}</p>
                  {/* CB-4: the header named the chapter but not how much of it
                      there is, which is the one thing a column of cards cannot
                      show once it scrolls. An empty column is left to the "No
                      scenes yet" line below, which is also its drop target. */}
                  {progress.scenes > 0 && (
                    <p className="text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">
                      {describeProgress(progress)}
                    </p>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {colEvents.length === 0 && (
                    <p className="px-1 py-4 text-center text-[11px] italic text-[hsl(var(--muted-foreground))]">
                      No scenes yet.
                    </p>
                  )}
                  {colEvents.map((ev, index) => (
                    <div
                      key={ev.id}
                      onDragOver={(e) => { if (drag) e.preventDefault() }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Index within the list excluding the dragged card itself.
                        const target = colEvents.filter((x) => x.id !== drag?.eventId)
                        const at = target.findIndex((x) => x.id === ev.id)
                        dropAt(chapter.id, at < 0 ? index : at)
                      }}
                    >
                      <SceneCard
                        event={ev}
                        pov={ev.povCharacterId ? charById.get(ev.povCharacterId) ?? null : null}
                        words={wordsByEvent.get(ev.id) ?? 0}
                        isCurrent={ev.id === activeEventId}
                        dragging={drag?.eventId === ev.id}
                        onOpen={() => openEvent(ev)}
                        onStatusChange={(s) => updateEvent(ev.id, { status: s })}
                        onDragStart={() => setDrag({ eventId: ev.id, fromChapterId: chapter.id })}
                        onDragEnd={() => { setDrag(null); setOverChapter(null) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
