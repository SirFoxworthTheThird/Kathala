import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { PanelLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useChapter, useChapters, useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useReadingMode } from '@/db/hooks/useReading'
import { chapterTimelines, isReadersBook } from '@/lib/readersBook'
import { activateEvent } from '@/components/timeline/TimelineControls'
import type { Chapter, WorldEvent } from '@/types'
import { Binder } from './Binder'
import { useMediaQuery, WIDE } from '@/lib/useMediaQuery'
import { ALL_TIMELINES, useTimelineScreen, type TimelineScreenContext } from './timelineScreenContext'

/**
 * The Timeline, as one screen.
 *
 * It used to be two: a list of chapters and scenes, and a chapter's own page,
 * which gained a second list — the binder — beside the writing. The same
 * chapters in two places, on two screens that looked nothing alike.
 *
 * So the binder is the frame, and the book is the page inside it: open at a
 * chapter or not, it is the same list, and a chapter is where it is open rather
 * than somewhere else to go. See `TimelineView`.
 *
 * On a narrow screen there is no room for a column, so the binder slides in
 * over the page when asked for (`BinderToggle`). Cards is a list and is its own
 * way round, but the Page and Read are one long document, and on a phone they
 * had no way to a chapter but scrolling a book's length.
 */
export default function TimelineScreen() {
  const { worldId, chapterId } = useParams<{ worldId: string; chapterId?: string }>()
  const navigate = useNavigate()
  const gate = useGate()
  const binderOpen = useAppStore((st) => st.binderOpen)
  const activeEventId = useAppStore((st) => st.activeEventId)
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)

  const timelines = useTimelines(worldId ?? null)
  const chapter = useChapter(chapterId ?? null)
  const [timelineTab, setTimelineTab] = useState<string | null>(null)
  /*
    The column is rendered only where it is shown, rather than being in the page
    and hidden. A hidden copy of the binder is invisible to a person and still
    found by everything else.
  */
  const wide = useMediaQuery(WIDE)
  const [binderSheet, setBinderSheet] = useState(false)
  const closeBinderSheet = useCallback(() => setBinderSheet(false), [])

  /*
    Visiting a chapter makes its timeline the whole book's tab, so coming back
    to the whole book shows the timeline you were just in. "All timelines" is
    left alone — somebody who chose to see everything merged still wants to.
  */
  useEffect(() => {
    if (chapter) setTimelineTab((tab) => (tab === ALL_TIMELINES ? tab : chapter.timelineId))
  }, [chapter?.timelineId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Which timeline the binder lists: the chapter's own; on the whole book, the
  // selected tab's; and for "All timelines", the first.
  const binderTimelineId = chapter?.timelineId
    ?? (timelineTab && timelineTab !== ALL_TIMELINES && timelines.some((t) => t.id === timelineTab)
      ? timelineTab
      : timelines[0]?.id ?? null)
  const binderTimeline = timelines.find((t) => t.id === binderTimelineId)
  /*
    A reader's book of several timelines is one book (see `readersBook.ts`), and
    the binder is its contents: every chapter, in number order, each marked
    with its timeline's colour. Nothing is added from here in reading mode, so
    the timeline new chapters would go to does not arise.
  */
  const oneBook = isReadersBook(useReadingMode(worldId ?? null), timelines.length)
  /*
    *All timelines* is the same book for a writer, and its binder lists the
    same chapters. Not to restructure, though: a chapter belongs to one
    timeline, and adding or moving one in a list of all of them would have to
    guess which — so here, as on that tab's own Add Chapter, it is done from
    the timeline's tab.
  */
  const merged = !oneBook && timelineTab === ALL_TIMELINES && timelines.length > 1
  const wholeBook = oneBook || merged
  const ownChapters = useChapters(wholeBook ? null : binderTimelineId)
  const worldChapters = useWorldChapters(wholeBook ? worldId ?? null : null)
  const chapters = useMemo(
    () => (wholeBook ? [...worldChapters].sort((a, b) => a.number - b.number) : ownChapters),
    [wholeBook, worldChapters, ownChapters],
  )
  const timelineOf = useMemo(
    () => (wholeBook ? chapterTimelines(chapters, timelines) : null),
    [wholeBook, timelines, chapters],
  )
  const worldEvents = useWorldEvents(worldId ?? null)
  const scenes = useMemo(() => {
    const here = new Set(chapters.map((c) => c.id))
    return worldEvents.filter((e) => here.has(e.chapterId))
  }, [worldEvents, chapters])

  /*
    Going to a scene moves the time cursor there, so Character States follows
    the scene being written. Never while reading, where the cursor is the
    reader's bookmark.

    It also has to move for a scene in another chapter: arriving at a chapter
    keeps a cursor already inside it and otherwise falls back to the first
    scene, so without this the binder would send you to a chapter's second
    scene and leave you at its first.

    Always a navigation, even within the chapter on screen — replacing the
    entry there, so the history is not a list of clicks — because the page reads
    which card to open from the navigation's state.
  */
  function goScene(scene: WorldEvent) {
    // Somewhere chosen is somewhere to be looking at, not at the list over it.
    setBinderSheet(false)
    if (!gate.active) activateEvent(scene.id, scene.locationMarkerId, setActiveEventId)
    navigate(`/worlds/${worldId}/manuscript/${scene.chapterId}`, {
      state: { reveal: scene.id },
      replace: scene.chapterId === chapterId,
    })
  }
  function goChapter(target: Chapter) {
    setBinderSheet(false)
    // Even to the chapter already open: the page scrolls to it on arrival, and
    // the writer who clicks it has usually scrolled away.
    navigate(`/worlds/${worldId}/manuscript/${target.id}`, { replace: target.id === chapterId })
  }
  function goBook() {
    setBinderSheet(false)
    if (chapterId) navigate(`/worlds/${worldId}/manuscript`)
  }

  const context: TimelineScreenContext = useMemo(
    () => ({ timelineTab, setTimelineTab, showBinderSheet: () => setBinderSheet(true) }),
    [timelineTab],
  )

  // No timeline, nothing to list: the whole book's own empty state says what to do.
  const binder = worldId && binderTimelineId ? (
    <Binder
      worldId={worldId}
      timelineId={binderTimelineId}
      timelineName={timelines.length > 1 && !wholeBook ? binderTimeline?.name : undefined}
      currentChapterId={chapterId ?? null}
      chapters={chapters}
      timelineOf={timelineOf}
      structureFixed={merged}
      scenes={scenes}
      activeEventId={activeEventId}
      onGoScene={goScene}
      onGoChapter={goChapter}
      onGoBook={goBook}
    />
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {binder && binderOpen && wide && (
        <div
          id="timeline-binder"
          className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-[hsl(var(--border))]"
        >
          {binder}
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Outlet context={context} />
        </Suspense>
      </div>
      {binder && !wide && (
        <Sheet open={binderSheet} onClose={closeBinderSheet} label="Binder" side="left" id="timeline-binder">
          <div className="flex shrink-0 items-center border-b border-[hsl(var(--border))] py-1 pl-4 pr-1">
            <span className="flex-1 text-sm font-medium text-[hsl(var(--muted-foreground))]">Chapters and scenes</span>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Close the binder" onClick={closeBinderSheet}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{binder}</div>
        </Sheet>
      )}
    </div>
  )
}

/**
 * The binder's own button, at the head of the page. On a wide screen it shows
 * and hides the column, and remembers; on a narrow one it slides the binder in
 * over the page.
 */
export function BinderToggle() {
  const binderOpen = useAppStore((st) => st.binderOpen)
  const setBinderOpen = useAppStore((st) => st.setBinderOpen)
  const wide = useMediaQuery(WIDE)
  const { showBinderSheet } = useTimelineScreen()
  if (!wide) {
    if (!showBinderSheet) return null
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11"
        aria-label="Binder"
        aria-haspopup="dialog"
        title="The chapters and scenes"
        onClick={showBinderSheet}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      aria-label="Binder"
      aria-expanded={binderOpen}
      aria-controls="timeline-binder"
      title={binderOpen ? 'Hide the chapters and scenes' : 'Show the chapters and scenes'}
      onClick={() => setBinderOpen(!binderOpen)}
    >
      <PanelLeft className="h-4 w-4" />
    </Button>
  )
}
