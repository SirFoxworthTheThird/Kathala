import { tokens } from './text'
import { CRUTCH_PAIRS } from './checks'
import type { ProseBaseline } from './types'

/*
  The baseline the prose checks measure a word's commonness against
  (editorial-plan.md, R6, decision D-4): how often each word, and each pair of
  words, is used in the Library's books, per million words. Counted by
  `scripts/prose-baseline-probe.ts` and shipped as `baseline.json`, loaded only
  when the checks run.
*/

export interface Counts {
  total: number
  words: Map<string, number>
  bigrams: Map<string, number>
}

export function emptyCounts(): Counts {
  return { total: 0, words: new Map(), bigrams: new Map() }
}

/** A book's counts added to the Library's. */
export function addBook(into: Counts, book: Counts): Counts {
  into.total += book.total
  for (const [k, v] of book.words) into.words.set(k, (into.words.get(k) ?? 0) + v)
  for (const [k, v] of book.bigrams) into.bigrams.set(k, (into.bigrams.get(k) ?? 0) + v)
  return into
}

/** Count a text's words, whatever their case, and its pairs of words not parted by a sentence's end or a clause's. */
export function countText(text: string, into: Counts): Counts {
  const words = tokens(text)
  into.total += words.length
  for (let i = 0; i < words.length; i++) {
    const t = words[i]
    into.words.set(t.key, (into.words.get(t.key) ?? 0) + 1)
    const n = words[i + 1]
    if (n && !/[.!?;:]/.test(text.slice(t.end, n.start))) {
      const k = `${t.key} ${n.key}`
      into.bigrams.set(k, (into.bigrams.get(k) ?? 0) + 1)
    }
  }
  return into
}

/** Counts less another's: the Library without one book, to measure that book against. */
export function without(all: Counts, one: Counts): Counts {
  const less = (a: Map<string, number>, b: Map<string, number>) => {
    const out = new Map(a)
    for (const [k, v] of b) {
      const left = (out.get(k) ?? 0) - v
      if (left > 0) out.set(k, left)
      else out.delete(k)
    }
    return out
  }
  return { total: all.total - one.total, words: less(all.words, one.words), bigrams: less(all.bigrams, one.bigrams) }
}

/**
 * Rates per million: of each word used at least `minWords` times in a million
 * — rarer than that, the checks treat every word alike, as rare — and of the
 * pairs of words a pet word can be (`CRUTCH_PAIRS`), which are the only pairs
 * any check asks about.
 */
export function toBaseline(c: Counts, minWords = 4): ProseBaseline {
  const per = (n: number) => (n / c.total) * 1e6
  const round = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10)
  const words: Record<string, number> = {}
  for (const [k, v] of c.words) if (per(v) >= minWords) words[k] = round(per(v))
  const bigrams: Record<string, number> = {}
  for (const k of CRUTCH_PAIRS) { const v = c.bigrams.get(k); if (v) bigrams[k] = round(per(v)) }
  return { total: c.total, words, bigrams }
}

let loaded: Promise<ProseBaseline> | null = null

/** The shipped baseline, loaded once, when first asked for. */
export function loadBaseline(): Promise<ProseBaseline> {
  loaded ??= import('./baseline.json').then((m) => m.default as ProseBaseline)
  return loaded
}
