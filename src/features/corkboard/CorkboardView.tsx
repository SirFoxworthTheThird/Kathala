import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Eye, GripVertical, LayoutGrid } from 'lucide-react'
import { useWorldChapters, useWorldEvents, useTimelines, moveEventOnBoard, updateEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { EVENT_STATUSES, EVENT_STATUS_CONFIG } from '@/lib/eventStatus'
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
  event, pov, onOpen, onStatusChange, onDragStart, onDragEnd, dragging,
}: {
  event: WorldEvent
  pov: Character | null
  onOpen: () => void
  onStatusChange: (s: WorldEvent['status']) => void
  onDragStart: () => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const status = event.status ?? 'draft'
  const cfg = EVENT_STATUS_CONFIG[status]
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-left shadow-sm transition-opacity ${dragging ? 'opacity-40' : ''}`}
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
          <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]" title={`POV: ${pov.name}`}>
            <Eye className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: charColor(pov) }} />
            <span className="max-w-[6rem] truncate">{pov.name}</span>
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
              <option key={s} value={s}>{EVENT_STATUS_CONFIG[s].label}</option>
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
  const { setActiveEventId } = useAppStore()

  const chapters   = useWorldChapters(worldId ?? null)
  const events     = useWorldEvents(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const timelines  = useTimelines(worldId ?? null)

  const [drag, setDrag] = useState<DragState | null>(null)
  const [overChapter, setOverChapter] = useState<string | null>(null)

  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters])
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
        <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Corkboard</h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Drag scene cards to reorder them within a chapter or move them to another.
        </p>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex h-full gap-4">
          {columns.map(({ chapter, events: colEvents }) => {
            const isOver = overChapter === chapter.id
            const tl = timelineById.get(chapter.timelineId)
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
  )
}
