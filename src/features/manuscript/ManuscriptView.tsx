import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Download, BookOpen, PencilLine, Target, Replace } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useTimelines, useChapters, useTimelineEvents, updateChapter } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { useSceneTextsByEvent, useHasProse } from '@/db/hooks/useManuscript'
import { ReadingProgress } from './ReadingProgress'
import { ReadingTypeControls } from './ReadingTypeControls'
import { ReadingContents } from './ReadingContents'
import { typeStyle } from '@/lib/readingType'
import { useReadingMode } from '@/db/hooks/useReading'
import { useAppStore, useActiveEventId } from '@/store'
import { computeSortKeySync } from '@/lib/sortKey'
import { cursorForScene } from '@/lib/readingPosition'
import { buildManuscript } from '@/lib/manuscriptCompile'
import { cn } from '@/lib/utils'
import { ExportManuscriptDialog } from './ExportManuscriptDialog'
import { FindReplaceDialog } from './FindReplaceDialog'
import { plural } from '@/lib/plural'
import { splitParagraphs as paragraphs } from '@/lib/manuscriptParagraphs'
import { emphasisSpans, type ProseSpan } from '@/lib/proseEmphasis'
import { useBlobUrl } from '@/db/hooks/useBlobs'

const nf = new Intl.NumberFormat()


/** Editable per-chapter word goal with a progress bar; persists on blur/Enter. */
function ChapterGoal({ chapterId, words, goal }: { chapterId: string; words: number; goal: number | null }) {
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

export default function ManuscriptView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const world = useWorld(worldId ?? null)
  const coverUrl = useBlobUrl(world?.coverImageId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const ordered = useMemo(() => [...timelines].sort((a, b) => a.createdAt - b.createdAt), [timelines])
  const [timelineId, setTimelineId] = useState<string | null>(null)
  const activeTimelineId = timelineId ?? ordered[0]?.id ?? null

  const chapters = useChapters(activeTimelineId)
  const events = useTimelineEvents(activeTimelineId)
  const sceneByEvent = useSceneTextsByEvent(worldId ?? null)

  const manuscript = useMemo(
    () => buildManuscript({ chapters, events, sceneTextByEvent: sceneByEvent }),
    [chapters, events, sceneByEvent]
  )

  /*
    The book's paragraphs, already split and with their emphasis read.

    Gutenberg writes italics as `_like this_` and every book in the Library
    does, so this runs over the whole text. On *The Count of Monte Cristo* —
    2,613,043 characters, 14,416 paragraphs — the split alone is 2.7ms and the
    split with emphasis is 43.1ms, measured over three passes. That is once per
    load either way; what this memo buys is that a reader pressing **Larger
    text** does not pay it again, since `manuscript` does not change when the
    type does.
  */
  const proseByScene = useMemo(() => {
    const out = new Map<string, ProseSpan[][]>()
    for (const ch of manuscript.chapters) {
      for (const s of ch.scenes) {
        if (s.written) out.set(s.eventId, paragraphs(s.text).map(emphasisSpans))
      }
    }
    return out
  }, [manuscript])

  const activeEventId = useActiveEventId()
  const chapterNumberById = useMemo(() => new Map(chapters.map((c) => [c.id, c.number])), [chapters])
  const eventById = useMemo(
    () => new Map(events.map((e) => [e.id, { chapterId: e.chapterId, sortOrder: e.sortOrder }])),
    [events],
  )

  /*
    In reading mode this screen *is* the book, so the presentation is not a
    choice the reader makes — the draft view shows synopses, scene numbers and
    unwritten placeholders, which is the author's scaffolding and none of a
    reader's business. The toggle below is hidden to match.
  */
  const readingMode = useReadingMode(worldId ?? null)
  const [draftMode, setDraftMode] = useState<'draft' | 'reading'>('draft')
  const mode = readingMode ? 'reading' : draftMode

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)
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
    if (!root || !activeEventId) return
    const target = root.querySelector<HTMLElement>(`[data-scene-event-id="${CSS.escape(activeEventId)}"]`)
    if (!target) return
    restoredRef.current = true
    // After layout, and instant rather than smooth: this is where the book
    // already was, not a movement the reader made.
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
  }, [readingMode, activeEventId, manuscript, worldId])

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
        if (next) setActiveEventId(next)
      },
      { root, rootMargin: '-25% 0px -60% 0px', threshold: 0 },
    )
    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [readingMode, manuscript, eventById, chapterNumberById, cursorKey, setActiveEventId])
  const [exportOpen, setExportOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)

  const goalKey = `plotweave-ms-goal-${worldId}`
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

  const pct = goal > 0 ? Math.min(100, Math.round((manuscript.totalWords / goal) * 100)) : 0
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
  const worldHasProse = useHasProse(worldId ?? null)
  const openingTheBook = !hasProse && worldHasProse === true

  return (
    <div className="flex h-full flex-col">
      {/*
        MS-2: this carried `count={totalWords}` — a bare pill reading `0`, or
        `48,000`, beside the word "Manuscript". The pill works on the rosters
        because the title names what is being counted: "Characters 45" needs no
        label. "Manuscript 0" needs one, and the subtitle a line below was
        already giving the same number with its unit attached.
      */}
      <PageHeader
        icon={FileText}
        title={readingMode ? 'Read' : 'Manuscript'}
        // A reader is told how far *they* have got, by the chapter bar and the
        // time cursor. How much of the book is "written" is a fact about an
        // author's progress, and there is no author here.
        description={readingMode
          ? undefined
          : `${nf.format(manuscript.writtenScenes)} of ${nf.format(manuscript.totalScenes)} scenes written · ${plural(manuscript.totalWords, 'word')}`}
        actions={readingMode ? undefined : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setFindOpen(true)} disabled={!hasProse}>
              <Replace className="h-4 w-4" /> Find &amp; replace
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)} disabled={!hasProse}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        )}
      >
        {/* Toolbar row: timeline picker, reading/draft toggle, word goal */}
        {ordered.length > 1 && (
          <select
            value={activeTimelineId ?? ''}
            onChange={(e) => setTimelineId(e.target.value)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))]"
            aria-label="Timeline"
          >
            {ordered.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {!readingMode && (
        <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="View mode">
          <button
            onClick={() => setDraftMode('draft')}
            aria-pressed={mode === 'draft'}
            className={cn('flex items-center gap-1 px-2 py-1 transition-colors', mode === 'draft' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <PencilLine className="h-3.5 w-3.5" /> Draft
          </button>
          <button
            onClick={() => setDraftMode('reading')}
            aria-pressed={mode === 'reading'}
            className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', mode === 'reading' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <BookOpen className="h-3.5 w-3.5" /> Reading
          </button>
        </div>
        )}
        {!readingMode && (
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
        )}
        {!readingMode && goal > 0 && (
          <div className="flex min-w-[120px] flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full rounded-full bg-[hsl(var(--ring))] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-[hsl(var(--muted-foreground))]">{pct}%</span>
          </div>
        )}
        {readingMode && hasProse && (
          /*
            The reader's row. Not the header's `actions` slot, which PageHeader
            withholds from a reader on purpose — those are authoring controls
            without exception, and the blanket rule is what keeps a screen added
            later right by default. Reading controls are a different thing that
            happens to sit nearby.
          */
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
        )}
      </PageHeader>

      <div ref={scrollRef} className="flex-1 overflow-auto">
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
              const scenes = mode === 'reading' ? ch.scenes.filter((s) => s.written) : ch.scenes
              if (mode === 'reading' && scenes.length === 0) return null
              return (
                <section
                  key={ch.id}
                  className="mb-12"
                  data-chapter-number={ch.number}
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
                    {mode === 'draft' && ch.synopsis && (
                      <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">{ch.synopsis}</p>
                    )}
                    {mode === 'draft' && (
                      <ChapterGoal chapterId={ch.id} words={ch.wordCount} goal={ch.wordGoal} />
                    )}
                  </div>

                  {scenes.map((s, i) => (
                    <div key={s.eventId} data-scene-event-id={s.eventId}>
                      {i > 0 && (
                        <div className="my-6 text-center text-sm text-[hsl(var(--muted-foreground))]" aria-hidden="true">* * *</div>
                      )}
                      {mode === 'draft' && (
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                          <button
                            onClick={() => navigate(`/worlds/${worldId}/timeline/${ch.id}`)}
                            className="hover:text-[hsl(var(--foreground))] transition-colors"
                            title="Open in timeline"
                          >
                            {s.title}
                          </button>
                          <span>·</span>
                          <span className="tabular-nums">{nf.format(s.wordCount)} words</span>
                        </div>
                      )}
                      {s.written ? (
                        <div
                          className={cn(
                            'text-[hsl(var(--foreground))]',
                            // The draft keeps its fixed setting: the reader's
                            // preference is about reading, and an author
                            // checking line lengths wants them to stay put.
                            mode === 'reading' ? undefined : 'text-[15px] leading-relaxed',
                          )}
                          style={mode === 'reading'
                            ? typeStyle(readingType)
                            : { fontFamily: 'var(--font-prose)' }}
                        >
                          {(proseByScene.get(s.eventId) ?? []).map((spans, j) => (
                            <p key={j} className="mb-4 [text-indent:1.5rem] first:[text-indent:0]">
                              {spans.map((sp, k) => (sp.em ? <em key={k}>{sp.text}</em> : sp.text))}
                            </p>
                          ))}
                        </div>
                      ) : (
                        mode === 'draft' && (
                          <button
                            onClick={() => navigate(`/worlds/${worldId}/timeline/${ch.id}`)}
                            className="mb-4 block w-full rounded-md border border-dashed border-[hsl(var(--border))] px-4 py-3 text-left text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.4)] hover:text-[hsl(var(--foreground))] transition-colors"
                          >
                            No prose yet — write this scene
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </section>
              )
            })}
          </div>
        )}
      </div>

      <ExportManuscriptDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        manuscript={manuscript}
        /* The book is the world. The timeline named the file and the title
           page both, so a novel exported as its own internal grouping (N11). */
        title={world?.name ?? 'Manuscript'}
        timelineName={ordered.find((t) => t.id === activeTimelineId)?.name}
        timelineCount={ordered.length}
        coverUrl={coverUrl}
      />
      {worldId && <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} worldId={worldId} />}
    </div>
  )
}
