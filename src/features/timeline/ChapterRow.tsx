import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Trash2, BookOpen, BookLock, Plus, ExternalLink, Scroll, Pencil, Check, X } from 'lucide-react'
import type { Chapter, WorldCalendar, WorldEvent } from '@/types'
import { deleteChapter, useEvents, updateChapter, moveSceneStep, createEventAt } from '@/db/hooks/useTimeline'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Menu, MenuItem } from '@/components/ui/menu'
import { chapterProgress, describeProgress, describeStatus } from '@/lib/chapterProgress'
import { eventStatusConfig } from '@/lib/eventStatus'
import { EventCard } from './EventCard'
import { EmptyState } from '@/components/EmptyState'
import { useRevealAll } from '@/components/useRevealAll'
import { useReadAhead } from '@/components/useReadAhead'

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
  /**
   * The chapter the page is open at. It opens out, and the page scrolls it to
   * the top — it is still an ordinary row, so it can be folded again.
   */
  open?: boolean
  /** The binder's latest "go to this scene", for the card to open and come to. */
  reveal?: { id: string; nonce: number; caret?: 'start' | 'end' } | null
  /** Derived in-world day per scene, and the calendar that makes it a date. */
  inWorldDays?: Map<string, number>
  calendar?: WorldCalendar | null
  /** The next or previous scene in reading order, from a card's draft; see `TimelineView`. */
  onStepFrom?: (sceneId: string, dir: 'next' | 'previous') => boolean
  /** Go to a scene, opening its draft with the caret at its start or end. */
  onGoToScene?: (scene: WorldEvent, at: 'start' | 'end') => void
}

const NO_WORDS: Map<string, number> = new Map()

export function ChapterRow({
  chapter, threadFilter = null, wordsByEvent = NO_WORDS,
  prevChapterId = null, nextChapterId = null, open = false, reveal = null, inWorldDays, calendar = null,
  onStepFrom, onGoToScene,
}: ChapterRowProps) {
  const { worldId } = useParams<{ worldId: string }>()
  const { requestClear, revealAllDialog } = useRevealAll(worldId ?? null)
  const { guardJump, readAheadDialog } = useReadAhead()
  const navigate = useNavigate()
  const { activeEventId, setActiveEventId, selectedEventIds, selectEventRange, clearSelection } = useAppStore()
  const [expanded, setExpanded] = useState(open)
  /*
    The book is open at one chapter. Opening it opens its row; closing it —
    which opening another one does — folds the row back, cards and all, the way
    leaving a chapter's own screen used to put them away. Without the second
    half the book kept every chapter ever opened open, and "the first Add Scene
    on the page" stopped being the open chapter's. A row opened by hand, with
    its chevron, is the writer's own and is left as it is.
  */
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open) setExpanded(true)
    else if (wasOpen.current) setExpanded(false)
    wasOpen.current = open
  }, [open])
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

  /*
    F12: at the edge of a chapter the arrow used to be permanently disabled, and
    the only way across a boundary was dragging a card on the Corkboard. A scene
    at the top of a chapter now moves to the end of the one before, and one at
    the bottom to the start of the one after — `moveSceneStep`, the same mover
    as the binder's Alt+↑ ↓, so the two cannot disagree about what a step is.
    It reorders against the true chapter order, not a thread-filtered view.
  */
  async function moveEvent(eventId: string, direction: 'up' | 'down') {
    await moveSceneStep(eventId, direction)
  }

  async function handleDelete() {
    await deleteChapter(chapter.id)
  }

  /*
    Ctrl+Enter in a scene's draft: a new scene straight after it, titled on the
    line where it will sit — the binder's Enter, from where the writer actually
    is. Enter makes it and puts them in its draft; Escape hands them back to
    the scene they came from, caret where they left it.

    Not while reading, and not under a thread filter: a scene made there would
    carry no thread, so it would be made and then not be on the screen.
  */
  const [addingAfter, setAddingAfter] = useState<{ afterId: string; returnTo: HTMLElement | null } | null>(null)
  const canAddAfter = !gate.active && !threadFilter && !!onGoToScene
  const [addingAtEnd, setAddingAtEnd] = useState(false)
  /*
    A new scene at the end of the chapter. Made from the button or Enter, it
    opens and you are in its draft — which is what the scene was made for.
    Made by clicking somewhere else with a title typed, it is kept and left:
    that click was going somewhere.
  */
  async function commitAtEnd(title: string, byKey: boolean) {
    setAddingAtEnd(false)
    const created = await createEventAt(chapter.id, allSorted.length, title)
    if (created && byKey) onGoToScene?.(created, 'start')
  }

  async function commitNewAfter(afterId: string, title: string, byKey: boolean) {
    setAddingAfter(null)
    const index = allSorted.findIndex((e) => e.id === afterId) + 1
    const created = await createEventAt(chapter.id, index, title)
    // A title finished by clicking away was finished because the writer went
    // somewhere else; pulling them into the new scene would undo the click.
    if (created && byKey) onGoToScene?.(created, 'start')
  }

  return (
    <div
      id={`chapter-row-${chapter.id}`}
      aria-current={open ? 'page' : undefined}
      className={cn(
        'scroll-mt-3 rounded-lg border transition-colors group',
        isActive || open ? 'border-[hsl(var(--ring))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
      )}
    >
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
          className="flex flex-wrap items-center gap-x-2 basis-full min-w-0 text-left sm:basis-auto sm:flex-1"
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
            /*
              Below `lg` this was `hidden`, so *"Jonathan travels through
              Bistritz and the Borgo Pass to Castle Dracula"* — the answer to
              "what happened in chapter 3 again?", and the single most useful
              line on the screen — was simply not rendered on a phone. A blind
              reader run checked `body.innerText` at 390px and at 1280px and
              found it in one and not the other: available on the device you are
              not reading on.

              It wraps to its own line instead of being dropped. The row already
              wraps below `sm` (PH-3), so this is the space that argument freed,
              spent on the thing the row is about.
            */
            <span className="w-full shrink-0 pl-8 text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 lg:w-auto lg:shrink lg:pl-0 lg:truncate lg:min-w-0">
              <span className="hidden lg:inline">— </span>{chapter.synopsis}
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
          /*
            Both halves of this are guarded while reading, and neither was.

            Pressing it on the chapter you are *on* clears the cursor, and a
            null cursor is "all chapters" — the whole book, in one tap, on the
            control labelled as the reader's own bookmark. A blind reader run
            took Monte Cristo from 6 characters met to all 41 that way, with no
            dialog. The ✕ beside the cursor had already been fixed for exactly
            this (X-15) and the guide says Kathala asks; this was a second
            door that did not.

            Pressing it on a chapter far ahead jumps there, and there are 117 of
            these rows on the screen the dashboard's "Set where you have read
            to" points at — while the identical action on the bar below asks
            first. Same reveal, two answers, thirty rows apart.

            Both guards are hooks rather than rules to remember, so a third
            caller cannot quietly reintroduce either.
          */
          onClick={() => {
            if (isActive) { requestClear(); return }
            const target = sortedEvents[0]?.id ?? null
            if (!target) return
            guardJump(chapter.number, () => setActiveEventId(target))
          }}
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
          /*
            Named per row, and named at all: this was an icon whose only name
            was its `title`, repeated identically down 117 rows — so nothing on
            the screen could say *which* chapter it opened, and the ⋯ beside it
            had been numbered for exactly that reason.

            The chapter number is *appended* rather than substituted. An
            `aria-label` replaces a control's name outright, and naming this one
            "Open detail for chapter 1" silently took away the name four specs
            and the rest of the app looked it up by — a `getByRole` on the old
            wording matched nothing, and the suite reported it as four unrelated
            timeouts. Keeping the old words in the new name means the row is
            distinguishable and nothing that knew the control loses it.
          */
          aria-label={`Open chapter detail — Ch. ${chapter.number}`}
          title="Open chapter detail"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>

        {/* TL-3: delete used to be a bare trash icon here, on all 22 rows,
            immediately beside open-detail. See `src/components/ui/menu.tsx`. */}
        {/*
          Renaming and deleting a chapter are the author's, and this row gates
          six other things on `!gate.active` without gating the menu holding
          those two. A blind reader run renamed chapter 2 of Monte Cristo from
          the reading view and read the new title back out of IndexedDB, where it
          survived into later sessions — against the guide's promise of "no
          delete buttons on cards, rows or map layers".
        */}
        {!gate.active && (
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
        )}
        {/* Both guards' dialogs, rendered where the control that needs them is. */}
        {revealAllDialog}
        {readAheadDialog}
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
            <div className="flex flex-col gap-1.5">
              {sortedEvents.map((e, i) => (
                <Fragment key={e.id}>
                  <EventCard
                    event={e}
                    isFirst={i === 0 && !prevChapterId}
                    isLast={i === sortedEvents.length - 1 && !nextChapterId}
                    moveUpHint={i === 0 && prevChapterId ? 'Move to the end of the previous chapter' : undefined}
                    moveDownHint={i === sortedEvents.length - 1 && nextChapterId ? 'Move to the start of the next chapter' : undefined}
                    onMoveUp={() => moveEvent(e.id, 'up')}
                    onMoveDown={() => moveEvent(e.id, 'down')}
                    selection={{ chapterEventIds }}
                    chapterNumber={chapter.number}
                    // Not in the chapter the page is already open at, where it would
                    // go nowhere and cost a phone's scene title the room.
                    onOpenChapter={open ? undefined : () => navigate(`/worlds/${worldId}/timeline/${e.chapterId}`)}
                    revealNonce={reveal?.id === e.id ? reveal.nonce : undefined}
                    revealCaret={reveal?.id === e.id ? reveal.caret : undefined}
                    inWorldDay={inWorldDays?.get(e.id)}
                    calendar={calendar}
                    onStep={onStepFrom ? (dir) => onStepFrom(e.id, dir) : undefined}
                    onNewAfter={canAddAfter
                      ? () => setAddingAfter({ afterId: e.id, returnTo: document.activeElement as HTMLElement | null })
                      : undefined}
                  />
                  {addingAfter?.afterId === e.id && (
                    <NewSceneAfter
                      onCommit={(title, byKey) => { void commitNewAfter(e.id, title, byKey) }}
                      onCancel={(byKey) => {
                        const back = addingAfter.returnTo
                        setAddingAfter(null)
                        if (byKey) back?.focus()
                      }}
                    />
                  )}
                </Fragment>
              ))}
            </div>
          )}
          {/*
            The chapter screen guards the identical button and this one did not,
            so a reader could open the full author dialog — title, cast, POV,
            draft status — and write a scene into *Dracula*. A blind reader run
            did, and then could not remove it: the scene row *was* gated, so the row
            it had just created offered no delete. Turning reading mode off is
            the one thing the mode exists to make unnecessary.
          */}
          {/*
            A title, where the scene will sit, and nothing else. This was a
            dialog asking for the title, description, cast, place, point of
            view, tags and status of a scene not yet written — the only way in
            the app to make one that asked for more than a title. Everything
            else is set on the card, or by the line at the top of the draft,
            once there is a scene to set it on.
          */}
          {!gate.active && (addingAtEnd ? (
            <div className="mt-1">
              <NewSceneAfter
                withButton
                onCommit={(title, byKey) => { void commitAtEnd(title, byKey) }}
                onCancel={() => setAddingAtEnd(false)}
              />
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs self-start mt-1"
              onClick={() => setAddingAtEnd(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add Scene
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The title of a scene about to be made after another, typed where it will sit.
 *
 * Enter makes it; Escape, or leaving it empty, makes nothing. Clicking away
 * with a title typed keeps it rather than losing it — the same rules as the
 * binder's new-scene line.
 */
function NewSceneAfter({ onCommit, onCancel, withButton = false }: {
  onCommit: (title: string, byKey: boolean) => void
  onCancel: (byKey: boolean) => void
  /** A visible Add Scene and Cancel, where the line was opened with the mouse. */
  withButton?: boolean
}) {
  const [value, setValue] = useState('')
  // Enter commits and the field unmounts, which blurs it: without this the blur
  // would commit a second time.
  const done = useRef(false)
  function finish(commit: boolean, byKey: boolean) {
    if (done.current) return
    done.current = true
    if (commit && value.trim()) onCommit(value.trim(), byKey)
    else onCancel(byKey)
  }
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-dashed border-[hsl(var(--ring))] bg-[hsl(var(--card))] px-3 py-2"
      /*
        Leaving the line keeps a typed title; moving *within* it does not count
        as leaving. Watched on the whole line rather than the field, so Tab from
        the title to its own Add Scene button does not commit before the button
        can be pressed.
      */
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        finish(true, false)
      }}
    >
      <input
        autoFocus
        aria-label="Title for the new scene"
        placeholder="Scene title"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); finish(true, true) }
          else if (e.key === 'Escape') { e.preventDefault(); finish(false, true) }
        }}
        className="h-7 w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-[hsl(var(--muted-foreground))]"
      />
      {withButton && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => finish(true, true)}>
            <Plus className="h-3.5 w-3.5" /> Add Scene
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => finish(false, true)}>
            Cancel
          </Button>
        </div>
      )}
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Enter to make it and start writing · Escape to go back</p>
    </div>
  )
}
