import { useMemo } from 'react'
import { useKnowledgeFacts } from '@/db/hooks/useKnowledge'
import { useAllWorldEvents, useTimelines, useWorldChapters } from '@/db/hooks/useTimeline'
import { useWorldSceneTexts } from '@/db/hooks/useManuscript'
import { useActiveEventId } from '@/store'
import { knownBy, readerSchedule, type ScheduleLeak } from '@/lib/readerSchedule'
import { cn } from '@/lib/utils'

/**
 * What the reader knows, chapter by chapter, and which strand told them (Part
 * E2): each fact the reader is set to learn, drawn against the chapters in the
 * order they are read — its reveal, and every earlier chapter that gives it
 * away. In a braided book a strand telling it early is a mark, in that
 * strand's colour, chapters before the one it should be in.
 *
 * For the writer only: it is every reveal in the book at once.
 */
export function ReaderSchedule({ worldId }: { worldId: string }) {
  const facts = useKnowledgeFacts(worldId)
  // Every strand's scenes and chapters: the reader reads them all.
  const events = useAllWorldEvents(worldId)
  const chapters = useWorldChapters(worldId)
  const timelines = useTimelines(worldId)
  const texts = useWorldSceneTexts(worldId)
  const activeEventId = useActiveEventId()

  const schedule = useMemo(
    () => readerSchedule({ facts, events, chapters, sceneTextByEvent: new Map(texts.map((t) => [t.eventId, t.text ?? ''])) }),
    [facts, events, chapters, texts],
  )
  const known = useMemo(() => (activeEventId ? knownBy(schedule, activeEventId, events, chapters) : null), [schedule, activeEventId, events, chapters])
  const strand = useMemo(() => new Map(timelines.map((t) => [t.id, t])), [timelines])
  const chapterOf = useMemo(() => new Map(schedule.chapters.map((c) => [c.id, c])), [schedule.chapters])
  // A strand named only where there is more than one to tell apart.
  const braided = new Set(schedule.chapters.map((c) => c.timelineId)).size > 1
  const where = (chapterId: string, timelineId: string) =>
    `Ch. ${chapterOf.get(chapterId)?.number ?? '?'}${braided ? `, ${strand.get(timelineId)?.name ?? 'another timeline'}` : ''}`
  const leakSays = (l: ScheduleLeak) =>
    `${where(l.chapterId, l.timelineId)} gives it away ${l.chaptersEarly} ${l.chaptersEarly === 1 ? 'chapter' : 'chapters'} early (“${l.term}”)`
  const cursorChapter = activeEventId ? events.find((e) => e.id === activeEventId)?.chapterId : undefined

  if (schedule.rows.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        No fact has a scene where the reader learns it yet. Set <strong>Reader learns at</strong> on a fact, and it is drawn here against the chapters.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="known-now" className="rounded-lg border border-[hsl(var(--border))] p-3">
        <h3 id="known-now" className="mb-2 text-sm font-semibold">
          {known && cursorChapter ? `What the reader knows by ${where(cursorChapter, chapterOf.get(cursorChapter)?.timelineId ?? '')}` : 'What the reader knows'}
        </h3>
        {!known ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Put the time cursor on a scene to see what the reader knows there.</p>
        ) : known.length === 0 ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Nothing yet: no fact has been told by this point.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {known.map((k) => (
              <li key={k.row.fact.id}>
                <span className="font-medium">{k.row.fact.title}</span>
                <span className={cn('ml-2 text-xs', k.early ? 'text-amber-400' : 'text-[hsl(var(--muted-foreground))]')}>
                  {k.early
                    ? `told early by ${where(k.told.chapterId, k.told.timelineId)} — its reveal is ${where(k.row.reveal.chapterId, k.row.reveal.timelineId)}`
                    : `told in ${where(k.told.chapterId, k.told.timelineId)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="border-collapse text-xs" aria-label="The reader’s schedule">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-[hsl(var(--background))] px-2 py-1 text-left font-semibold">Fact</th>
              {schedule.chapters.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  title={`Ch. ${c.number} — ${c.title}${braided ? `, ${strand.get(c.timelineId)?.name ?? ''}` : ''}`}
                  className={cn('min-w-[1.75rem] px-1 py-1 text-center font-normal tabular-nums', c.id === cursorChapter && 'bg-[hsl(var(--accent))]')}
                  style={{ borderBottom: `3px solid ${strand.get(c.timelineId)?.color ?? 'transparent'}` }}
                >
                  {c.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((row) => (
              <tr key={row.fact.id} className="border-t border-[hsl(var(--border))]">
                <th scope="row" className="sticky left-0 z-10 max-w-[16rem] truncate bg-[hsl(var(--background))] px-2 py-1 text-left font-medium" title={row.fact.title}>
                  {row.fact.title}
                </th>
                {schedule.chapters.map((c) => {
                  const leak = row.leaks.find((l) => l.chapterId === c.id)
                  const reveal = row.reveal.chapterId === c.id
                  const says = reveal ? `Reveal: ${where(row.reveal.chapterId, row.reveal.timelineId)}` : leak ? leakSays(leak) : undefined
                  return (
                    <td key={c.id} className={cn('px-1 py-1 text-center', c.id === cursorChapter && 'bg-[hsl(var(--accent)/0.5)]')} title={says} aria-label={says}>
                      {reveal ? (
                        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: strand.get(row.reveal.timelineId)?.color ?? 'currentColor' }} />
                      ) : leak ? (
                        <span aria-hidden="true" className="font-bold text-amber-400">!</span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        ● where the reader is set to learn each fact, in its strand’s colour; <span className="font-bold text-amber-400">!</span> an earlier chapter whose prose gives it away, by the fact’s spoiler words.
      </p>
    </div>
  )
}
