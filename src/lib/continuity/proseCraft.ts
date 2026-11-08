import { plural } from '@/lib/plural'
import type { ProseReport } from '@/lib/proseChecks'
import type { Issue } from './computeIssues'

/*
  The prose pass in the Continuity Checker (editorial-plan.md, R6): a chapter's
  findings, counted, as one observation about its craft — a note, never a
  warning, since none of it is wrong — with the way to the chapter to read
  them on Read. Dismissed findings are not counted.
*/

const NAMES: Record<string, [string, string]> = {
  echo: ['echo', 'echoes'], pet: ['use of a pet word', 'uses of pet words'], rhythm: ['note on sentence rhythm', 'notes on sentence rhythm'],
  tag: ['dialogue tag', 'dialogue tags'], length: ['scene far from the usual length', 'scenes far from the usual length'],
}

export function proseCraftIssues(
  report: ProseReport,
  chapters: ReadonlyArray<{ id: string; number: number }>,
  events: ReadonlyArray<{ id: string; chapterId: string }>,
  worldId: string | undefined,
  dismissed: ReadonlySet<string> = new Set(),
): Issue[] {
  const out: Issue[] = []
  const sceneChapter = new Map(events.map((e) => [e.id, e.chapterId]))
  for (const ch of [...chapters].sort((a, b) => a.number - b.number)) {
    const counts: Record<string, number> = {}
    let first: string | undefined
    for (const [eventId, found] of report.byScene) {
      if (sceneChapter.get(eventId) !== ch.id) continue
      for (const f of found) {
        if (dismissed.has(f.key)) continue
        counts[f.check] = (counts[f.check] ?? 0) + 1
        first ??= eventId
      }
    }
    const said = Object.entries(counts).map(([k, n]) => plural(n, NAMES[k][0], NAMES[k][1]))
    const length = report.chapterLengths.get(ch.id)
    if (said.length === 0 && !length) continue
    out.push({
      id: `prose-craft-${ch.id}`,
      kind: 'prose-craft',
      severity: 'note',
      category: 'prose',
      message: `Ch. ${ch.number}: ${said.length ? said.join(', ') : 'its length'}`,
      ...(length ? { detail: length } : {}),
      ...(worldId ? { navigatePath: `/worlds/${worldId}/manuscript/${ch.id}` } : {}),
      ...(first ? { eventId: first } : {}),
    })
  }
  return out
}
