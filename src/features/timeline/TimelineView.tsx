import { useState, useRef, useMemo, useEffect, useCallback, lazy, Suspense } from 'react'
import { BlockingReason } from '@/components/BlockingReason'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, BookOpen, Layers, Sparkles, Link2, X, AlignLeft, Clock, History, ListOrdered, Filter, LayoutList, FileText, BookOpenText, Replace, Download, MoreHorizontal } from 'lucide-react'
import { useTimelines, useChapter, useEvents, useWorldChapters, useWorldEvents, createTimeline, updateTimeline, deleteTimeline } from '@/db/hooks/useTimeline'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useWorldSceneTexts, useHasProse } from '@/db/hooks/useManuscript'
import { useReadingMode } from '@/db/hooks/useReading'
import { useBlobUrl } from '@/db/hooks/useBlobs'
import { useManuscriptBook, useBookScope, ManuscriptBook, ReaderRow, BookGoal, ExportManuscriptDialog, FindReplaceDialog } from '@/features/manuscript'
import { buildCombinedSequence, type CombinedOrder, type CombinedRow } from '@/lib/combinedTimeline'
import { chaptersWithThread } from '@/lib/plotThreads'
import { threadStrip } from '@/lib/threadStrip'
import { describeChapterSpan } from '@/lib/chapterSpan'
import { useWorld } from '@/db/hooks/useWorlds'
import { useAppStore, type TimelineLayout } from '@/store'
import { computeInWorldDays } from '@/lib/inWorldTime'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { EmptyState } from '@/components/EmptyState'
import { ChapterRow } from './ChapterRow'
import { ChapterPanel } from './ChapterPanel'
import { cursorForChapter } from '@/lib/chapterCursor'
import { useMediaQuery, WIDE } from '@/lib/useMediaQuery'
import { adjacentScene } from '@/lib/sceneStep'
import { activateEvent } from '@/components/timeline/TimelineControls'
import { BulkActionToolbar } from './BulkActionToolbar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddChapterDialog } from './AddChapterDialog'
import { BinderToggle } from './TimelineScreen'
import { ALL_TIMELINES, useTimelineScreen } from './timelineScreenContext'
import { nextChapterNumber } from '@/lib/chapterNumbering'
import { ChapterAIDialog } from './ChapterAIDialog'
import { PacingCurve } from './PacingCurve'
import { TimelineRelationshipPanel } from './TimelineRelationshipPanel'
import type { WorldEvent, Chapter, Timeline } from '@/types'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { plural } from '@/lib/plural'
import type { PagePlace, PageTarget } from './DraftBook'
import { chapterTimelines, isReadersBook } from '@/lib/readersBook'

/*
  Loaded when a writer first chooses Page, so the Cards view — every reader,
  and every writer who never opens it — does not pay for the editor.
*/
const DraftBook = lazy(() => import('./DraftBook'))

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
  const { worldId, chapterId } = useParams<{ worldId: string; chapterId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const wide = useMediaQuery(WIDE)
  const timelines = useTimelines(worldId ?? null)
  /*
    The tab lives in the Timeline screen's frame, not here: this page is swapped
    out for a chapter and back, and the tab — and the binder, which lists the
    same timeline — has to still be on the timeline you were in.
  */
  const { timelineTab: activeTimelineId, setTimelineTab: setActiveTimelineId } = useTimelineScreen()
  const readingMode = useReadingMode(worldId ?? null)
  // One book for a reader, tabs for a writer: see `readersBook.ts`.
  const oneBook = isReadersBook(readingMode, timelines.length)
  // The combined "All timelines" scope only makes sense with 2+ timelines; if
  // the count drops to one (e.g. after a delete), fall back to that timeline.
  const isAll = !oneBook && activeTimelineId === ALL_TIMELINES && timelines.length > 1
  /** The timeline on screen — or, for the reader's one book (`oneBook`), `ALL_TIMELINES`. */
  const currentTimelineId = isAll || oneBook
    ? ALL_TIMELINES
    : (activeTimelineId && activeTimelineId !== ALL_TIMELINES ? activeTimelineId : timelines[0]?.id ?? null)
  /** The one timeline being written, where there is one: what adding a chapter adds to. */
  const ownTimelineId = isAll || oneBook ? null : currentTimelineId
  const { chapters, events: timelineEvents } = useBookScope(worldId ?? null, isAll ? null : currentTimelineId)
  /** Each chapter's timeline, said beside it in the reader's one book. */
  const timelineOf = useMemo(
    () => (oneBook ? chapterTimelines(chapters, timelines) : null),
    [oneBook, timelines, chapters],
  )
  const worldChapters = useWorldChapters(worldId ?? null)
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
  const worldEvents = useWorldEvents(worldId ?? null)
  // TL-4: resolved once here rather than per chapter row — see `ChapterRow`.
  const sceneTexts = useWorldSceneTexts(worldId ?? null)
  const wordsByEvent = useMemo(
    () => new Map(sceneTexts.map((t) => [t.eventId, t.wordCount ?? 0])),
    [sceneTexts],
  )
  const [viewMode, setViewMode] = useState<'narrative' | 'chronological'>('narrative')
  /*
    Cards is the book as a list of scene cards; Page is the same book as one
    document to write in; Read is the same book set for reading. Only where the
    book has one order — a single timeline, in reading order. Page is the
    writer's alone; Read is also the reader's, the book they are reading.
  */
  // Remembered per world, so leaving the book and coming back lands on it again.
  const chosenLayout = useAppStore((st) => (worldId ? st.layoutByWorld[worldId] : undefined))
  const setTimelineLayout = useAppStore((st) => st.setTimelineLayout)
  const setLayout = (next: TimelineLayout) => { if (worldId) setTimelineLayout(worldId, next) }
  /*
    `?view=page|read|cards` asks for a layout on arrival: the dashboard's *Set
    where you have read to* asks for Cards, where the chapter rows are. Taken
    once and then dropped from the address, so the layout is the person's own
    from there and a later navigation does not reapply it.
  */
  const [params, setParams] = useSearchParams()
  const askedView = params.get('view')
  useEffect(() => {
    if (askedView !== 'page' && askedView !== 'read' && askedView !== 'cards') return
    if (worldId) setTimelineLayout(worldId, askedView)
    setParams((p) => { p.delete('view'); return p }, { replace: true })
  }, [askedView, setParams, worldId, setTimelineLayout])
  const worldHasProse = useHasProse(worldId ?? null)
  /*
    Until a layout is chosen: a reader is given the book to read, as the
    navigation's *Read* did while the book was its own screen; a writer is given
    the page to write on, since writing is what a writer opens a manuscript to
    do. Where there is no page to give — no chapters yet, *All timelines*,
    Chronological — the writer has Cards (`pageOffered`), as a reader's book
    with no prose has no Read to give (`readOffered`) and shows Cards.
  */
  const layout: TimelineLayout = chosenLayout ?? (readingMode ? 'read' : 'page')
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
  const inWorldDays = useMemo(
    () => computeInWorldDays(worldEvents, worldChapters, timelines),
    [worldEvents, worldChapters, timelines],
  )

  /*
    ── The open chapter ────────────────────────────────────────────────────────

    The chapter screen was a page of its own; it is this page now, open at a
    chapter. `/manuscript/:chapterId` opens that chapter's row in the list,
    scrolls it to the top, and puts the chapter's own panel — title, synopsis,
    Character States, notes — beside the list, or under the row where there is
    no room beside it. `/manuscript` is the same page with no chapter open.
  */
  const openChapter = useChapter(chapterId ?? null)
  const openEvents = useEvents(chapterId ?? null)
  const setCursor = useAppStore((st) => st.setActiveEventId)

  /**
   * Opening a chapter puts you in it.
   *
   * The time cursor moves to the chapter's first scene, so the Writer's Brief
   * and every other per-moment tool has something to answer about — unless it
   * is already inside the chapter, where it stays. Keyed on the chapter so it
   * fires once per arrival rather than fighting a cursor moved afterwards.
   *
   * Never while reading: there the cursor is the reader's own place in the
   * book, and moving it to wherever they opened would hand them a chapter they
   * had not reached.
   */
  const settledChapterRef = useRef<string | null>(null)
  useEffect(() => {
    if (!chapterId) { settledChapterRef.current = null; return }
    if (gate.active) return
    if (settledChapterRef.current === chapterId) return
    // The live query still holds the previous chapter's rows for a render after
    // the route changes; settling on those would mark this chapter done and
    // then find the old cursor among the old events, one chapter late.
    const mine = openEvents.filter((e) => e.chapterId === chapterId)
    if (mine.length === 0) return
    settledChapterRef.current = chapterId
    const target = cursorForChapter(mine, activeEventId)
    if (target) setCursor(target)
  }, [gate.active, chapterId, openEvents, activeEventId, setCursor])

  /*
    The binder's side of the page: going to a scene is a navigation carrying the
    scene to open (see `TimelineScreen`), so this only has to read it and hand
    it to the scene's card, which opens and comes to the top. A counter rather
    than the id alone, so going to the same scene twice still arrives.
  */
  const [reveal, setReveal] = useState<{ id: string; nonce: number; caret?: 'start' | 'end'; focus?: boolean } | null>(null)
  const revealCount = useRef(0)
  /*
    And going to a chapter scrolls its row to the top, once per arrival, as
    soon as the row exists — the list may still be loading. Not when a scene is
    being revealed: the card scrolls itself, and the row would undo it.
  */
  const pendingScroll = useRef<string | null>(null)
  /** The same arrivals, for the Page view: a scene to write in, or a chapter to scroll to. */
  const [pageTarget, setPageTarget] = useState<PageTarget | null>(null)
  useEffect(() => {
    const state = location.state as { reveal?: string; caret?: 'start' | 'end'; focus?: boolean; fromPage?: boolean } | null
    const want = state?.reveal
    revealCount.current += 1
    // The page's own caret moved the chapter (`followPage`): the writer is already there, and nothing is to be gone to.
    if (state?.fromPage) { setReveal(null); pendingScroll.current = null; return }
    if (want) {
      setReveal({ id: want, nonce: revealCount.current, caret: state?.caret, focus: state?.focus })
      setPageTarget({ id: want, nonce: revealCount.current, focus: true })
      pendingScroll.current = null
    } else {
      // Spent, so a card that remounts later — its chapter folded and opened
      // again — does not take it for a fresh request and jump.
      setReveal(null)
      setPageTarget(chapterId ? { id: chapterId, nonce: revealCount.current } : null)
      pendingScroll.current = chapterId ?? null
    }
  }, [location.key])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = pendingScroll.current
    if (!id) return
    const row = document.getElementById(`chapter-row-${id}`)
    if (!row) return
    pendingScroll.current = null
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  })

  const closeChapter = () => navigate(`/worlds/${worldId}/manuscript`)
  const oneOrder = !isAll && viewMode === 'narrative' && chapters.length > 0 && !!currentTimelineId
  // Never the reader's one book, which is no one timeline's to write in — even
  // in the moment before the gate has loaded and says so.
  const pageOffered = oneOrder && !gate.active && !oneBook
  /*
    A reader is offered the book only when there is a book: the router keeps
    them off /manuscript for a world with no prose, and the empty
    page's advice — write some — is not theirs to take. Waits for the answer
    rather than guessing it (see useHasProse).
  */
  const readOffered = oneOrder && (!gate.active || worldHasProse === true)
  const showPage = layout === 'page' && pageOffered
  const showRead = layout === 'read' && readOffered
  /*
    The book compiled for reading, for Read and for the author's tools on Page:
    export takes the compiled manuscript. Nothing is compiled on Cards — on a
    long book the compile is the one step that costs anything.
  */
  const book = useManuscriptBook(
    showPage || showRead ? worldId ?? null : null,
    showPage || showRead ? currentTimelineId : null,
  )
  const readScrollRef = useRef<HTMLDivElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const coverUrl = useBlobUrl(world?.coverImageId ?? null)

  /*
    Going to a scene from inside another, by key: the same arrival as the
    binder's — the scene's chapter opens and its card with it — and the caret
    goes into the prose, so the writer never leaves the keyboard. The time
    cursor follows, as it does from the binder, so the Character States are the
    new scene's; never while reading.
  */
  function goToScene(scene: WorldEvent, at: 'start' | 'end', opts: { focus?: boolean } = {}) {
    if (!gate.active) activateEvent(scene.id, scene.locationMarkerId, setCursor)
    navigate(`/worlds/${worldId}/manuscript/${scene.chapterId}`, {
      // `focus`: arrived from Focus mode, so the scene opens in it too.
      state: { reveal: scene.id, caret: at, focus: opts.focus },
      replace: scene.chapterId === chapterId,
    })
  }
  /**
   * The scene before or after one, in reading order within its own timeline,
   * and gone to if there is one. `useWorldEvents` is gated, so a reader steps
   * only through what they have reached.
   */
  function stepFrom(sceneId: string, dir: 'next' | 'previous', opts: { focus?: boolean } = {}): boolean {
    const here = worldEvents.find((e) => e.id === sceneId)
    if (!here) return false
    // In the reader's one book the next scene may be in the other timeline.
    const own = oneBook ? worldChapters : worldChapters.filter((c) => c.timelineId === here.timelineId)
    const target = adjacentScene(own, worldEvents, sceneId, dir)
    if (!target) return false
    goToScene(target, dir === 'next' ? 'start' : 'end', opts)
    return true
  }
  /*
    The Page's caret gone into another chapter or scene — by typing, a click,
    the arrows or the scene keys. Into another chapter: the chapter open around
    the page follows it, its panel beside the page, as going there from the
    binder would — in place, not onto the history, since moving through a book
    is not a trail of pages to go back through. Into another scene: the time
    cursor goes there, as the binder puts it there, so the top bar, the
    binder's row and everything that answers for a moment are the scene the
    writer is in.
  */
  function followPage(place: PagePlace) {
    const scene = place.sceneId ? worldEvents.find((e) => e.id === place.sceneId) : undefined
    if (!gate.active && scene && scene.id !== activeEventId) activateEvent(scene.id, scene.locationMarkerId, setCursor)
    if (place.chapterId !== chapterId) {
      navigate(`/worlds/${worldId}/manuscript/${place.chapterId}`, { replace: true, state: { fromPage: true } })
    }
  }
  const openWords = openEvents.reduce((n, e) => n + (wordsByEvent.get(e.id) ?? 0), 0)
  const chapterHere = openChapter && openChapter.worldId === worldId ? openChapter : null
  /*
    The scene being written leads the panel on the Page, where its card is not
    on screen to hold its status, cast and the rest. Not on Cards, where it is,
    nor on Read; and never in reading mode, where these are the author's.
  */
  const sceneDetails = showPage && !gate.active
  const panel = chapterHere
    ? <ChapterPanel key={chapterHere.id} chapter={chapterHere} onClose={closeChapter} words={openWords} sceneDetails={sceneDetails} />
    : null
  /** Under the row, where there is no room beside the list. */
  const panelInline = panel && !wide
    ? <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{panel}</div>
    : null

  /** The phone's header: *Book tools* folded open or not. */
  const [toolsOpen, setToolsOpen] = useState(false)
  /*
    The chapter whose sheet is open, on a phone. A chapter rather than a flag,
    so a sheet left open by one chapter is not found open by the next — the
    caret moves the chapter under a closed sheet all the time.
  */
  const [sheetFor, setSheetFor] = useState<string | null>(null)
  const closeSheet = useCallback(() => setSheetFor(null), [])
  /** On a phone, where the Page puts its Focus button: in the header's row. */
  const [focusSlot, setFocusSlot] = useState<HTMLElement | null>(null)
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

  /*
    ── The header, in pieces ───────────────────────────────────────────────────
    Laid out in one wrapping row where there is room, and on a phone as one row
    of what gets you to the book with the rest folded under *Book tools*.
  */
  const touch = 'pointer-coarse:min-h-11'
  const titleBlock = (
    <>
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
              className={cn('flex items-center gap-1 px-2 py-1 transition-colors', touch,
                combinedOrder === 'chapter' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
              title="Reading order — chapter numbers across all timelines"
            >
              <AlignLeft className="h-3.5 w-3.5" /> Chapter order
            </button>
            <button
              onClick={() => setBarScope('all-chrono')}
              aria-pressed={combinedOrder === 'chrono'}
              className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', touch,
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
            {oneBook ? 'Whole book' : timelines.find((t) => t.id === currentTimelineId)?.name ?? 'Timeline'}
          </span>
          {/* MT-4: a timeline can hold any chapter numbering — the shipped
              examples carry the book's own — so "10 chapters" could sit
              above a first row of Ch. 12 and read as missing data. */}
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            ({describeChapterSpan(chapters.map((c) => c.number))}{oneBook && ` · ${plural(timelines.length, 'timeline')}`})
          </span>
          <div className="ml-2 flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="Timeline order">
            <button
              onClick={() => setViewMode('narrative')}
              aria-pressed={viewMode === 'narrative'}
              className={cn('flex items-center gap-1 px-2 py-1 transition-colors', touch,
                viewMode === 'narrative' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
              title="Reading order — chapters as written"
            >
              <AlignLeft className="h-3.5 w-3.5" /> Narrative
            </button>
            <button
              onClick={() => setViewMode('chronological')}
              aria-pressed={viewMode === 'chronological'}
              className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', touch,
                viewMode === 'chronological' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
              title="In-world order — scenes by when they actually happen"
            >
              <Clock className="h-3.5 w-3.5" /> Chronological
            </button>
          </div>
        </>
      )}
    </>
  )
  // The icons go on a phone, where the row has the binder, the chapter and the tools beside it.
  const layoutGroup = !isAll && readOffered ? (
    <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="Layout">
      <button
        onClick={() => setLayout('cards')}
        aria-pressed={layout === 'cards'}
        className={cn('flex items-center gap-1 px-2 py-1 transition-colors', touch,
          layout === 'cards' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
        title="Each scene on its own card"
      >
        <LayoutList className="h-3.5 w-3.5 max-lg:hidden" aria-hidden="true" /> Cards
      </button>
      {pageOffered && (
        <button
          onClick={() => setLayout('page')}
          aria-pressed={layout === 'page'}
          className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', touch,
            layout === 'page' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          title="The whole book as one page to write in"
        >
          <FileText className="h-3.5 w-3.5 max-lg:hidden" aria-hidden="true" /> Page
        </button>
      )}
      <button
        onClick={() => setLayout('read')}
        aria-pressed={layout === 'read'}
        className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', touch,
          layout === 'read' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
        title="The book set for reading"
      >
        <BookOpenText className="h-3.5 w-3.5 max-lg:hidden" aria-hidden="true" /> Read
      </button>
    </div>
  ) : null
  /* The book's own tools, where the book is on screen as a book. */
  const bookSummary = !isAll && (showPage || showRead) && !gate.active && (
    <>
      {/* The Manuscript's own summary line, which came with it. */}
      <span className="text-xs text-[hsl(var(--muted-foreground))]">
        {book.manuscript.writtenScenes.toLocaleString()} of {book.manuscript.totalScenes.toLocaleString()} scenes written · {plural(book.manuscript.totalWords, 'word')}
      </span>
      <BookGoal worldId={worldId!} words={book.manuscript.totalWords} />
    </>
  )
  const bookTools = (
    <>
      {(showPage || showRead) && !gate.active && (
        <>
          <Button size="sm" variant="outline" className={touch} onClick={() => setFindOpen(true)} disabled={book.manuscript.writtenScenes === 0}>
            <Replace className="h-4 w-4" /> Find &amp; replace
          </Button>
          <Button size="sm" variant="outline" className={touch} onClick={() => setExportOpen(true)} disabled={book.manuscript.writtenScenes === 0}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </>
      )}
      {!gate.active && timelines.length >= 2 && (
        <Button size="sm" variant="outline" className={touch} onClick={() => setRelPanelOpen(true)}>
          <Link2 className="h-4 w-4" /> Link Timelines
        </Button>
      )}
      {!gate.active && (
        <>
          <Button size="sm" variant="outline" className={touch} onClick={handleCreateTimeline}>
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
              met: !!ownTimelineId,
              need: 'one timeline — pick a tab above, since a chapter belongs to a single timeline',
            }]}
          />
          <Button size="sm" variant="outline" className={touch} onClick={() => setAiChapterOpen(true)} disabled={!ownTimelineId}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>
          <Button size="sm" className={touch} onClick={() => setAddChapterOpen(true)} disabled={!ownTimelineId}>
            <Plus className="h-4 w-4" /> Add Chapter
          </Button>
        </>
      )}
    </>
  )
  /** On a phone, the open chapter's panel is a sheet over the Page or Read, opened from here. */
  const sheetable = !wide && (showPage || showRead) && !!chapterHere
  const chapterButton = sheetable && chapterHere ? (
    <Button
      variant="outline"
      size="sm"
      className="h-9 shrink-0 gap-1 px-2 pointer-coarse:h-11"
      aria-haspopup="dialog"
      title={`Ch. ${chapterHere.number} — ${chapterHere.title}: its synopsis, Character States and notes`}
      onClick={() => setSheetFor(chapterHere.id)}
    >
      <BookOpen className="h-4 w-4 max-[389px]:hidden" aria-hidden="true" /> Ch. {chapterHere.number}
    </Button>
  ) : null

  return (
    <div className="flex h-full flex-col">
      {/* Timeline tabs */}
      {timelines.length > 1 && !oneBook && (
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

      {wide ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <BinderToggle />
            {titleBlock}
            {layoutGroup}
            {bookSummary}
          </div>
          <div className="flex flex-wrap items-center gap-2">{bookTools}</div>
        </div>
      ) : (
        /*
          A phone: one row, the rest a tap away. Stacked as on a wide screen, the
          title, the two orders, the layouts, the count, the goal and six buttons
          started the Page's writing at y=329 of 664 — and with the keyboard up
          left 115px to write in. The layouts stay out, being how you get to
          the book at all; the rest is the book's tools, under one button.
        */
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="flex flex-wrap items-center gap-1 px-2 py-1">
            <BinderToggle />
            {layoutGroup}
            {chapterButton}
            {showPage && <span ref={setFocusSlot} className="contents" />}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-9 w-9 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11"
              aria-label="Book tools"
              aria-expanded={toolsOpen}
              aria-controls="timeline-tools"
              title={toolsOpen ? 'Hide the book’s tools' : 'The book’s order, word count, goal, export and more'}
              onClick={() => setToolsOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
          {toolsOpen && (
            <div id="timeline-tools" className="flex flex-col gap-2 border-t border-[hsl(var(--border))] px-4 py-2">
              <div className="flex flex-wrap items-center gap-2">{titleBlock}</div>
              {bookSummary && <div className="flex flex-wrap items-center gap-2">{bookSummary}</div>}
              <div className="flex flex-wrap items-center gap-2">{bookTools}</div>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
      <div id="timeline-panel" role="tabpanel" className="flex min-w-0 flex-1 flex-col">
      {showRead ? (
        <>
          {readingMode && book.manuscript.writtenScenes > 0 && (
            <div className="border-b border-[hsl(var(--border))] px-4 py-2">
              <ReaderRow book={book} scrollRef={readScrollRef} />
            </div>
          )}
          <ManuscriptBook
            worldId={worldId!}
            book={book}
            timelineOf={timelineOf}
            readingMode={readingMode}
            scrollRef={readScrollRef}
            target={pageTarget}
          />
        </>
      ) : showPage ? (
        <>
          {/*
            No row to put the open chapter's panel under, and it cannot lead the
            page: the caret opens chapters as it moves (\`followPage\`), and on a
            phone the first tap into the prose put the panel above it, pushing
            the line tapped three thousand pixels down. So there the panel is a
            sheet, opened from the header (\`chapterButton\`).
          */}
          <Suspense fallback={<p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">Opening the page…</p>}>
            <DraftBook worldId={worldId!} timelineId={currentTimelineId!} target={pageTarget} open={chapterId ?? null} onPlace={followPage} focusSlot={wide ? null : focusSlot} />
          </Suspense>
        </>
      ) : (
      <div className="flex-1 overflow-auto p-4">
        {/* Chronological and merged orders are not by chapter, so there is no
            row to put the panel under; it leads the list instead. */}
        {panelInline && (isAll || viewMode !== 'narrative') && <div className="mb-3">{panelInline}</div>}
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
            {/*
              An author's instrument, not a reader's. It plots dramatic tension
              from ratings the reader cannot see, cannot set, and did not ask
              for — and it is expensive where it can least be afforded: measured
              on a 390px phone, the pacing chart and the thread strip together
              pushed the first chapter row to y=436 of 844, so more than half
              the screen was analytics before any chapter appeared. A reader
              came for the chapters.
            */}
            {!gate.active && (
              <PacingCurve
                worldId={worldId!}
                events={pacingEvents}
                chapters={chapters}
                order={viewMode}
                activeEventId={activeEventId}
                onSelect={setActiveEventId}
              />
            )}
            {viewMode === 'narrative' ? (
              <>
                {/*
                  The thread strip is the same kind of thing, and it carries a
                  spoiler besides: the gate holds back a thread until its first
                  scene is read, but the *name* then arrives whole. A blind
                  reader run at chapter 7 of Dracula — where Lucy has sleepwalked
                  once — was shown a chip reading "Lucy's Illness and Undeath",
                  which is chapter 16. Filtering a timeline by subplot is a
                  plotting move; the name is the author's shorthand for an arc,
                  not a label the book has given the reader yet.
                */}
                {threads.length > 0 && !gate.active && (
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
                  /*
                    Neighbours come from the full chapter list, not `shown`: a
                    thread filter changes what is on screen, not where a scene
                    belongs, so an arrow at a chapter edge must move it to the
                    real next chapter even when that one is filtered out.
                  */
                  return shown.map((ch) => {
                    // Its own timeline's neighbours: a scene moves within its timeline.
                    const order = chapters.filter((c) => c.timelineId === ch.timelineId).sort((a, b) => a.number - b.number)
                    const at = order.findIndex((c) => c.id === ch.id)
                    const isOpen = ch.id === chapterId
                    return (
                      <div key={ch.id} className="flex flex-col gap-3">
                        <ChapterRow
                          chapter={ch}
                          threadFilter={threadFilter}
                          wordsByEvent={wordsByEvent}
                          prevChapterId={at > 0 ? order[at - 1].id : null}
                          nextChapterId={at >= 0 && at < order.length - 1 ? order[at + 1].id : null}
                          open={isOpen}
                          reveal={isOpen ? reveal : null}
                          inWorldDays={inWorldDays}
                          calendar={world?.calendar ?? null}
                          onStepFrom={stepFrom}
                          onGoToScene={goToScene}
                          timeline={timelineOf?.get(ch.id) ?? null}
                        />
                        {isOpen && panelInline}
                      </div>
                    )
                  })
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
      )}
      {!showPage && !showRead && !gate.active && ownTimelineId && viewMode === 'narrative' && <BulkActionToolbar timelineId={ownTimelineId} />}
      </div>
      {/* Rendered only where it is shown, like the binder: a hidden copy would
          still be the first match for everything that looks it up. */}
      {panel && wide && (
        <aside aria-label="The open chapter" data-follows-scene className="w-80 shrink-0 overflow-auto border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {panel}
        </aside>
      )}
      </div>

      {sheetable && chapterHere && (
        <Sheet open={sheetFor === chapterHere.id} onClose={closeSheet} label="The open chapter" side="bottom">
          <div data-follows-scene className="min-h-0 flex-1 overflow-y-auto">
          <ChapterPanel
            key={chapterHere.id}
            chapter={chapterHere}
            onClose={closeSheet}
            words={openWords}
            sceneDetails={sceneDetails}
            closeAs={{ label: 'Close', title: showPage ? 'Back to the page' : 'Back to the book' }}
          />
          </div>
        </Sheet>
      )}
      {worldId && ownTimelineId && (
        <AddChapterDialog
          open={addChapterOpen}
          onOpenChange={setAddChapterOpen}
          worldId={worldId}
          timelineId={ownTimelineId}
          chapters={chapters}
        />
      )}
      {worldId && ownTimelineId && currentTimeline && (
        <ChapterAIDialog
          open={aiChapterOpen}
          onOpenChange={setAiChapterOpen}
          worldId={worldId}
          worldName={world?.name ?? worldId}
          timelineId={ownTimelineId}
          timelineName={currentTimeline.name}
          nextNumber={nextChapterNumber(chapters)}
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
      {(showPage || showRead) && (
        <ExportManuscriptDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          manuscript={book.manuscript}
          title={world?.name ?? 'Manuscript'}
          timelineName={currentTimeline?.name}
          timelineCount={timelines.length}
          coverUrl={coverUrl}
        />
      )}
      {worldId && (showPage || showRead) && <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} worldId={worldId} />}
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
