import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useChapter, useChapters, useTimelines, useWorldEvents } from '@/db/hooks/useTimeline'
import { activateEvent } from '@/components/timeline/TimelineControls'
import type { Chapter, WorldEvent } from '@/types'
import { Binder } from './Binder'
import { ALL_TIMELINES, useTimelineScreen, type TimelineScreenContext } from './timelineScreenContext'

/**
 * The Timeline, as one screen.
 *
 * It used to be two: a list of chapters and scenes, and a chapter's own page,
 * which gained a second list — the binder — beside the writing. The same
 * chapters in two places, on two screens that looked nothing alike.
 *
 * So the binder is the frame. It stays down the left while the right-hand side
 * shows either the **whole book** — the list, with its orders, filters and
 * bulk actions — or **one chapter**. Going between them swaps the right side
 * only, which is why the state that has to survive the swap lives here.
 *
 * On a narrow screen there is no room for a column: the whole book is its own
 * way round, and on a chapter the binder opens as a drawer instead.
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
  const [drawerOpen, setDrawerOpen] = useState(false)

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
  const chapters = useChapters(binderTimelineId)
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
    if (!gate.active) activateEvent(scene.id, scene.locationMarkerId, setActiveEventId)
    navigate(`/worlds/${worldId}/timeline/${scene.chapterId}`, {
      state: { reveal: scene.id },
      replace: scene.chapterId === chapterId,
    })
    setDrawerOpen(false)
  }
  function goChapter(target: Chapter) {
    if (target.id !== chapterId) navigate(`/worlds/${worldId}/timeline/${target.id}`)
    setDrawerOpen(false)
  }
  function goBook() {
    if (chapterId) navigate(`/worlds/${worldId}/timeline`)
    setDrawerOpen(false)
  }

  const openBinderDrawer = useCallback(() => setDrawerOpen(true), [])
  const context: TimelineScreenContext = useMemo(
    () => ({ timelineTab, setTimelineTab, openBinderDrawer }),
    [timelineTab, openBinderDrawer],
  )

  // No timeline, nothing to list: the whole book's own empty state says what to do.
  const binder = worldId && binderTimelineId ? (
    <Binder
      worldId={worldId}
      timelineId={binderTimelineId}
      timelineName={timelines.length > 1 ? binderTimeline?.name : undefined}
      currentChapterId={chapterId ?? null}
      chapters={chapters}
      scenes={scenes}
      activeEventId={activeEventId}
      onGoScene={goScene}
      onGoChapter={goChapter}
      onGoBook={goBook}
    />
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {binder && binderOpen && (
        <div
          id="timeline-binder"
          className="hidden border-[hsl(var(--border))] lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:border-r"
        >
          {binder}
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <Outlet context={context} />
        </Suspense>
      </div>
      {binder && (
        <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogContent className="flex max-h-[85dvh] flex-col p-0 lg:hidden">
            <DialogHeader className="mb-0 border-b border-[hsl(var(--border))] px-4 py-3">
              <DialogTitle>Chapters and scenes</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col">{binder}</div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/**
 * The binder's own button, in whichever page is on the right.
 *
 * Two buttons with one name, only one of them ever displayed. On a wide screen
 * it shows and hides the column, and remembers. On a narrow one there is no
 * column, and — on a chapter, where the binder is the only way round — it opens
 * the binder as a drawer instead. The whole book is its own way round, so there
 * it has no narrow-screen button at all.
 */
export function BinderToggle({ drawer = false }: { drawer?: boolean }) {
  const binderOpen = useAppStore((st) => st.binderOpen)
  const setBinderOpen = useAppStore((st) => st.setBinderOpen)
  const { openBinderDrawer } = useTimelineScreen()
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="hidden h-8 w-8 shrink-0 lg:inline-flex"
        aria-label="Binder"
        aria-expanded={binderOpen}
        aria-controls="timeline-binder"
        title={binderOpen ? 'Hide the chapters and scenes' : 'Show the chapters and scenes'}
        onClick={() => setBinderOpen(!binderOpen)}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
      {drawer && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 lg:hidden"
          aria-label="Binder"
          aria-haspopup="dialog"
          title="Chapters and scenes"
          onClick={openBinderDrawer}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}
    </>
  )
}
