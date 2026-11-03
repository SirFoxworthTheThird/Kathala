import type { KnowledgeFact } from '@/types'
import { matchTerms } from './spoilerWords'

/*
  The spoiler pass (run-10 plan, Part 3): the book read from the start with
  what the reader has been told so far beside it, and the words of what is
  still to come marked in the text. It is the deliberate re-read that run 10's
  Control A did by hand ("wake her gentle" became "wake them gentle").

  Everything here is in the book's reading order (`BookPosition`), the order
  the early-reveal check uses, so the pass and the checker agree about what
  comes before what.
*/

/** A fact the pass follows: one the reader learns at a scene that is in the book. */
export interface PassFact {
  fact: KnowledgeFact
  /** The reveal scene's place in the book. */
  at: number
  /** The reveal scene's era (`Story.eraOf`). */
  era: string | null
  /** The words that give it away (`matchTerms`). Empty: listed, but nothing to mark. */
  terms: string[]
}

/** The facts with a reveal scene in the book, in the order the reader learns them. */
export function passFacts(
  facts: readonly KnowledgeFact[],
  positionOf: (sceneId: string) => number,
  eraOf: (sceneId: string) => string | null,
): PassFact[] {
  const out: PassFact[] = []
  for (const fact of facts) {
    const id = fact.readerLearnsAtEventId
    if (!id) continue
    const at = positionOf(id)
    if (at < 0) continue
    out.push({ fact, at, era: eraOf(id), terms: matchTerms(fact) })
  }
  return out.sort((a, b) => a.at - b.at)
}

/**
 * Where the reader stands at the scene at `here`: what they have been told —
 * by the end of this scene, so a fact revealed here counts — grouped by era,
 * the eras in the order the book first tells of them; and what is still to come.
 */
export function toldAt(facts: readonly PassFact[], here: number): {
  told: Array<{ era: string | null; facts: PassFact[] }>
  toCome: PassFact[]
} {
  const told: Array<{ era: string | null; facts: PassFact[] }> = []
  const toCome: PassFact[] = []
  for (const f of facts) {
    if (f.at > here) { toCome.push(f); continue }
    const group = told.find((g) => g.era === f.era)
    if (group) group.facts.push(f)
    else told.push({ era: f.era, facts: [f] })
  }
  return { told, toCome }
}

/** A run of text, and the fact still to come that it gives away, if it does. */
export interface MarkedRun {
  text: string
  fact?: KnowledgeFact
}

/**
 * Finds the words of facts still to come in a scene's text — whole word,
 * whatever the case, as the early-reveal check matches them. Built once per
 * scene and run over each of its spans. Null when there is nothing to find.
 */
export function spoilerMarker(toCome: readonly PassFact[]): ((text: string) => MarkedRun[]) | null {
  // The first fact to claim a word keeps it: the one the reader learns soonest.
  const byWord = new Map<string, KnowledgeFact>()
  for (const f of toCome) {
    for (const t of f.terms) {
      const k = t.toLowerCase()
      if (!byWord.has(k)) byWord.set(k, f.fact)
    }
  }
  if (byWord.size === 0) return null
  // Longest first, so "Deck Nine" is found as itself and not as "Deck".
  const words = [...byWord.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(escapeWord).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  return (text) => {
    const runs: MarkedRun[] = []
    let from = 0
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      if (start > from) runs.push({ text: text.slice(from, start) })
      runs.push({ text: m[0], fact: byWord.get(m[0].toLowerCase()) })
      from = start + m[0].length
    }
    if (from < text.length || runs.length === 0) runs.push({ text: text.slice(from) })
    return runs
  }
}

function escapeWord(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
