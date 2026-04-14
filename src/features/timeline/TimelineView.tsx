import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, BookOpen, Layers, Sparkles, Link2 } from 'lucide-react'
import { useTimelines, useChapters, createTimeline } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { ChapterRow } from './ChapterRow'
import { BulkActionToolbar } from './BulkActionToolbar'
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

  async function handleCreateTimeline() {
    if (!worldId) return
    const tl = await createTimeline({
      worldId,
      name: 'Main Timeline',
      description: '',
      color: '#60a5fa',
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
        <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1">
          {timelines.map((tl) => (
            <button
              key={tl.id}
              onClick={() => setActiveTimelineId(tl.id)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                currentTimelineId === tl.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {tl.name}
            </button>
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
          <Button size="sm" variant="outline" onClick={() => setAiChapterOpen(true)} disabled={!currentTimelineId}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>
          <Button size="sm" onClick={() => setAddChapterOpen(true)} disabled={!currentTimelineId}>
            <Plus className="h-4 w-4" /> Add Chapter
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
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
    </div>
  )
}
