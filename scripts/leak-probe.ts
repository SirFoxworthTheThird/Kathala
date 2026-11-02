import { test } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { computeKnowledgeLeaks } from '@/lib/proseContinuity'
import type { KnowledgeFact, WorldEvent, Chapter } from '@/types'

/*
  The early-reveal check on Part G's three app worlds (docs/records/part-g/books),
  whose writers called its warnings mostly noise. Counts what it reports now,
  matching spoiler words only, and what it reported when it also matched each
  fact's tags (three letters or more), and which word each warning matched.
  Measured 2026-11-02: A1 90 warnings with tags (67 of them a tag), 23 without;
  A2 and A3 none either way.
*/
const BOOKS = path.resolve(__dirname, '../docs/records/part-g/books')

/** The chapters the judges' spoiler lists name as giving an earlier era away, read from evaluation/judge-*.md. */
const JUDGED: Record<string, number[]> = {
  A1: [2, 3, 8, 9, 14, 17],
  A2: [2, 6, 8, 11, 12, 14, 17],
  A3: [3, 5, 6, 9, 12],
}

test('early-reveal warnings, with and without tags', () => {
  for (const book of ['A1', 'A2', 'A3']) {
    const w = JSON.parse(readFileSync(path.join(BOOKS, book, 'backup.pwk'), 'utf8'))
    const facts = w.knowledgeFacts as KnowledgeFact[]
    const events = w.events as WorldEvent[]
    const chapters = w.chapters as Chapter[]
    const sceneTextByEvent = new Map<string, string>((w.sceneTexts as Array<{ eventId: string; text: string }>).map((s) => [s.eventId, s.text]))
    const run = (fs: KnowledgeFact[]) => computeKnowledgeLeaks({ facts: fs, events, chapters, sceneTextByEvent })
    // The old rule: a fact's tags matched as if they were spoiler words.
    const withTags = run(facts.map((f) => ({ ...f, spoilerWords: [...(f.spoilerWords ?? []), ...f.tags.filter((t) => t.trim().length >= 3)] })))
    const without = run(facts)
    const by = (rows: typeof withTags) => {
      const kind = (r: (typeof withTags)[number]) =>
        r.matchedTerm === r.fact.title ? 'title' : r.fact.tags.some((s) => s.toLowerCase() === r.matchedTerm.toLowerCase()) ? 'tag' : 'spoiler word'
      const counts: Record<string, number> = {}
      for (const r of rows) counts[kind(r)] = (counts[kind(r)] ?? 0) + 1
      return counts
    }
    const terms: Record<string, number> = {}
    for (const r of withTags) terms[r.matchedTerm] = (terms[r.matchedTerm] ?? 0) + 1
    console.log(`${book}: ${facts.length} facts, ${facts.filter((f) => f.tags.length).length} with tags; warnings with tags ${withTags.length} ${JSON.stringify(by(withTags))}, without ${without.length} ${JSON.stringify(by(without))}`)
    console.log('  matched terms:', JSON.stringify(Object.entries(terms).sort((a, b) => b[1] - a[1]).slice(0, 12)))
    // Where the check warns now, by chapter, against the chapters the Part G
    // judges named as giving an earlier era away (evaluation/judge-*.md).
    const chapterOf = new Map(events.map((e) => [e.id, chapters.find((c) => c.id === e.chapterId)?.number]))
    const warned: Record<number, string[]> = {}
    for (const r of without) (warned[chapterOf.get(r.leakEventId) ?? 0] ??= []).push(r.matchedTerm)
    console.log(`  warned chapters now: ${JSON.stringify(warned)}; judges' leak chapters: ${JSON.stringify(JUDGED[book])}`)
  }
})
