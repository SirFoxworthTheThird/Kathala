import { useState } from 'react'
import { Trash2, FolderInput, Tag, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { useChapters } from '@/db/hooks/useTimeline'
import { bulkDeleteEvents, bulkMoveEvents, bulkAddTag } from '@/db/hooks/useTimeline'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface BulkActionToolbarProps {
  timelineId: string
}

export function BulkActionToolbar({ timelineId }: BulkActionToolbarProps) {
  const { selectedEventIds, clearSelection, setActiveEventId, activeEventId } = useAppStore()
  const chapters = useChapters(timelineId)
  const [moveOpen, setMoveOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const count = selectedEventIds.size
  if (count === 0) return null

  const ids = [...selectedEventIds]

  async function handleDelete() {
    if (activeEventId && selectedEventIds.has(activeEventId)) setActiveEventId(null)
    await bulkDeleteEvents(ids)
    clearSelection()
  }

  async function handleMove(targetChapterId: string) {
    await bulkMoveEvents(ids, targetChapterId)
    clearSelection()
    setMoveOpen(false)
  }

  async function handleAddTag() {
    if (!tagInput.trim()) return
    await bulkAddTag(ids, tagInput.trim())
    setTagInput('')
    setTagOpen(false)
    clearSelection()
  }

  return (
    <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 shadow-md">
      <span className="text-sm font-medium text-[hsl(var(--foreground))] shrink-0">
        {count} event{count > 1 ? 's' : ''} selected
      </span>

      <div className="flex items-center gap-1.5 flex-1">
        {/* Delete */}
        <Button size="sm" variant="destructive" className="gap-1.5 h-7 text-xs" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete ${count} event${count > 1 ? 's' : ''}?`}
          description="All selected events and their snapshots will be permanently deleted."
          onConfirm={handleDelete}
        />

        {/* Move to chapter */}
        <div className="relative">
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setMoveOpen((v) => !v); setTagOpen(false) }}>
            <FolderInput className="h-3.5 w-3.5" /> Move to chapter
          </Button>
          {moveOpen && (
            <div className="absolute bottom-full mb-1 left-0 z-20 min-w-[180px] rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] transition-colors"
                  onClick={() => handleMove(ch.id)}
                >
                  Ch. {ch.number} — {ch.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add tag */}
        <div className="relative flex items-center gap-1">
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => { setTagOpen((v) => !v); setMoveOpen(false) }}>
            <Tag className="h-3.5 w-3.5" /> Add tag
          </Button>
          {tagOpen && (
            <div className="absolute bottom-full mb-1 left-0 z-20 flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-2 shadow-lg">
              <input
                autoFocus
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setTagOpen(false) }}
                placeholder="tag name"
                className="h-6 w-32 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs outline-none focus:border-[hsl(var(--ring))]"
              />
              <Button size="sm" className="h-6 px-2 text-xs" onClick={handleAddTag}>Add</Button>
            </div>
          )}
        </div>
      </div>

      {/* Clear */}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 shrink-0" onClick={clearSelection}>
        <X className="h-3.5 w-3.5" /> Clear
      </Button>
    </div>
  )
}
