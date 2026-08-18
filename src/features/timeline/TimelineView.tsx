import { useState, useRef, useMemo } from 'react'
import { BlockingReason } from '@/components/BlockingReason'
import { useParams } from 'react-router-dom'
import { Plus, BookOpen, Layers, Sparkles, Link2, X, AlignLeft, Clock, History, ListOrdered, Filter } from 'lucide-react'
import { useTimelines, useChapters, useTimelineEvents, useWorldChapters, useWorldEvents, createTimeline, updateTimeline, deleteTimeline } from '@/db/hooks/useTimeline'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { buildCombinedSequence, type CombinedOrder, type CombinedRow } from '@/lib/combinedTimeline'
import { chaptersWithThread } from '@/lib/plotThreads'
import { threadStrip } from '@/lib/threadStrip'
import { describeChapterSpan } from '@/lib/chapterSpan'
import { useWorld } from '@/db/hooks/useWorlds'
import { useAppStore } from '@/store'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { ChapterRow } from './ChapterRow'
import { BulkActionToolbar } from './BulkActionToolbar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddChapterDialog } from './AddChapterDialog'
import { ChapterAIDialog } from './ChapterAIDialog'
import { PacingCurve } from './PacingCurve'
import { TimelineRelationshipPanel } from './TimelineRelationshipPanel'
import type { WorldEvent, Chapter, Timeline } from '@/types'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { plural } from '@/lib/plural'

// ── Chronological (in-world) order ──────────────────────────────────────────
// Events flattened across chapters and ordered by their effective in-world day,
// so flashbacks and out-of-order scenes surface where they actually happen.
function ChronologicalList({ events, chapters, timelines, activeEventId, onSelect }: {
  events: WorldEvent[]
  chapters: Chapter[]
  timelines: Timeline[]
  activeEventId: string | null
  onSelect: (id: string) => void
}) {
  const inWorldDays = computeInWorldDays(events, chapters, timelines)
  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const ordered = [...events].sort((a, b) => {
    const da = inWorldDays.get(a.id) ?? 0
    const db = inWorldDays.get(b.id) ?? 0
    if (da !== db) return da - db
    // Tiebreak on narrative order so same-day events read naturally.
    const ca = chapterById.get(a.chapterId)?.number ?? 0
    const cb = chapterById.get(b.chapterId)?.number ?? 0
    return ca !== cb ? ca - cb : a.sortOrder - b.sortOrder
  })

  if (events.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        No scenes yet — add scenes to chapters to place them on the in-world timeline.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {ordered.map((ev) => {
        const day = inWorldDays.get(ev.id) ?? 0
        const ch = chapterById.get(ev.chapterId)
        const isActive = ev.id === activeEventId
        const pinnedFlashback = ev.isFlashback && ev.inWorldTime == null
        return (
          <button
            key={ev.id}
            onClick={() => onSelect(ev.id)}
            className={cn(
              'flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
              isActive
                ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring)/0.4)]'
            )}
          >
            <div className="w-16 shrink-0 text-right">
              {pinnedFlashback ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">flashback</span>
              ) : (
                <span className="text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">Day {day}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{ev.title || 'Untitled scene'}</p>
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{ch ? `Ch. ${ch.number} — ${ch.title}` : ''}</p>
            </div>
            {ev.isFlashback && (
              <span title="Flashback / retrospective" className="shrink-0">
                <History className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── All timelines (combined in-world order) ──────────────────────────────────
// Every timeline's events merged into one chronological sequence, each row
// tagged with the timeline it belongs to, so the real order across storylines
// is visible in one place. Ordering is computed by buildCombinedSequence.
const ALL_TIMELINES = '__all__'

function CombinedList({ rows, activeEventId, onSelect }: {
  rows: CombinedRow[]
  activeEventId: string | null
  onSelect: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        No scenes yet — add scenes across your timelines to see them in one sequence.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {rows.map(({ event: ev, chapter: ch, timeline: tl, day, pinnedFlashback }) => {
        const isActive = ev.id === activeEventId
        return (
          <button
            key={ev.id}
            onClick={() => onSelect(ev.id)}
            className={cn(
              'flex items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors',
              isActive
                ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))]'
                : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--ring)/0.4)]'
            )}
          >
            <div className="w-16 shrink-0 text-right">
              {pinnedFlashback ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">flashback</span>
              ) : (
                <span className="text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">Day {day}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">{ev.title || 'Untitled scene'}</p>
              <p className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tl?.color }}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {tl?.name ?? 'Timeline'}{ch ? ` · Ch. ${ch.number} — ${ch.title}` : ''}
                </span>
              </p>
            </div>
            {ev.isFlashback && (
              <span title="Flashback / retrospective" className="shrink-0">
                <History className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function TimelineView() {
  const gate = useGate()
  const { worldId } = useParams<{ worldId: string }>()
  const timelines = useTimelines(worldId ?? null)
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null)
  // The combined "All timelines" scope only makes sense with 2+ timelines; if
  // the count drops to one (e.g. after a delete), fall back to that timeline.
  const isAll = activeTimelineId === ALL_TIMELINES && timelines.length > 1
  const currentTimelineId = isAll
    ? ALL_TIMELINES
    : (activeTimelineId && activeTimelineId !== ALL_TIMELINES ? activeTimelineId : timelines[0]?.id ?? null)
  const chapters = useChapters(isAll ? null : currentTimelineId)
  const timelineEvents = useTimelineEvents(isAll ? null : currentTimelineId)
  const worldChapters = useWorldChapters(isAll ? worldId ?? null : null)
  /**
   * The curve stops where the reader has got to.
   *
   * `useTimelineEvents` is deliberately ungated, and the curve used to draw all
   * of it: anonymous circles, but beat markers carrying scene titles in their
   * tooltips, and — once the curve gained an accessible data table — every
   * scene title in the book named outright. At chapter one of the bundled
   * Philosopher's Stone that meant "Quirrell and Voldemort" and "Gryffindor
   * Wins the House Cup" were readable by a screen reader.
   */
  const pacingEvents = useMemo(
    () => (gate.active ? timelineEvents.filter((e) => gate.hasReached(e.id)) : timelineEvents),
    [timelineEvents, gate],
  )
  const worldEvents = useWorldEvents(isAll ? worldId ?? null : null)
  // TL-4: resolved once here rather than per chapter row — see `ChapterRow`.
  const sceneTexts = useWorldSceneTexts(worldId ?? null)
  const wordsByEvent = useMemo(
    () => new Map(sceneTexts.map((t) => [t.eventId, t.wordCount ?? 0])),
    [sceneTexts],
  )
  const [viewMode, setViewMode] = useState<'narrative' | 'chronological'>('narrative')
  const threads = usePlotThreads(worldId ?? null)
  const [threadFilter, setThreadFilter] = useState<string | null>(null)
  const [threadsExpanded, setThreadsExpanded] = useState(false)
  const strip = threadStrip(threads, threadFilter, threadsExpanded)
  const setActiveEventId = useAppStore((s) => s.setActiveEventId)
  const activeEventId = useAppStore((s) => s.activeEventId)
  // The combined view's order is shared with the bottom bar's scope selector
  // (persisted), so choosing an order in either surface updates both.
  const barScope = useAppStore((s) => s.barScope)
  const setBarScope = useAppStore((s) => s.setBarScope)
  const combinedOrder: CombinedOrder = barScope === 'all-chrono' ? 'chrono' : 'chapter'
  const world = useWorld(worldId ?? null)
  const currentTimeline = timelines.find((t) => t.id === currentTimelineId)
  const combinedRows = isAll ? buildCombinedSequence(worldEvents, worldChapters, timelines, combinedOrder) : []
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
        description="Create a timeline to start tracking chapters and scenes."
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
        <div role="tablist" aria-label="Timelines" className="flex flex-wrap items-center gap-1 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1">
          {timelines.map((tl) => (
            <div
              key={tl.id}
              role="tab"
              aria-selected={currentTimelineId === tl.id}
              aria-controls="timeline-panel"
              className={`group flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                currentTimelineId === tl.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tl.color }}
                aria-hidden="true"
              />
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
          {/* Combined view across every timeline */}
          <button
            role="tab"
            aria-selected={isAll}
            aria-controls="timeline-panel"
            onClick={() => setActiveTimelineId(ALL_TIMELINES)}
            title="Merge every timeline into one in-world sequence"
            className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              isAll
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            }`}
          >
            <ListOrdered className="h-3 w-3 shrink-0" aria-hidden="true" />
            All timelines
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Layers className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          {isAll ? (
            <>
              <span className="text-sm font-medium">All timelines</span>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                ({plural(timelines.length, 'timeline')} · {plural(worldChapters.length, 'chapter')})
              </span>
              {/* Shared with the bottom bar's scope selector (persisted). */}
              <div className="ml-2 flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="Combined order">
                <button
                  onClick={() => setBarScope('all-chapter')}
                  aria-pressed={combinedOrder === 'chapter'}
                  className={cn('flex items-center gap-1 px-2 py-1 transition-colors',
                    combinedOrder === 'chapter' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
                  title="Reading order — chapter numbers across all timelines"
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Chapter order
                </button>
                <button
                  onClick={() => setBarScope('all-chrono')}
                  aria-pressed={combinedOrder === 'chrono'}
                  className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors',
                    combinedOrder === 'chrono' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
                  title="In-world order — scenes by when they actually happen"
                >
                  <Clock className="h-3.5 w-3.5" /> Chronological
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">
                {timelines.find((t) => t.id === currentTimelineId)?.name ?? 'Timeline'}
              </span>
              {/* MT-4: a timeline can hold any chapter numbering — the shipped
                  examples carry the book's own — so "10 chapters" could sit
                  above a first row of Ch. 12 and read as missing data. */}
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                ({describeChapterSpan(chapters.map((c) => c.number))})
              </span>
              <div className="ml-2 flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="Timeline order">
                <button
                  onClick={() => setViewMode('narrative')}
                  aria-pressed={viewMode === 'narrative'}
                  className={cn('flex items-center gap-1 px-2 py-1 transition-colors',
                    viewMode === 'narrative' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
                  title="Reading order — chapters as written"
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Narrative
                </button>
                <button
                  onClick={() => setViewMode('chronological')}
                  aria-pressed={viewMode === 'chronological'}
                  className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors',
                    viewMode === 'chronological' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
                  title="In-world order — scenes by when they actually happen"
                >
                  <Clock className="h-3.5 w-3.5" /> Chronological
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!gate.active && timelines.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setRelPanelOpen(true)}>
              <Link2 className="h-4 w-4" /> Link Timelines
            </Button>
          )}
          {!gate.active && (
            <>
              <Button size="sm" variant="outline" onClick={handleCreateTimeline}>
                <Layers className="h-4 w-4" /> New Timeline
              </Button>
              {/* X-9, and the least guessable instance of it: a chapter belongs
                  to one timeline, so both of these go dead on the merged view.
                  The message names the tab that put you there — `isAll` is this
                  view's own tab state, not the bottom bar's scope. */}
              {/* No "make a timeline first" branch: `timelines.length === 0`
                  returns the empty state above, so this header only ever renders
                  where there are tabs to pick from. */}
              <BlockingReason
                checks={[{
                  met: !!currentTimelineId && !isAll,
                  need: 'one timeline — pick a tab above, since a chapter belongs to a single timeline',
                }]}
              />
              <Button size="sm" variant="outline" onClick={() => setAiChapterOpen(true)} disabled={!currentTimelineId || isAll}>
                <Sparkles className="h-4 w-4" /> Generate with AI
              </Button>
              <Button size="sm" onClick={() => setAddChapterOpen(true)} disabled={!currentTimelineId || isAll}>
                <Plus className="h-4 w-4" /> Add Chapter
              </Button>
            </>
          )}
        </div>
      </div>

      <div id="timeline-panel" role="tabpanel" className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-auto p-4">
        {isAll ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {combinedOrder === 'chrono'
                ? 'Every timeline merged by in-world day (each timeline clocked from its own day 0).'
                : 'Every timeline merged in reading order, following chapter numbers across all timelines.'}
              {' '}Use the chapter number and coloured tag to see which storyline each scene belongs to.
            </p>
            <CombinedList rows={combinedRows} activeEventId={activeEventId} onSelect={setActiveEventId} />
          </div>
        ) : chapters.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No chapters yet"
            description="Add your first chapter to start tracking scenes and character states."
            action={
              <Button onClick={() => setAddChapterOpen(true)}>
                <Plus className="h-4 w-4" /> Add Chapter
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <PacingCurve
              worldId={worldId!}
              events={pacingEvents}
              chapters={chapters}
              order={viewMode}
              activeEventId={activeEventId}
              onSelect={setActiveEventId}
            />
            {viewMode === 'narrative' ? (
              <>
                {threads.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by plot thread">
                    <Filter className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
                    <button
                      onClick={() => setThreadFilter(null)}
                      aria-pressed={threadFilter === null}
                      className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                        threadFilter === null
                          ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}
                    >
                      All threads
                    </button>
                    {strip.shown.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setThreadFilter(threadFilter === t.id ? null : t.id)}
                        aria-pressed={threadFilter === t.id}
                        className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          threadFilter === t.id
                            ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                            : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                        {t.name}
                      </button>
                    ))}
                    {/* TL-5: the strip used to wrap without limit, so it grew a
                        row at a time as the writer added threads and took the
                        space from the chapters below. */}
                    {(strip.hidden > 0 || threadsExpanded) && (
                      <button
                        onClick={() => setThreadsExpanded((v) => !v)}
                        className="rounded-full px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))] underline-offset-2 hover:underline hover:text-[hsl(var(--foreground))]"
                      >
                        {threadsExpanded ? 'Show fewer' : `+${strip.hidden} more`}
                      </button>
                    )}
                  </div>
                )}
                {(() => {
                  const shown = chaptersWithThread(chapters, timelineEvents, threadFilter)
                  if (shown.length === 0) {
                    return (
                      <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        No chapters advance this thread yet — tag scenes with it on their scene cards.
                      </p>
                    )
                  }
                  return shown.map((ch) => (
                    <ChapterRow key={ch.id} chapter={ch} threadFilter={threadFilter} wordsByEvent={wordsByEvent} />
                  ))
                })()}
              </>
            ) : (
              <ChronologicalList
                events={timelineEvents}
                chapters={chapters}
                timelines={timelines}
                activeEventId={activeEventId}
                onSelect={setActiveEventId}
              />
            )}
          </div>
        )}
      </div>
      {!gate.active && currentTimelineId && !isAll && viewMode === 'narrative' && <BulkActionToolbar timelineId={currentTimelineId} />}
      </div>

      {worldId && currentTimelineId && !isAll && (
        <AddChapterDialog
          open={addChapterOpen}
          onOpenChange={setAddChapterOpen}
          worldId={worldId}
          timelineId={currentTimelineId}
          nextNumber={chapters.length + 1}
        />
      )}
      {worldId && currentTimelineId && !isAll && currentTimeline && (
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
        description="All chapters and scenes in this timeline will be permanently deleted."
        onConfirm={doDeleteTimeline}
      />
    </div>
  )
}
