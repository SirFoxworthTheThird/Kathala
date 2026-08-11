import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Download, BookOpen, PencilLine, Target, Replace } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useTimelines, useChapters, useTimelineEvents, updateChapter } from '@/db/hooks/useTimeline'
import { useSceneTextsByEvent } from '@/db/hooks/useManuscript'
import { buildManuscript } from '@/lib/manuscriptCompile'
import { cn } from '@/lib/utils'
import { ExportManuscriptDialog } from './ExportManuscriptDialog'
import { FindReplaceDialog } from './FindReplaceDialog'
import { plural } from '@/lib/plural'

const nf = new Intl.NumberFormat()

/** Split prose into paragraphs on blank lines. */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
}

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

  const [mode, setMode] = useState<'draft' | 'reading'>('draft')
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
        title="Manuscript"
        description={`${nf.format(manuscript.writtenScenes)} of ${nf.format(manuscript.totalScenes)} scenes written · ${plural(manuscript.totalWords, 'word')}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setFindOpen(true)} disabled={!hasProse}>
              <Replace className="h-4 w-4" /> Find &amp; replace
            </Button>
            <Button size="sm" onClick={() => setExportOpen(true)} disabled={!hasProse}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        }
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
        <div className="flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs" role="group" aria-label="View mode">
          <button
            onClick={() => setMode('draft')}
            aria-pressed={mode === 'draft'}
            className={cn('flex items-center gap-1 px-2 py-1 transition-colors', mode === 'draft' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <PencilLine className="h-3.5 w-3.5" /> Draft
          </button>
          <button
            onClick={() => setMode('reading')}
            aria-pressed={mode === 'reading'}
            className={cn('flex items-center gap-1 border-l border-[hsl(var(--border))] px-2 py-1 transition-colors', mode === 'reading' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
          >
            <BookOpen className="h-3.5 w-3.5" /> Reading
          </button>
        </div>
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
      </PageHeader>

      <div className="flex-1 overflow-auto">
        {!hasProse ? (
          /*
            MS-4 asked for a second version of this sentence, for a reader on a
            Library world who cannot write the prose it tells them to write.
            That reader never gets here: Manuscript is `writingOnly`, so the
            router redirects a reading-mode world to its dashboard rather than
            serving the screen. The only person who sees this is one who can act
            on it. Adding the branch would have been unreachable code, which is
            what the Items section in EventCard turned out to be under X-4.
          */
          <EmptyState
            icon={FileText}
            title="No prose yet"
            description="Write scene prose on your events, and it stitches together here into one continuous manuscript you can read and export."
            className="h-full"
          />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            {manuscript.chapters.map((ch) => {
              const scenes = mode === 'reading' ? ch.scenes.filter((s) => s.written) : ch.scenes
              if (mode === 'reading' && scenes.length === 0) return null
              return (
                <section key={ch.id} className="mb-12">
                  <div className="mb-4 border-b border-[hsl(var(--border))] pb-2">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                      Ch. {ch.number} — {ch.title || 'Untitled'}
                    </h2>
                    <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {plural(ch.wordCount, 'word')} · {ch.writtenScenes}/{ch.scenes.length} scenes
                    </p>
                    {mode === 'draft' && ch.synopsis && (
                      <p className="mt-1 text-xs italic text-[hsl(var(--muted-foreground))]">{ch.synopsis}</p>
                    )}
                    {mode === 'draft' && (
                      <ChapterGoal chapterId={ch.id} words={ch.wordCount} goal={ch.wordGoal} />
                    )}
                  </div>

                  {scenes.map((s, i) => (
                    <div key={s.eventId}>
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
                        <div className="font-serif text-[15px] leading-relaxed text-[hsl(var(--foreground))]">
                          {paragraphs(s.text).map((p, j) => (
                            <p key={j} className="mb-4 [text-indent:1.5rem] first:[text-indent:0]">{p}</p>
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
        title={ordered.find((t) => t.id === activeTimelineId)?.name ?? 'Manuscript'}
      />
      {worldId && <FindReplaceDialog open={findOpen} onOpenChange={setFindOpen} worldId={worldId} />}
    </div>
  )
}
