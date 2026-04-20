import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, BookOpen, Plus, ExternalLink, Scroll } from 'lucide-react'
import type { Chapter } from '@/types'
import { deleteChapter, useEvents, updateEvent } from '@/db/hooks/useTimeline'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EventRow } from './EventRow'
import { AddEventDialog } from './AddEventDialog'
import { EmptyState } from '@/components/EmptyState'

interface ChapterRowProps {
  chapter: Chapter
}

export function ChapterRow({ chapter }: ChapterRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId, selectedEventIds, selectEventRange, clearSelection } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const events = useEvents(chapter.id)

  const sortedEvents = [...events].sort((a, b) => a.sortOrder - b.sortOrder)
  const isActive = sortedEvents.some((e) => e.id === activeEventId)
  const chapterEventIds = sortedEvents.map((e) => e.id)
  const selectedInChapter = chapterEventIds.filter((id) => selectedEventIds.has(id))
  const allSelected = chapterEventIds.length > 0 && selectedInChapter.length === chapterEventIds.length
  const someSelected = selectedInChapter.length > 0 && !allSelected

  function handleSelectAll(e: React.MouseEvent) {
    e.stopPropagation()
    if (allSelected) {
      // deselect all in this chapter
      const next = new Set(selectedEventIds)
      chapterEventIds.forEach((id) => next.delete(id))
      // Replace store set — use clearSelection then re-add others
      const others = [...selectedEventIds].filter((id) => !chapterEventIds.includes(id))
      clearSelection()
      if (others.length) selectEventRange(others)
    } else {
      selectEventRange(chapterEventIds)
    }
  }

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
    await deleteChapter(chapter.id)
  }

  return (
    <div className={cn(
      'rounded-lg border transition-colors group',
      isActive ? 'border-[hsl(var(--ring))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
    )}>
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Select-all checkbox — visible on hover or when any events in chapter are selected */}
        <div
          className={cn(
            'shrink-0 flex items-center justify-center cursor-pointer transition-opacity',
            someSelected || allSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          onClick={handleSelectAll}
        >
          <input
            type="checkbox"
            ref={(el) => { if (el) el.indeterminate = someSelected }}
            checked={allSelected}
            onChange={() => {}}
            className="h-3.5 w-3.5 cursor-pointer accent-[hsl(var(--ring))]"
          />
        </div>
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
          onClick={() => setActiveEventId(isActive ? null : (sortedEvents[0]?.id ?? null))}
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
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete chapter "${chapter.title}"?`}
          description="All events in this chapter will be permanently deleted."
          onConfirm={handleDelete}
        />
      </div>

      {/* Expanded events */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-4 pt-3 pb-2 flex flex-col">
          {sortedEvents.length === 0 ? (
            <EmptyState icon={Scroll} title="No events yet" className="py-3" />
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
                  chapterEventIds={chapterEventIds}
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
