import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, BookOpen, Plus, ExternalLink } from 'lucide-react'
import type { Chapter } from '@/types'
import { deleteChapter, useEvents, updateEvent } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { EventRow } from './EventRow'
import { AddEventDialog } from './AddEventDialog'
import { cn } from '@/lib/utils'

interface ChapterRowProps {
  chapter: Chapter
}

export function ChapterRow({ chapter }: ChapterRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const events = useEvents(expanded ? chapter.id : null)

  const isActive = chapter.id === activeEventId
  const sortedEvents = [...events].sort((a, b) => a.sortOrder - b.sortOrder)

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

  async function handleDelete() {
    if (confirm(`Delete chapter "${chapter.title}"?`)) {
      await deleteChapter(chapter.id)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      isActive ? 'border-[hsl(var(--ring))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
    )}>
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />}
          <BookOpen className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium text-[hsl(var(--foreground))] shrink-0">
            Ch. {chapter.number} — {chapter.title}
          </span>
          {chapter.synopsis && (
            <span className="hidden lg:block text-xs text-[hsl(var(--muted-foreground))] truncate min-w-0">
              — {chapter.synopsis}
            </span>
          )}
        </button>

        <Button
          size="sm"
          variant={isActive ? 'secondary' : 'ghost'}
          className="h-7 px-2 text-xs shrink-0"
          onClick={() => setActiveEventId(isActive ? null : chapter.id)}
        >
          {isActive ? 'Active' : 'Set Active'}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => navigate(`/worlds/${worldId}/timeline/${chapter.id}`)}
          title="Open chapter detail"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:text-red-400"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Expanded events */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-4 pt-3 pb-2 flex flex-col">
          {sortedEvents.length === 0 ? (
            <p className="text-xs italic text-[hsl(var(--muted-foreground))] pb-2">No events yet.</p>
          ) : (
            <div className="flex flex-col">
              {sortedEvents.map((e, i) => (
                <EventRow
                  key={e.id}
                  event={e}
                  isFirst={i === 0}
                  isLast={i === sortedEvents.length - 1}
                  onMoveUp={() => moveEvent(e.id, 'up')}
                  onMoveDown={() => moveEvent(e.id, 'down')}
                />
              ))}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs self-start mt-1"
            onClick={() => setAddEventOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Event
          </Button>
        </div>
      )}

      <AddEventDialog
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        worldId={chapter.worldId}
        chapterId={chapter.id}
        timelineId={chapter.timelineId}
        nextSortOrder={events.length}
      />
    </div>
  )
}
