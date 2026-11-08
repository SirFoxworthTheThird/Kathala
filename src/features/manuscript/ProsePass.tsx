import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SpellCheck, StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorld } from '@/db/hooks/useWorlds'
import { setProseFindingDismissed } from '@/db/hooks/useProseChecks'
import { addProseNote } from '@/db/hooks/useProseNotes'
import { anchorFrom } from '@/lib/noteAnchor'
import { checkBook, proseSettings, type ProseCheck, type ProseFinding, type ProseReport } from '@/lib/proseChecks'
import { loadBaseline } from '@/lib/proseChecks/baseline'
import type { ManuscriptChapter } from '@/lib/manuscriptCompile'
import type { ScenePass } from './SceneXRay'

/*
  The prose pass on Read (editorial-plan.md, R6): what the line-level checks
  find, underlined in the scene in view and listed beside the page, each to be
  dismissed or made a note on the Page. Run once the page is drawn — a long
  book takes most of a second — and again when the prose or the settings
  change; dismissing hides a finding without running them again.
*/

export const CHECK_LABEL: Record<ProseCheck, string> = { echo: 'Echo', pet: 'Pet word', rhythm: 'Rhythm', tag: 'Dialogue tag', length: 'Length' }
const TONE: Record<ProseCheck, string> = {
  echo: 'decoration-sky-500', pet: 'decoration-violet-500', rhythm: 'decoration-teal-500', tag: 'decoration-rose-500', length: 'decoration-teal-500',
}

export interface ProsePass {
  report: ProseReport | null
  /** The scene's findings, those dismissed left out. */
  findingsOf: (eventId: string) => ProseFinding[]
  /** A span of a scene's prose with what was found in it underlined: paragraph `p`, span `s` of it. */
  marked: (eventId: string, p: number, s: number, text: string) => ReactNode
  side: ScenePass
}

export function useProsePass(worldId: string | null, chapters: readonly ManuscriptChapter[], chapterOf: (eventId: string) => string | undefined): ProsePass | null {
  const world = useWorld(worldId)
  const settings = useMemo(() => proseSettings(world?.proseChecks), [world?.proseChecks])
  const dismissed = useMemo(() => new Set(world?.proseDismissed ?? []), [world?.proseDismissed])
  const [report, setReport] = useState<ProseReport | null>(null)

  useEffect(() => {
    if (!worldId) { setReport(null); return }
    let live = true
    setReport(null)
    const book = { chapters: chapters.map((c) => ({ id: c.id, number: c.number, scenes: c.scenes.filter((s) => s.written).map((s) => ({ eventId: s.eventId, text: s.text })) })) }
    void loadBaseline().then((baseline) => {
      // After the page has been drawn with "Checking…" on it.
      setTimeout(() => { if (live) setReport(checkBook(book, baseline, settings)) }, 30)
    })
    return () => { live = false }
  }, [worldId, chapters, settings])

  return useMemo(() => {
    if (!worldId) return null
    const findingsOf = (eventId: string) => (report?.byScene.get(eventId) ?? []).filter((f) => !dismissed.has(f.key))
    // Each scene's underlined stretches, in order.
    const ranges = new Map<string, Array<{ start: number; end: number; f: ProseFinding }>>()
    const rangesOf = (eventId: string) => {
      let r = ranges.get(eventId)
      if (!r) {
        r = findingsOf(eventId).flatMap((f) => [[f.start, f.end] as [number, number], ...(f.more ?? [])].filter(([a, b]) => b > a).map(([start, end]) => ({ start, end, f })))
          .sort((a, b) => a.start - b.start)
        ranges.set(eventId, r)
      }
      return r
    }
    const marked = (eventId: string, p: number, s: number, text: string): ReactNode => {
      const at = report?.plain.get(eventId)?.paragraphs[p]?.spans[s]?.start
      if (at === undefined) return text
      const end = at + text.length
      const here = rangesOf(eventId).filter((r) => r.end > at && r.start < end)
      if (here.length === 0) return text
      const out: ReactNode[] = []
      let from = at
      for (const r of here) {
        const a = Math.max(r.start, from)
        const b = Math.min(r.end, end)
        if (b <= a) continue
        if (a > from) out.push(text.slice(from - at, a - at))
        out.push(
          <mark key={a} data-prose={r.f.check} title={`${CHECK_LABEL[r.f.check]}: ${r.f.message}`} className={`bg-transparent text-inherit underline decoration-dotted decoration-2 underline-offset-4 ${TONE[r.f.check]}`}>
            {text.slice(a - at, b - at)}
          </mark>,
        )
        from = b
      }
      if (from < end) out.push(text.slice(from - at))
      return <Fragment>{out}</Fragment>
    }
    return {
      report,
      findingsOf,
      marked,
      side: {
        name: 'Prose pass',
        icon: SpellCheck,
        list: (eventId: string | null) => <ProsePassList worldId={worldId} report={report} eventId={eventId} findings={eventId ? findingsOf(eventId) : []} chapterNote={eventId ? report?.chapterLengths.get(chapterOf(eventId) ?? '') : undefined} />,
      },
    }
  }, [worldId, report, dismissed, chapterOf])
}

function ProsePassList({ worldId, report, eventId, findings, chapterNote }: {
  worldId: string
  report: ProseReport | null
  eventId: string | null
  findings: ProseFinding[]
  chapterNote?: string
}) {
  const quiet = 'px-1.5 py-1 text-xs text-[hsl(var(--muted-foreground))]'
  if (!report) return <p role="status" className={quiet}>Checking the prose…</p>
  const makeNote = async (f: ProseFinding) => {
    const text = report.plain.get(f.eventId)?.text ?? ''
    const anchor = anchorFrom(f.eventId, text, f.start, f.end)
    if (anchor) await addProseNote({ worldId, anchor, body: `${CHECK_LABEL[f.check]}: ${f.message}`, author: { kind: 'check' } })
  }
  return (
    <div className="flex flex-col gap-2">
      {report.pets.length > 0 && (
        <section aria-label="The book’s pet words" className="px-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          <h3 className="pb-0.5 font-semibold uppercase tracking-wide">The book’s pet words</h3>
          <p>{report.pets.map((p) => `${p.words} ×${p.count} (${p.ratio.toFixed(1)}×)`).join(' · ')}</p>
        </section>
      )}
      {chapterNote && <p className={quiet}>{chapterNote}</p>}
      {!eventId ? <p className={quiet}>Scroll to a scene to see what is found in it.</p> : findings.length === 0 ? (
        <p className={quiet}>Nothing found in this scene.</p>
      ) : (
        <ul aria-label="Found in this scene" className="flex flex-col gap-1">
          {findings.map((f) => (
            <li key={f.key} aria-label={`${CHECK_LABEL[f.check]}: ${f.message}`} className="rounded-md px-1.5 py-1 text-xs">
              <span className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{CHECK_LABEL[f.check]}</span>
              <span className="block text-[hsl(var(--foreground))]">{f.message}</span>
              <span className="mt-0.5 flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px]" onClick={() => void setProseFindingDismissed(worldId, f.key, true)}>
                  <X className="h-3 w-3" aria-hidden="true" /> Dismiss
                </Button>
                {f.end > f.start && (
                  <Button size="sm" variant="ghost" className="h-6 gap-1 px-1.5 text-[11px]" onClick={() => void makeNote(f)}>
                    <StickyNote className="h-3 w-3" aria-hidden="true" /> Make a note
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/worlds/${worldId}/settings`} state={{ section: 'settings-prose-checks' }} className="px-1.5 text-[11px] text-[hsl(var(--muted-foreground))] underline underline-offset-2">
        Change what is checked
      </Link>
    </div>
  )
}
