import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { FileText, Target } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { updateChapter } from '@/db/hooks/useTimeline'
import { useHasProse } from '@/db/hooks/useManuscript'
import { ReadingProgress } from './ReadingProgress'
import { ReadingTypeControls } from './ReadingTypeControls'
import { SceneXRay, XRAY_GUTTER } from './SceneXRay'
import { ReadingContents } from './ReadingContents'
import { typeStyle } from '@/lib/readingType'
import { useAppStore, useActiveEventId } from '@/store'
import { computeSortKeySync } from '@/lib/sortKey'
import { cursorForScene } from '@/lib/readingPosition'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/plural'
import { openingState } from '@/lib/manuscriptOpening'
import { asksBeforeJumping } from '@/lib/readingAhead'
import { spotFor, scrollFor, readSpot, spotStillApplies, type SceneExtent, type ReadingSpot, type SpotAt } from '@/lib/readingSpot'
import type { ManuscriptBookData } from './useManuscriptBook'

/** Editable per-chapter word goal with a progress bar; persists on blur/Enter. */
export function ChapterGoal({ chapterId, words, goal }: { chapterId: string; words: number; goal: number | null }) {
  const [value, setValue] = useState(goal != null ? String(goal) : '')
  useEffect(() => { setValue(goal != null ? String(goal) : '') }, [goal])

  function commit() {
    const n = Math.max(0, Math.round(Number(value)) || 0)
    const next = n > 0 ? n : null
    if (next !== goal) updateChapter(chapterId, { wordGoal: next })
  }
  const pct = goal && goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Target className="h-3.5 w-3.5" />
        <span>Goal</span>
        <input
          type="number"
          min={0}
          step={500}
          value={value}
          placeholder="none"
          aria-label="Word goal for this chapter"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="h-7 w-20 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs tabular-nums text-[hsl(var(--foreground))]"
        />
      </label>
      {goal != null && goal > 0 && (
        <div className="flex min-w-[100px] flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div className="h-full rounded-full bg-[hsl(var(--ring))] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{pct}%</span>
        </div>
      )}
    </div>
  )
}

/** Where a world's reading spot is kept. Per world: books are read in parallel. */
const spotKey = (worldId: string | undefined) => `kathala-reading-spot-${worldId ?? ''}`

const readStored = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}

/** Every scene's box, measured once — `offsetTop` forces layout. */
function measureScenes(root: HTMLElement): SceneExtent[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-scene-event-id]')).map((el) => ({
    id: el.dataset.sceneEventId ?? '',
    top: el.offsetTop,
    height: el.offsetHeight,
  }))
}

/**
 * The book set for reading — the Timeline's Read layout: every written scene's
 * prose, chapter by chapter, in the reader's type. An author also sees each
 * chapter's words and scenes. In a world in reading mode it is the reader's
 * place in the book too — it follows their eye, remembers where they were, and
 * says so when a scroll skips chapters. Writing the book is Page's
 * (`DraftBook`); this is never edited in place.
 */
export function ManuscriptBook({ worldId, timelineId, book, readingMode, scrollRef, target = null }: {
  worldId: string
  timelineId: string | null
  book: ManuscriptBookData
  readingMode: boolean
  /** Owned by the screen, which puts the reader's row (progress, contents) above the book. */
  scrollRef: RefObject<HTMLDivElement | null>
  /** A chapter or scene to bring to the top — the Timeline's binder. The counter makes a repeat arrive. */
  target?: { id: string; nonce: number } | null
}) {
  const { manuscript, proseByScene, eventById, chapterNumberById } = book
  const activeEventId = useActiveEventId()

  /*
    Reading moves the reader's place in the book.

    Reading mode's whole premise is that the story bible is read relative to how
    far the reader has got, and until the book itself was here they had to keep
    telling it — pick a scene from the time cursor, then go and read somewhere
    else. With the prose on screen the position is simply *known*, so the gate
    can follow the reader's eye instead of their bookkeeping.

    `cursorForScene` holds the two rules that keep this from taking anything
    away — never move a null cursor, never go backwards. They live in
    `src/lib/readingPosition.ts` where they can be tested; what is here is only
    the business of noticing which scene is on screen, which needs a browser and
    is covered by `e2e/readingFollows.spec.ts`.

    The scene counts as reached when its top passes the upper quarter of the
    view, not when it first peeks in from the bottom: a scene visible at the
    edge has not been read, and revealing its contents early is the exact
    spoiler this mode exists to prevent.
  */
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)
  const pushToast = useAppStore((st) => st.pushToast)
  const cursorKey = useMemo(() => {
    if (!activeEventId) return null
    return computeSortKeySync(activeEventId, eventById, chapterNumberById)
  }, [activeEventId, eventById, chapterNumberById])

  /*
    Open the book where the reader left it.

    The cursor survives leaving the screen and closing the tab — it is stored
    per world — but the prose does not: the page came back scrolled to the top,
    so a reader 400 pages into *The Count of Monte Cristo* was returned to
    chapter one and had to find their place by hand. The gate was right and the
    book was wrong, which is the half nobody notices in a test that only checks
    what is revealed.

    Once per visit, not on every cursor change: the scene is scrolled to on
    arrival and the reader is then left alone, or reading on would yank the page
    back with every scene they reached. The observer below cannot fight it
    either — it sees the scene just scrolled to, and `cursorForScene` answers
    "stay" for the scene the cursor is already on.
  */
  const restoredRef = useRef(false)
  useEffect(() => { restoredRef.current = false }, [worldId])
  useEffect(() => {
    if (!readingMode || restoredRef.current) return
    // Not until the prose itself is in the DOM. The chapters arrive before the
    // scene texts do, and scrolling against a page that is still two hundred
    // words long lands nowhere near the right place — then the flag says it is
    // done and the reader is left at the top. A reload did exactly that.
    if (manuscript.writtenScenes === 0) return
    const root = scrollRef.current
    if (!root) return

    /*
      The exact spot first, the cursor second.

      Tapping a name in the scene panel leaves this screen and comes back to it,
      and the cursor alone answered that badly twice: it is a high-water mark,
      so a reader who had scrolled back to chapter two returned to chapter
      forty, and it names a scene rather than a place inside one, so a long
      scene restarted from its first line. See `readingSpot.ts`.
    */
    const saved = readSpot(readStored(spotKey(worldId)))
    if (spotStillApplies(saved, activeEventId)) {
      const to = scrollFor(saved, measureScenes(root))
      if (to !== null) {
        restoredRef.current = true
        requestAnimationFrame(() => { root.scrollTop = to })
        return
      }
    }

    if (!activeEventId) return
    const target = root.querySelector<HTMLElement>(`[data-scene-event-id="${CSS.escape(activeEventId)}"]`)
    if (!target) return
    restoredRef.current = true
    // After layout, and instant rather than smooth: this is where the book
    // already was, not a movement the reader made.
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }, [readingMode, activeEventId, manuscript, worldId, scrollRef])

  /*
    Remember the spot while the reader moves, and write it on the way out.

    The first version measured at teardown instead, and that is worthless: by
    the time the cleanup runs the scroller is detached, so `scrollTop` reads 0
    and every `offsetTop` reads 0 with it. `spotFor` then sees every scene
    beginning at the same place and answers with the last one — a reader who
    tapped a name in chapter 2 came back a million pixels down, at the end of
    the book. The saved spot said scene 149, offset 0.

    So the spot is kept current in a ref and the cleanup only writes what is
    already there. Scene extents are cached like `ReadingProgress` caches its
    chapters, because reading `offsetTop` for 149 scenes on every scroll frame
    is the jank this screen cannot afford; only `scrollTop` is read while
    scrolling, which is free.
  */
  /*
    Put the reader back where the scroll took them from.

    The scroll happens first and the cursor second, which is not fussiness: the
    reader is still scrolled to chapter 11 when they press Undo, so restoring
    the cursor alone would leave the observer looking at a later scene and it
    would advance again immediately — undoing the undo. Scrolling first means
    the only scene in view when the cursor moves is the one being restored.

    Instant rather than smooth, so the scenes in between are never observed on
    the way past. This is a correction, not a journey.
  */
  const undoDrift = useCallback((backTo: string) => {
    const root = scrollRef.current
    const target = root?.querySelector<HTMLElement>(`[data-scene-event-id="${CSS.escape(backTo)}"]`)
    target?.scrollIntoView({ block: 'start', behavior: 'auto' })
    requestAnimationFrame(() => setActiveEventId(backTo))
  }, [setActiveEventId, scrollRef])

  const spotRef = useRef<SpotAt | null>(null)
  useEffect(() => {
    if (!readingMode) return
    const root = scrollRef.current
    if (!root) return

    let extents: SceneExtent[] = []
    const measure = () => { extents = measureScenes(root) }

    let frame = 0
    const read = () => {
      frame = 0
      if (extents.length === 0) measure()
      spotRef.current = spotFor(root.scrollTop, extents)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }

    /*
      The cursor is stamped here, on the way out, not alongside `scrollTop`: it
      follows the page by an observer that fires after the scroll, so a stamp
      taken while scrolling is a scene stale, and every ordinary scroll then
      looked like a deliberate jump and threw the spot away.

      Read straight from the store rather than through a ref kept in step by an
      effect. That ref could be one commit behind when the cleanup ran — the
      cursor and the navigation landing in the same commit — and the stamp was
      then wrong, `spotStillApplies` said no, and the reader was dropped at the
      top of the book. Intermittently, which is how it showed up: one run red,
      the retry green.
    */
    const write = () => {
      const spot = spotRef.current
      if (!spot) return
      const stamped: ReadingSpot = { ...spot, cursorAt: useAppStore.getState().activeEventId }
      try { localStorage.setItem(spotKey(worldId), JSON.stringify(stamped)) } catch { /* private window */ }
    }

    const first = requestAnimationFrame(() => { measure(); read() })
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('pagehide', write)
    return () => {
      cancelAnimationFrame(first)
      if (frame) cancelAnimationFrame(frame)
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pagehide', write)
      write()
    }
  }, [readingMode, worldId, manuscript, scrollRef])

  useEffect(() => {
    if (!readingMode) return
    const root = scrollRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-scene-event-id]'))
    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        let furthest: { id: string; sortKey: number } | null = null
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.getAttribute('data-scene-event-id')
          if (!id) continue
          const sortKey = computeSortKeySync(id, eventById, chapterNumberById)
          if (sortKey < 0) continue
          if (!furthest || sortKey > furthest.sortKey) furthest = { id, sortKey }
        }
        if (!furthest) return
        const next = cursorForScene({ cursor: cursorKey, scene: furthest })
        if (!next) return

        /*
          A scroll that skips chapters says so, and offers the way back.

          Reading on moves your place a scene at a time and must never be
          interrupted, so this cannot be the confirm the chapter rows use — a
          modal in front of someone mid-sentence is worse than the fault. But a
          drag of the scrollbar, or a fling long enough that the scenes between
          never intersect, moved a reader from chapter 7 to chapter 11 in one
          step, silently, and scrolling back did not bring it back: the cursor
          is a high-water mark by design.

          `asksBeforeJumping` decides what counts as a skip, so the Timeline and
          this agree about it — two or more chapters forward, never backwards.
          What differs is the remedy, and deliberately: its comment argues
          against undo, on the grounds that not having seen a thing cannot be
          restored. That is right for a move the reader *chose*, where there is
          a moment to ask them beforehand. There is no such moment here, and for
          a move that merely happened to them an undo is the only remedy that
          does not interrupt the thing they are doing.
        */
        const before = useAppStore.getState().activeEventId
        const chapterOf = (id: string | null) =>
          id ? chapterNumberById.get(eventById.get(id)?.chapterId ?? '') ?? null : null
        const from = chapterOf(before)
        const to = chapterOf(next)
        if (before && from !== null && to !== null && asksBeforeJumping(from, to)) {
          pushToast({
            id: 'reading-drift',
            message: `Moved on to chapter ${to}`,
            actionLabel: 'Undo',
            onAction: () => undoDrift(before),
          })
        }
        setActiveEventId(next)
      },
      { root, rootMargin: '-25% 0px -60% 0px', threshold: 0 },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [readingMode, manuscript, eventById, chapterNumberById, cursorKey, setActiveEventId, pushToast, undoDrift, scrollRef])
  const hasProse = manuscript.writtenScenes > 0
  /*
    Two different questions. `hasProse` is "has the manuscript been compiled",
    which is false while the prose is still coming out of IndexedDB;
    `worldHasProse` asks the database directly.

    The gap between them is short but real, and on a long book it is long
    enough to render the empty state — telling a reader their book has no text
    at the one moment it has the most. It was measured at one worker, found to
    commit in a single pass, and written off as unreachable; under four workers
    `readingOpening.spec.ts` recorded the sequence waiting -> no-prose-yet ->
    prose on The Count of Monte Cristo. A branch is not unreachable because one
    run did not reach it.
  */
  const readingType = useAppStore((st) => st.readingType)
  const worldHasProse = useHasProse(worldId ?? null)
  /*
    See `openingState`. This required `worldHasProse === true`, so every moment
    the live query had not answered — before its first result, and again
    whenever it re-subscribed — fell through to the empty state and told a
    reader their book had no text. The rule is now that "no prose yet" needs a
    definite no.
  */
  const opening = openingState({ compiled: hasProse, worldHasProse })
  const openingTheBook = opening === 'opening'

  /*
    Going to a chapter or a scene, once it is on the page. Instant, like the
    restore above: a reader's place moves by what they read, and a smooth
    scroll past the chapters in between would read them on the way.
  */
  const arrivedFor = useRef<number | null>(null)
  useEffect(() => {
    const root = scrollRef.current
    if (!target || !root || arrivedFor.current === target.nonce) return
    const at = root.querySelector<HTMLElement>(
      `[data-scene-event-id="${CSS.escape(target.id)}"], [data-chapter-id="${CSS.escape(target.id)}"]`,
    )
    if (!at) return
    arrivedFor.current = target.nonce
    at.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [target, manuscript, scrollRef])

  /*
    The page, and floating over it, who is in it.

    `relative` because the panel is positioned against this box: a sibling of
    the scroller rather than inside it, so it stays put while the prose moves
    under it, and taken out of the flow so that showing it cannot move the
    prose sideways.
  */
  return (
      <div className="relative flex min-h-0 flex-1">
      <div
        ref={scrollRef}
        data-book-scroller
        className={cn('flex-1 overflow-auto', hasProse && XRAY_GUTTER)}
      >
        {openingTheBook ? (
          /*
            A shape the prose is about to fill, rather than a spinner: the page
            keeps the measure it is going to use, so the first paragraph does
            not arrive into a jump.
          */
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" aria-live="polite" aria-busy="true">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Opening the book…</p>
            <div className="mt-6 space-y-3" aria-hidden="true">
              {[97, 93, 99, 88, 96, 72, 95, 98, 90, 99, 86, 61].map((w, i) => (
                <div key={i} className="h-3 rounded bg-[hsl(var(--muted))] opacity-60" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ) : !hasProse ? (
          /*
            MS-4 asked for a second version of this sentence, for a reader on a
            Library world who cannot write the prose it tells them to write.

            That reader still never gets here, but no longer for the reason
            first written down. Reading mode used to close this route outright;
            it now opens it for a world that *has* prose, so the redirect turns
            on the prose rather than on the mode (`READABLE_WITH_PROSE` in the
            router). A world with none sends a reader to the dashboard exactly
            as before, and a world with some never reaches this branch, because
            this branch is the no-prose case.

            So the sentence still only reaches someone who can act on it, and
            the second version is still unreachable code — which is what the
            Items section in EventCard turned out to be under X-4.
          */
          <EmptyState
            icon={FileText}
            title="No prose yet"
            description="Write prose on your scenes, and it stitches together here into one continuous manuscript you can read and export."
            className="h-full"
          />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            {manuscript.chapters.map((ch) => {
              const scenes = ch.scenes.filter((s) => s.written)
              if (scenes.length === 0) return null
              return (
                <section
                  key={ch.id}
                  className="mb-12"
                  data-chapter-number={ch.number}
                  data-chapter-id={ch.id}
                  data-chapter-words={ch.wordCount}
                >
                  <div className="mb-4 border-b border-[hsl(var(--border))] pb-2">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      Ch. {ch.number} — {ch.title || 'Untitled'}
                    </h2>
                    {!readingMode && (
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {plural(ch.wordCount, 'word')} · {ch.writtenScenes}/{ch.scenes.length} scenes
                      </p>
                    )}
                  </div>

                  {scenes.map((s, i) => (
                    <div key={s.eventId} data-scene-event-id={s.eventId}>
                      {i > 0 && (
                        <div className="my-6 text-center text-sm text-[hsl(var(--muted-foreground))]" aria-hidden="true">* * *</div>
                      )}
                      {/* The reader's type — the writing surface, Page, keeps its own. */}
                      <div className="text-[hsl(var(--foreground))]" style={typeStyle(readingType)}>
                        {(proseByScene.get(s.eventId) ?? []).map((spans, j) => (
                          <p key={j} className="mb-4 [text-indent:1.5rem] first:[text-indent:0]">
                            {spans.map((sp, k) => (sp.em ? <em key={k}>{sp.text}</em> : sp.text))}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              )
            })}
          </div>
        )}
      </div>
      {hasProse && (
        <SceneXRay
          worldId={worldId!}
          timelineId={timelineId}
          scrollRef={scrollRef}
          sceneCount={manuscript.totalScenes}
        />
      )}
      </div>
  )
}

/**
 * The reader's row: how far through the book, the contents, and the type. Not a
 * header's `actions` slot, which is withheld from a reader on purpose — those
 * are authoring controls without exception. Reading controls are a different
 * thing that happens to sit nearby.
 */
export function ReaderRow({ book, scrollRef }: { book: ManuscriptBookData; scrollRef: RefObject<HTMLDivElement | null> }) {
  const { manuscript, eventById, chapterNumberById } = book
  const activeEventId = useActiveEventId()
  /*
    Which chapter the spoiler gate has reached. Null when the reader chose "all
    chapters" — a deliberate full reveal, so nothing is withheld from the
    contents list either.
  */
  const gateChapterNumber = useMemo(() => {
    if (!activeEventId) return null
    const chapterId = eventById.get(activeEventId)?.chapterId
    const number = chapterId === undefined ? undefined : chapterNumberById.get(chapterId)
    /*
      0, not null, when the cursor names a scene whose chapter cannot be found —
      mid-load, or a world mended by hand. Null here means "all chapters", so
      falling back to it would answer an unanswerable question by revealing the
      whole book. 0 offers nothing instead, which is recoverable by reading on.
    */
    return number ?? 0
  }, [activeEventId, eventById, chapterNumberById])
  return (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <ReadingProgress scrollRef={scrollRef} chapterCount={manuscript.chapters.length} />
            <div className="flex items-center gap-2">
              <ReadingContents
                scrollRef={scrollRef}
                chapters={manuscript.chapters}
                gateChapterNumber={gateChapterNumber}
                placeEventId={activeEventId}
              />
              <ReadingTypeControls />
            </div>
          </div>
  )
}

/** The whole book's word goal, kept per world on this device, with its progress. */
export function BookGoal({ worldId, words }: { worldId: string; words: number }) {
  const goalKey = `kathala-ms-goal-${worldId}`
  const [goal, setGoal] = useState<number>(() => {
    const raw = localStorage.getItem(goalKey)
    return raw ? Number(raw) || 0 : 0
  })
  function updateGoal(value: number) {
    const v = Math.max(0, Math.round(value) || 0)
    setGoal(v)
    if (v > 0) localStorage.setItem(goalKey, String(v))
    else localStorage.removeItem(goalKey)
  }
  const pct = goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0

  return (
    <>
      <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
        <Target className="h-3.5 w-3.5" />
        <span>Goal</span>
        <input
          type="number"
          min={0}
          step={1000}
          value={goal || ''}
          // MS-3: this was an em-dash, which in a field reads as a value that
          // failed to load rather than as one nobody has set.
          placeholder="none"
          aria-label="Word goal for the book"
          onChange={(e) => updateGoal(Number(e.target.value))}
          className="h-8 w-24 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs tabular-nums text-[hsl(var(--foreground))]"
        />
      </label>
      {goal > 0 && (
        <div className="flex min-w-[120px] flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div className="h-full rounded-full bg-[hsl(var(--ring))] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{pct}%</span>
        </div>
      )}
    </>
  )
}
