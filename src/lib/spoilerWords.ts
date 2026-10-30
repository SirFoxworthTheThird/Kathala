import type { KnowledgeFact } from '@/types'

/*
  The words that would give a fact away (`KnowledgeFact.spoilerWords`), and
  what the early-reveal check matches: those, the fact's tags, and its exact
  title. Run 10's facts were titled as sentences — "Hal Oduya informed on Jory
  Mbeki" — which no prose ever repeats, and carried no tags, so a reveal given
  away eight chapters early went unreported.
*/

/** Words the early-reveal check can match for a fact: its spoiler words, then its tags. */
export function matchTerms(fact: Pick<KnowledgeFact, 'spoilerWords' | 'tags'>): string[] {
  const terms = [
    ...(fact.spoilerWords ?? []).map((w) => w.trim()).filter((w) => w.length >= 2),
    ...fact.tags.map((t) => t.trim()).filter((t) => t.length >= 3),
  ]
  return dedupe(terms)
}

/**
 * The facts with a reveal scene for the reader that the check cannot look for:
 * nothing to match but a title, which prose seldom repeats. Listed rather than
 * passed over, so a clean check is not read as a book that gives nothing away.
 */
export function uncheckedFacts<F extends Pick<KnowledgeFact, 'spoilerWords' | 'tags' | 'readerLearnsAtEventId'>>(facts: readonly F[]): F[] {
  return facts.filter((f) => f.readerLearnsAtEventId && matchTerms(f).length === 0)
}

/** "Ilse, the Opener; Deck Nine" → the words, trimmed, once each. */
export function parseSpoilerWords(text: string): string[] {
  return dedupe(text.split(/[,;\n]/).map((w) => w.trim()).filter(Boolean))
}

/**
 * Starting suggestions for a fact's spoiler words: the names of the people,
 * places and items it concerns — those its title or description names, whole
 * word — that it does not already list.
 */
export function spoilerSuggestions(
  fact: Pick<KnowledgeFact, 'title' | 'description' | 'spoilerWords'>,
  names: readonly string[],
): string[] {
  const text = `${fact.title}\n${fact.description}`
  const have = new Set((fact.spoilerWords ?? []).map((w) => w.toLowerCase()))
  return dedupe(names.filter((n) => n.trim().length >= 2 && !have.has(n.trim().toLowerCase()) && wordIn(text, n.trim())))
}

/** Where `word` stands in `text` as a whole word, ignoring case: each match's start and end. */
export function wordSpans(text: string, word: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const m of text.matchAll(new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(word)})(?=$|[^\\p{L}\\p{N}])`, 'giu'))) {
    const at = m.index + m[1].length
    out.push([at, at + m[2].length])
  }
  return out
}

/** A place in a scene's prose that gives a fact away: what matched, and where. */
export interface FactMatch { term: string; from: number; to: number }

/**
 * Everywhere `text` gives `fact` away, by the early-reveal check's rule: its
 * exact title as a phrase (four letters or more), then each of its spoiler
 * words and tags as a whole word, ignoring case. The title's matches come
 * first, then each word's in `matchTerms` order: the first is the one the
 * checker names.
 */
export function factMatches(text: string, fact: Pick<KnowledgeFact, 'title' | 'spoilerWords' | 'tags'>): FactMatch[] {
  const out: FactMatch[] = []
  const title = fact.title.trim()
  if (title.length >= 4) {
    const lower = text.toLowerCase()
    const phrase = title.toLowerCase()
    for (let at = lower.indexOf(phrase); at >= 0; at = lower.indexOf(phrase, at + phrase.length)) out.push({ term: title, from: at, to: at + phrase.length })
  }
  for (const term of matchTerms(fact)) for (const [from, to] of wordSpans(text, term)) out.push({ term, from, to })
  return out
}

/** Whether `word` is in `text` as a whole word, ignoring case. */
export function wordIn(text: string, word: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dedupe(words: readonly string[]): string[] {
  const seen = new Set<string>()
  return words.filter((w) => {
    const k = w.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
