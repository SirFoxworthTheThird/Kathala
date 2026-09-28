import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { useGate } from '@/db/hooks/ReadingGateContext'
import { useChapter, useChapters, useTimelines, useWorldEvents } from '@/db/hooks/useTimeline'
import { activateEvent } from '@/components/timeline/TimelineControls'
import type { Chapter, WorldEvent } from '@/types'
import { Binder } from './Binder'
import { useMediaQuery, WIDE } from '@/lib/useMediaQuery'
import { ALL_TIMELINES, type TimelineScreenContext } from './timelineScreenContext'

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
 * On a narrow screen there is no room for a column, and no need of one: the
 * list the page is made of is its own way round.
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
    navigate(`/worlds/${worldId}/manuscript/${scene.chapterId}`, {
      state: { reveal: scene.id },
      replace: scene.chapterId === chapterId,
    })
  }
  function goChapter(target: Chapter) {
    // Even to the chapter already open: the page scrolls to it on arrival, and
    // the writer who clicks it has usually scrolled away.
    navigate(`/worlds/${worldId}/manuscript/${target.id}`, { replace: target.id === chapterId })
  }
  function goBook() {
    if (chapterId) navigate(`/worlds/${worldId}/manuscript`)
  }

  const context: TimelineScreenContext = useMemo(
    () => ({ timelineTab, setTimelineTab }),
    [timelineTab],
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
    </div>
  )
}

/**
 * The binder's own button, at the head of the page: it shows and hides the
 * column, and remembers. Only on a wide screen, where there is a column.
 */
export function BinderToggle() {
  const binderOpen = useAppStore((st) => st.binderOpen)
  const setBinderOpen = useAppStore((st) => st.setBinderOpen)
  const wide = useMediaQuery(WIDE)
  if (!wide) return null
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
