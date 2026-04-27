import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, BookOpen, Layers, Sparkles, Link2, X } from 'lucide-react'
import { useTimelines, useChapters, createTimeline, updateTimeline, deleteTimeline } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { ChapterRow } from './ChapterRow'
import { BulkActionToolbar } from './BulkActionToolbar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddChapterDialog } from './AddChapterDialog'
import { ChapterAIDialog } from './ChapterAIDialog'
import { TimelineRelationshipPanel } from './TimelineRelationshipPanel'

export default function TimelineView() {
  const { worldId } = useParams<{ worldId: string }>()
  const timelines = useTimelines(worldId ?? null)
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null)
  const currentTimelineId = activeTimelineId ?? timelines[0]?.id ?? null
  const chapters = useChapters(currentTimelineId)
  const world = useWorld(worldId ?? null)
  const currentTimeline = timelines.find((t) => t.id === currentTimelineId)
  const [addChapterOpen, setAddChapterOpen] = useState(false)
  const [aiChapterOpen, setAiChapterOpen] = useState(false)
  const [relPanelOpen, setRelPanelOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  function startRename(id: string, currentName: string) {
    setRenamingId(id)
    setRenameValue(currentName)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await updateTimeline(renamingId, { name: renameValue.trim() })
    }
    setRenamingId(null)
  }

  async function doDeleteTimeline() {
    if (!deleteTarget) return
    const remaining = timelines.filter((t) => t.id !== deleteTarget.id)
    if (activeTimelineId === deleteTarget.id) setActiveTimelineId(remaining[0]?.id ?? null)
    await deleteTimeline(deleteTarget.id)
  }

  const TIMELINE_COLORS = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c']

  async function handleCreateTimeline() {
    if (!worldId) return
    const n = timelines.length
    const tl = await createTimeline({
      worldId,
      name: n === 0 ? 'Main Timeline' : `Timeline ${n + 1}`,
      description: '',
      color: TIMELINE_COLORS[n % TIMELINE_COLORS.length],
    })
    setActiveTimelineId(tl.id)
  }

  if (timelines.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No timeline yet"
        description="Create a timeline to start tracking chapters and events."
        action={
          <Button onClick={handleCreateTimeline}>
            <Plus className="h-4 w-4" /> Create Timeline
          </Button>
        }
        className="h-full"
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Timeline tabs */}
      {timelines.length > 1 && (
        <div role="tablist" aria-label="Timelines" className="flex items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1">
          {timelines.map((tl) => (
            <div
              key={tl.id}
              role="tab"
              aria-selected={currentTimelineId === tl.id}
              aria-controls="timeline-panel"
              className={`group flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                currentTimelineId === tl.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {renamingId === tl.id ? (
                <input
                  ref={renameInputRef}
                  className="w-28 rounded border border-[hsl(var(--ring))] bg-[hsl(var(--background))] px-1 py-px text-xs text-[hsl(var(--foreground))] outline-none"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <button
                  onClick={() => setActiveTimelineId(tl.id)}
                  onDoubleClick={() => startRename(tl.id, tl.name)}
                  title="Double-click to rename"
                >
                  {tl.name}
                </button>
              )}
              <button
                onClick={() => setDeleteTarget({ id: tl.id, name: tl.name })}
                aria-label={`Delete ${tl.name}`}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-[hsl(var(--muted-foreground))] hover:text-red-400"
                title="Delete timeline"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-medium">
            {timelines.find((t) => t.id === currentTimelineId)?.name ?? 'Timeline'}
          </span>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">({chapters.length} chapters)</span>
        </div>
        <div className="flex items-center gap-2">
          {timelines.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setRelPanelOpen(true)}>
              <Link2 className="h-4 w-4" /> Link Timelines
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleCreateTimeline}>
            <Layers className="h-4 w-4" /> New Timeline
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAiChapterOpen(true)} disabled={!currentTimelineId}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>
          <Button size="sm" onClick={() => setAddChapterOpen(true)} disabled={!currentTimelineId}>
            <Plus className="h-4 w-4" /> Add Chapter
          </Button>
        </div>
      </div>

      <div id="timeline-panel" role="tabpanel" className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto p-4">
        {chapters.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No chapters yet"
            description="Add your first chapter to start tracking events and character states."
            action={
              <Button onClick={() => setAddChapterOpen(true)}>
                <Plus className="h-4 w-4" /> Add Chapter
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {chapters.map((ch) => (
              <ChapterRow key={ch.id} chapter={ch} />
            ))}
          </div>
        )}
      </div>
      {currentTimelineId && <BulkActionToolbar timelineId={currentTimelineId} />}
      </div>

      {worldId && currentTimelineId && (
        <AddChapterDialog
          open={addChapterOpen}
          onOpenChange={setAddChapterOpen}
          worldId={worldId}
          timelineId={currentTimelineId}
          nextNumber={chapters.length + 1}
        />
      )}
      {worldId && currentTimelineId && currentTimeline && (
        <ChapterAIDialog
          open={aiChapterOpen}
          onOpenChange={setAiChapterOpen}
          worldId={worldId}
          worldName={world?.name ?? worldId}
          timelineId={currentTimelineId}
          timelineName={currentTimeline.name}
          nextNumber={chapters.length + 1}
          existingChapters={chapters}
        />
      )}
      {worldId && (
        <TimelineRelationshipPanel
          open={relPanelOpen}
          onOpenChange={setRelPanelOpen}
          worldId={worldId}
          timelines={timelines}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title={`Delete "${deleteTarget?.name ?? ''}"?`}
        description="All chapters and events in this timeline will be permanently deleted."
        onConfirm={doDeleteTimeline}
      />
    </div>
  )
}
