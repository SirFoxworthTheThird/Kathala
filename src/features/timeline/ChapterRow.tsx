import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, BookOpen, BookLock, Plus, ExternalLink, Scroll, Pencil, Check, X } from 'lucide-react'
import type { Chapter } from '@/types'
import { deleteChapter, useEvents, updateEvent, updateChapter, moveEventOnBoard } from '@/db/hooks/useTimeline'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Menu, MenuItem } from '@/components/ui/menu'
import { chapterProgress, describeProgress, describeStatus } from '@/lib/chapterProgress'
import { eventStatusConfig } from '@/lib/eventStatus'
import { EventRow } from './EventRow'
import { AddEventDialog } from './AddEventDialog'
import { EmptyState } from '@/components/EmptyState'

interface ChapterRowProps {
  chapter: Chapter
  /** When set, only events advancing this plot thread are shown, and the row
   *  starts expanded so the matching beats are visible without a manual click. */
  threadFilter?: string | null
  /**
   * Words per event, for the row's roll-up (TL-4). Resolved once by the parent
   * for the whole world: a chapter list is twenty-odd rows, and a live query per
   * row would be twenty-odd reads of the same table.
   */
  wordsByEvent?: Map<string, number>
  /**
   * The chapters either side of this one, so a scene at the edge of a chapter
   * can leave it (**F12**).
   *
   * Taken from the true chapter order rather than the thread-filtered view: a
   * filter changes what is on screen, not where a scene belongs.
   */
  prevChapterId?: string | null
  nextChapterId?: string | null
}

const NO_WORDS: Map<string, number> = new Map()

export function ChapterRow({
  chapter, threadFilter = null, wordsByEvent = NO_WORDS,
  prevChapterId = null, nextChapterId = null,
}: ChapterRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId, selectedEventIds, selectEventRange, clearSelection } = useAppStore()
  const [expanded, setExpanded] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  /** A chapter may not be blanked by accident, the same rule a scene title has. */
  async function commitRename() {
    const next = draftTitle.trim()
    if (!next) return
    if (next !== chapter.title) await updateChapter(chapter.id, { title: next })
    setRenaming(false)
  }
  const events = useEvents(chapter.id)

  // A chapter is reached once the cursor is at or past its number. Comparing
  // numbers rather than events means a chapter the reader has not opened yet
  // still keeps its summary back even if it has no events recorded.
  const gate = useGate()
  const synopsisHidden =
    gate.active && gate.chapterNumber !== null && chapter.number > gate.chapterNumber

  const allSorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder)
  const sortedEvents = threadFilter
    ? allSorted.filter((e) => (e.threadIds ?? []).includes(threadFilter))
    : allSorted
  const isActive = sortedEvents.some((e) => e.id === activeEventId)
  /*
    An unreached chapter does not open while reading.

    Its synopsis is withheld four lines above — and then expanding the row
    listed every scene in it by title: authored titles, not printed ones.
    Measured on *Philosopher's Stone* at chapter 4, expanding chapter 17 lists
    "Quirrell and Voldemort". The spoiler sweep could not see it because it
    visits `/timeline` with every row collapsed, which is the same blind spot
    `buttonNames` had under **WRUN-6**.

    `threadFilter` cannot force it open either: a filtered view is still a view.
  */
  const effectiveExpanded = !synopsisHidden && (expanded || !!threadFilter)
  // TL-4: the roll-up describes the chapter, so it counts every scene in it —
  // not the subset a thread filter happens to be showing.
  const progress = chapterProgress(allSorted, wordsByEvent)
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
    // Reorder against the true chapter order, not the thread-filtered view.
    const idx = allSorted.findIndex((e) => e.id === eventId)

    /*
      F12: at the edge of a chapter the arrow was permanently disabled, and the
      only way across a boundary was dragging a card on the Corkboard — which
      has no keyboard equivalent, and which nothing on the Timeline mentions.
      A scene at the top of a chapter now moves to the end of the one before,
      and one at the bottom to the start of the one after.

      `moveEventOnBoard` is the Corkboard's own mover, so the two routes cannot
      disagree: it re-points the chapter and timeline, renumbers the column, and
      recomputes the snapshot sortKeys on both sides. The index is clamped by
      `moveTo`, so a number past the end simply means "last".
    */
    if (direction === 'up' && idx === 0) {
      if (prevChapterId) await moveEventOnBoard(eventId, prevChapterId, Number.MAX_SAFE_INTEGER)
      return
    }
    if (direction === 'down' && idx === allSorted.length - 1) {
      if (nextChapterId) await moveEventOnBoard(eventId, nextChapterId, 0)
      return
    }
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const a = allSorted[idx]
    const b = allSorted[swapIdx]
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
      {/*
        Wraps below `sm`: at 390px the title, which is the only thing telling
        one row from another, was truncated to "Ch. 2 — The Vanish…" while
        "Set Active" and two icon buttons took roughly 40% of the row. Giving
        the title the full first line and letting the controls fall to a second
        spends vertical space, which a phone has more of. Unchanged from `sm` up.
      */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap">
        {/* Select-all checkbox — visible on hover or when any events in chapter are
            selected. It exists to feed the bulk toolbar (delete, tag, move), so
            reading mode has nothing to select for. */}
        {!gate.active && (
          <div
            className={cn(
              'shrink-0 flex items-center justify-center cursor-pointer transition-opacity',
              someSelected || allSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
            onClick={handleSelectAll}
          >
            {/*
              Named, but deliberately not `pointer-events-none` at rest the way
              the hover-revealed *deletes* are (HB-2a). Those had a destructive
              action behind an invisible target; this toggles a selection, which
              is visible and reversible, so there is nothing to protect against.

              It is *not* invisible on a phone, which HB-2b assumed and got
              wrong: `group-hover` indeed never fires there, but `index.css`
              forces every `opacity-0 + group-hover:opacity-*` control to
              `opacity: 1` on a hover-less pointer, so this one is permanently
              shown and permanently tappable. Gating it would break that.

              The touch problem is the size, not the visibility (HB-2c). The
              scene rows below take `pw-tap-row` for it; this one deliberately
              does not. Measured at 390px, the header wraps — the box sits at
              y 378–392 and the chapter title button starts at y 400 — so a
              symmetric 36px overlay would cover the button's top edge, and a
              tap meant to open the chapter would select every scene in it. A
              bigger target is not worth hitting the wrong control; the answer
              here is the wrapped header's layout.
            */}
            <input
              type="checkbox"
              aria-label={`Select every scene in chapter ${chapter.number}`}
              ref={(el) => { if (el) el.indeterminate = someSelected }}
              checked={allSelected}
              onChange={() => {}}
              className="h-3.5 w-3.5 cursor-pointer accent-[hsl(var(--ring))]"
            />
          </div>
        )}
        {/*
          No disclosure on a chapter that cannot open: a chevron that turns
          nothing is the visible-but-inert shape HB-2d was filed for.
        */}
        {/*
          W23-2: a chapter's title could not be changed anywhere in the app.
          `updateChapter` had exactly two call sites — `{ notes }` and
          `{ wordGoal }` — so `title` and `synopsis` were write-once at the Add
          Chapter dialog, while the first-run guide said *"All three can be
          renamed later"* and *"Rename any of the three whenever you like, from
          the Timeline screen"*, and `GUIDE.md` said it twice more. The rename
          those notes pointed at renames the **timeline**, and only renders when
          a world has more than one — which a novel does not.

          It goes in this row's menu because that is the screen the guide
          already names. Enter commits and Escape cancels, the pair `EventCard`
          uses for a scene; blur is not a third way in, so tabbing to the tick
          does not end the session behind you.
        */}
        {renaming ? (
          <div className="flex items-center gap-2 basis-full min-w-0 sm:basis-auto sm:flex-1">
            <span className="shrink-0 text-sm font-medium text-[hsl(var(--muted-foreground))]">Ch. {chapter.number} —</span>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void commitRename() }
                else if (e.key === 'Escape') { e.preventDefault(); setRenaming(false) }
              }}
              aria-label="Chapter title"
              className="h-7 flex-1 min-w-0 text-sm"
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-green-400"
              aria-label={`Save chapter ${chapter.number}`} title="Save"
              onClick={() => void commitRename()} disabled={!draftTitle.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              aria-label={`Stop renaming chapter ${chapter.number}`} title="Cancel"
              onClick={() => setRenaming(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
        <button
          onClick={synopsisHidden ? undefined : () => setExpanded((v) => !v)}
          aria-expanded={synopsisHidden ? undefined : effectiveExpanded}
          className="flex items-center gap-2 basis-full min-w-0 text-left sm:basis-auto sm:flex-1"
        >
          {synopsisHidden
            ? <BookLock className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
            : effectiveExpanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />}
          <BookOpen className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="truncate text-sm font-medium text-[hsl(var(--foreground))] lg:shrink-0">
            Ch. {chapter.number} — {chapter.title}
          </span>
          {/* The chapter's own title is on the book's contents page, so it
              stays. The synopsis is an authored summary of what happens in it,
              which is precisely what a reader who has not got there yet must
              not be shown. */}
          {chapter.synopsis && !synopsisHidden && (
            <span className="hidden lg:block text-xs text-[hsl(var(--muted-foreground))] truncate min-w-0">
              — {chapter.synopsis}
            </span>
          )}
        </button>
        )}

        {/*
          TL-4: the row used to carry the chapter's title and a truncated
          synopsis — prose the author already wrote — and nothing about the
          state of the work. The counts sit before the actions, ahead of
          `ml-auto`, so they read as part of the row rather than as a control.
        */}
        <span className="shrink-0 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
          {describeProgress(progress)}
        </span>
        {/* The status is a writing-process fact, so reading mode has no use for
            it. Hidden below `sm`, where the row already wraps to two lines and
            the counts are the more useful of the two signals. */}
        {progress.status !== null && !gate.active && (
          <span
            className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-block"
            style={{
              background: eventStatusConfig(progress.status).color,
              color: eventStatusConfig(progress.status).textColor,
            }}
            title={describeStatus(progress) ?? undefined}
          >
            {eventStatusConfig(progress.status).label}
          </span>
        )}

        {/*
          TL-2: the label used to read "Set Active", which names a state rather
          than what pressing it does. "Moment" is the app's own word for where
          the cursor sits — Previous moment, Next moment, pick a moment — so the
          row says where pressing it takes you.
        */}
        <Button
          size="sm"
          variant={isActive ? 'secondary' : 'ghost'}
          className="h-7 px-2 text-xs shrink-0 ml-auto"
          onClick={() => setActiveEventId(isActive ? null : (sortedEvents[0]?.id ?? null))}
          /*
            Named for the act the person is performing, which is not the same
            act in both modes. A writer moves a viewfinder; a reader records how
            far they have got, and *View from here* reads to them like a display
            option rather than a bookmark — the reader run measured this as the
            cheap way to set a position (2 taps against ~50 on the stepper) that
            nothing invites you to use.
          */
          title={gate.active
            ? (isActive
              ? 'This is where you have read up to'
              : 'Mark this as where you have read up to')
            : (isActive
              ? 'The time cursor is in this chapter — press to view all chapters again'
              : "Move the time cursor to this chapter's first moment")}
        >
          {gate.active
            ? (isActive ? 'Reading here' : 'Read to here')
            : (isActive ? 'Viewing' : 'View from here')}
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

        {/* TL-3: delete used to be a bare trash icon here, on all 22 rows,
            immediately beside open-detail. See `src/components/ui/menu.tsx`. */}
        <Menu label={`More actions for chapter ${chapter.number}`}>
          <MenuItem
            icon={Pencil}
            label="Rename chapter"
            onClick={() => { setDraftTitle(chapter.title); setRenaming(true) }}
          />
          <MenuItem
            icon={Trash2}
            label="Delete chapter"
            danger
            onClick={() => setConfirmOpen(true)}
          />
        </Menu>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete chapter "${chapter.title}"?`}
          description="All scenes in this chapter will be permanently deleted."
          onConfirm={handleDelete}
        />
      </div>

      {/* Expanded events */}
      {effectiveExpanded && (
        <div className="border-t border-[hsl(var(--border))] px-4 pt-3 pb-2 flex flex-col">
          {sortedEvents.length === 0 ? (
            <EmptyState icon={Scroll} title={threadFilter ? 'No scenes on this thread' : 'No scenes yet'} className="py-3" />
          ) : (
            <div className="flex flex-col">
              {sortedEvents.map((e, i) => (
                <EventRow
                  key={e.id}
                  event={e}
                  isFirst={i === 0 && !prevChapterId}
                  isLast={i === sortedEvents.length - 1 && !nextChapterId}
                  moveUpHint={i === 0 && prevChapterId ? 'Move to the end of the previous chapter' : undefined}
                  moveDownHint={i === sortedEvents.length - 1 && nextChapterId ? 'Move to the start of the next chapter' : undefined}
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
            <Plus className="h-3.5 w-3.5" /> Add Scene
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
