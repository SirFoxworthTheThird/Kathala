import { tokens } from '@/lib/proseChecks/text'

/*
  The world's own names in spelling (issue #705): which words the world's names
  are made of, so the desktop app's spell checker can know them, and which
  words of the prose are near misses of one of them — *Teodroa* for *Teodora* —
  so Kathala can mark them in any browser. Pure. The decisions are in
  `docs/records/spelling-plan.md`.
*/

/** What a world names: its people (with their other names), places, items and factions. */
export interface NameSource {
  characters: ReadonlyArray<{ name: string; aliases?: readonly string[]; nameChanges?: ReadonlyArray<{ name: string }> }>
  places: ReadonlyArray<{ name: string }>
  items: ReadonlyArray<{ name: string }>
  factions: ReadonlyArray<{ name: string }>
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu

/** A word without a possessive ’s, or a ’d or ’ll run on to it (*Medlock’d*). */
export function bare(word: string): string {
  return word.replace(/['’](?:[sS]|[dD]|ll|LL)$/u, '')
}

/** Every name the world has, whole, once each, in the order given. */
export function worldNames(src: NameSource): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (n: string | undefined) => {
    const t = n?.trim()
    if (!t || seen.has(t.toLowerCase())) return
    seen.add(t.toLowerCase())
    out.push(t)
  }
  for (const c of src.characters) {
    add(c.name)
    for (const a of c.aliases ?? []) add(a)
    for (const n of c.nameChanges ?? []) add(n.name)
  }
  for (const p of src.places) add(p.name)
  for (const i of src.items) add(i.name)
  for (const f of src.factions) add(f.name)
  return out
}

/** The single words the names are made of, as written, once each: what a spell checker is told the world spells (D-1). */
export function nameWords(names: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of names) {
    for (const m of n.matchAll(WORD)) {
      const w = bare(m[0])
      if (!/\p{L}/u.test(w) || seen.has(w.toLowerCase())) continue
      seen.add(w.toLowerCase())
      out.push(w)
    }
  }
  return out
}

/** How the near-miss check decides (D-3), with the values measured on the Library. */
export interface NearMissRules {
  /** A word shorter than this is never a near miss, nor a name word one. */
  minLength: number
  /** Up to this length, one edit; longer, two. */
  oneEditUpTo: number
  /** A word the book uses this many times or more is one the writer means. */
  usedTimes: number
  /** Only a word with a capital, as names are written. */
  capitalOnly: boolean
  /** Only a word with the name's first letter. */
  sameFirst: boolean
}

/** Endings that make a word of a name: a family (the Barrys), a people or a style (Alaskan, Napoleonic). */
const DERIVED = ['s', 'es', 'n', 'an', 'ian', 'ic', 'ish', 'ese', 'ite']

export const NEAR_MISS_RULES: NearMissRules = { minLength: 5, oneEditUpTo: 7, usedTimes: 3, capitalOnly: true, sameFirst: true }

/**
 * The edits from `a` to `b` — a letter in, out, changed, or two beside each
 * other swapped (*Teodroa*, *Teodora*) — stopping once over `max`.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)]
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let d = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1)
      row.push(d)
      best = Math.min(best, d)
    }
    if (best > max) return max + 1
    rows.push(row)
  }
  return rows[a.length][b.length]
}

export interface NearMiss {
  /** Where the word is in the text, its possessive left out. */
  start: number
  end: number
  word: string
  /** The name word it is a near miss of, as the world writes it. */
  name: string
}

/** The words a check looks for, from the names: long enough, and not themselves ordinary words. */
export function namesToCheck(names: readonly string[], isCommon: (lower: string) => boolean, rules: NearMissRules = NEAR_MISS_RULES): string[] {
  return nameWords(names).filter((w) => w.length >= rules.minLength && !isCommon(w.toLowerCase()))
}

/**
 * The near misses of the world's names in a text (D-3): a word with no name
 * of its own, not an ordinary word, used fewer than `usedTimes` times in the
 * book, one edit from a name word — two for a long one — and with its first
 * letter. `known` is every name word, whatever its length; `used` how often
 * the book uses each word, lower case.
 */
export function nearMisses(
  text: string,
  check: readonly string[],
  known: ReadonlySet<string>,
  isCommon: (lower: string) => boolean,
  used: (lower: string) => number,
  rules: NearMissRules = NEAR_MISS_RULES,
): NearMiss[] {
  if (check.length === 0) return []
  const out: NearMiss[] = []
  const lowered = check.map((n) => ({ name: n, lower: n.toLowerCase() }))
  for (const t of tokens(text)) {
    const word = bare(t.text)
    const lower = word.toLowerCase()
    if (word.length < rules.minLength) continue
    if (rules.capitalOnly && !/^\p{Lu}/u.test(word)) continue
    if (known.has(lower) || isCommon(lower) || used(lower) >= rules.usedTimes) continue
    const max = word.length <= rules.oneEditUpTo ? 1 : 2
    let best: { name: string; d: number } | null = null
    for (const n of lowered) {
      if (rules.sameFirst && n.lower[0] !== lower[0]) continue
      // A family, or a word made from the name, not a misspelling: the Barrys, Alaskan, Napoleonic.
      if (lower.startsWith(n.lower) && DERIVED.includes(lower.slice(n.lower.length))) { best = null; break }
      const d = editDistance(lower, n.lower, max)
      if (d > 0 && d <= max && (!best || d < best.d)) best = { name: n.name, d }
    }
    if (best) out.push({ start: t.start, end: t.start + word.length, word, name: best.name })
  }
  return out
}

/** How often each word is used across texts, lower case and without possessives: `nearMisses`' `used`. */
export function wordUse(texts: Iterable<string>): Map<string, number> {
  const out = new Map<string, number>()
  for (const text of texts) for (const t of tokens(text)) {
    const k = bare(t.text).toLowerCase()
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

/** A near miss put right: the name in its place, keeping the word's case where it was all capitals. */
export function corrected(word: string, name: string): string {
  return word === word.toUpperCase() && word.length > 1 ? name.toUpperCase() : name
}
