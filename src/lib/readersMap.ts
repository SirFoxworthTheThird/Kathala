import type { BetaReader, ProseNote, Reaction } from '@/types'

/*
  The reactions map (editorial-plan.md, R7): chapter by chapter, how the beta
  readers reacted, and where each of them stopped. A note is counted in the
  chapter of the scene it was made on; a reader's place in their copy is found
  in the book by its scene, or, with that scene gone, by its chapter's number.
*/

export interface MapRow {
  chapterId: string
  number: number
  title: string
  /** Each reaction's count here, and notes with no reaction. */
  reactions: Partial<Record<Reaction, number>>
  plain: number
  /** The readers whose place is in this chapter. */
  stopped: string[]
}

export function readersMap(
  chapters: ReadonlyArray<{ id: string; number: number; title: string }>,
  events: ReadonlyArray<{ id: string; chapterId: string }>,
  notes: readonly ProseNote[],
  readers: readonly BetaReader[],
  /** One reader's, or every reader's. */
  only: string | null = null,
): MapRow[] {
  const chapterOf = new Map(events.map((e) => [e.id, e.chapterId]))
  const ordered = [...chapters].sort((a, b) => a.number - b.number)
  const rows = new Map(ordered.map((c): [string, MapRow] => [c.id, { chapterId: c.id, number: c.number, title: c.title, reactions: {}, plain: 0, stopped: [] }]))
  const mine = (name: string | undefined) => only === null || name === only
  for (const n of notes) {
    if (n.author.kind !== 'reader' || !n.author.name || !mine(n.author.name)) continue
    const row = rows.get(chapterOf.get(n.eventId) ?? '')
    if (!row) continue
    if (n.reaction) row.reactions[n.reaction] = (row.reactions[n.reaction] ?? 0) + 1
    else row.plain++
  }
  for (const r of readers) {
    if (!mine(r.name) || !r.readTo) continue
    const chapterId = chapterOf.get(r.readTo.eventId) ?? ordered.find((c) => c.number === r.readTo!.chapter)?.id
    rows.get(chapterId ?? '')?.stopped.push(r.name)
  }
  return [...rows.values()]
}
