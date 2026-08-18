import type { Character } from '@/types'

/** Count words in a prose string. Whitespace-delimited, punctuation-tolerant. */
export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Escape a string for safe inclusion in a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Forms of address that are never the name itself.
 *
 * `detectMentions` keyed on the first word of a character's name, which for
 * anyone with a title means it keyed on the title. Counted across the 25
 * shipped library worlds, 136 first tokens are shared by two or more of the 760
 * characters, and the worst offenders are all of this kind: **The** (48
 * characters), **Mr** (22), **Mrs** (21), **Master** (18), **Captain** (11),
 * **Sir** (9), **Lord** (7), **Lady** (6). Pasting *Pride and Prejudice*'s
 * opening produced seven nudge chips — Forster, Gardiner, Hill, Jenkinson,
 * Philips, Reynolds, Younge — every one of them off a single "Mrs." (**F-4**.)
 *
 * Two-letter titles were already safe by accident: the existing rule falls back
 * to the full name for a first token under three characters, which is why "Mr"
 * never misbehaved and "Mrs" did.
 *
 * Deliberately a fixed list rather than a per-world setting. It is English and
 * it is incomplete — a world with Maesters or Septas that this list has not
 * heard of is no worse off than it was before this change, since the fallback
 * is exactly the old behaviour. Making it editable is a feature rather than a
 * bug fix, and should be asked for rather than assumed.
 */
const HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'mx', 'miss', 'dr', 'doctor', 'prof', 'professor',
  'sir', 'ser', 'dame', 'madam', 'madame', 'monsieur', 'mademoiselle', 'señor', 'señora', 'herr', 'frau',
  'lord', 'lady', 'king', 'queen', 'prince', 'princess', 'duke', 'duchess',
  'count', 'countess', 'baron', 'baroness', 'earl', 'emperor', 'empress',
  'captain', 'capt', 'commander', 'colonel', 'major', 'general', 'admiral',
  'sergeant', 'sgt', 'lieutenant', 'lt', 'corporal', 'inspector', 'constable',
  'father', 'mother', 'brother', 'sister', 'reverend', 'rev', 'bishop', 'cardinal',
  'rabbi', 'imam', 'abbot', 'friar', 'saint', 'st',
  'master', 'mistress', 'maester', 'septa', 'septon', 'aunt', 'uncle',
])

/** Articles, which begin an epithet rather than a name. */
const ARTICLES = new Set(['the', 'a', 'an'])

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)
const bare = (token: string) => token.toLowerCase().replace(/[.,]+$/, '')

/**
 * The first and last words of a name, which is how prose refers to someone when
 * it does not use the whole thing — *Teodor* or *Sarn* for Teodor Sarn.
 *
 * The last word is new, and it is only safe because `castAliases` throws away
 * any single word two characters would both answer to. On its own it would put
 * every Bennet in the room on the screen.
 *
 * The three-character floor is the pre-existing rule and is kept: a word that
 * short is not distinctive enough to hunt for by itself.
 */
function bareTokens(tokens: string[]): string[] {
  if (tokens.length < 2) return []
  const ends = [tokens[0], tokens[tokens.length - 1]]
  return ends.filter((t) => t.length >= 3 && !HONORIFICS.has(bare(t)))
}

/**
 * Every form of a character's name worth looking for in prose, longest first.
 *
 * - The **full name** as stored, always.
 * - The name with a leading title removed, so "Mrs Bennet" is findable as
 *   *Bennet* and "Dr Henry Jekyll" as *Henry Jekyll*.
 * - Its **first and last words**, which is how prose refers to someone when it
 *   does not use the whole thing.
 *
 * **An epithet keeps its shape.** A name beginning with an article — "The
 * Sorting Hat", "The Watcher in the Water", 48 characters in the library — gives
 * up the article and nothing else. Splitting words off it would put *Sorting*
 * and *Watcher* into the matcher, which are ordinary words in the prose those
 * characters appear in.
 *
 * These are **candidates**. Every single word here is subject to `castAliases`,
 * which drops the ones more than one character would answer to — without that
 * pass, deriving a last word would nudge every Bennet in the book.
 */
export function nameAliases(name: string): string[] {
  const tokens = words(name)
  if (tokens.length === 0) return []

  const full = tokens.join(' ')
  const aliases = [full]

  const lead = bare(tokens[0])
  const rest = tokens.slice(1)

  if (rest.length > 0 && ARTICLES.has(lead)) {
    aliases.push(rest.join(' '))
  } else if (rest.length > 0 && HONORIFICS.has(lead)) {
    aliases.push(rest.join(' '))
    aliases.push(...bareTokens(rest))
  } else {
    aliases.push(...bareTokens(tokens))
  }

  // Longest first: the alternation below is scanned left to right, so "Mrs
  // Bennet" must be tried before "Bennet" or one mention would count as two.
  return [...new Set(aliases)].sort((a, b) => b.length - a.length)
}

/**
 * One alias as a regex fragment.
 *
 * Words are joined with `\s+` so a name that breaks across a line still
 * matches, and a leading title may carry a full stop or not: records hold
 * "Mr Bennet" while prose writes "Mr. Bennet", and without this the full name
 * would miss the only form Austen ever uses. The stored token's own full stop is
 * normalised away first so it works in both directions.
 */
function aliasPattern(alias: string): string {
  const [first, ...rest] = alias.split(/\s+/)
  const head = HONORIFICS.has(bare(first))
    ? `${escapeRegExp(first.replace(/\.$/, ''))}\\.?`
    : escapeRegExp(first)
  return [head, ...rest.map(escapeRegExp)].join('\\s+')
}

/** A character detected by name in a scene's prose. */
export interface DetectedMention {
  characterId: string
  name: string
  /** Number of times the name appears. */
  count: number
}

/**
 * The forms of a name that actually identify **this** character, per character.
 *
 * Two rules, and the order between them is the point.
 *
 * **What the author wrote wins.** `Character.aliases` — the *Also known as*
 * field — is matched as given and is never filtered. 174 of the 760 characters
 * in the shipped library already carry one, *Barliman Butterbur → "Butterbur"*
 * among them, which is exactly the case **F-4** reported as a miss; the matcher
 * simply was not reading the field. An author who writes two aliases the same
 * has said what they meant.
 *
 * **A guess that fits two people is not a name.** Every *derived* single word is
 * dropped when more than one character in the cast would answer to it. Stripping
 * titles fixed one subset of this — *Mrs*, *The*, *Master* — and left the rest:
 * measured on the shipped library after that fix, **47 characters across 14
 * worlds** still shared a derived single word with a castmate. `John` in *Jane
 * Eyre*, `Bill` in both *Fellowship* and *Two Towers*, `Hawkins` and `Tom` in
 * *Treasure Island*. Neither John is identified by "John", and offering both is
 * worse than offering neither, because the full names still match.
 *
 * A derived word also yields to an author's alias: if the author has said "Bill"
 * means the pony, Bill Ferny does not get to claim it by having that first name.
 *
 * **This makes matching depend on the cast, which is a real consequence.** Add a
 * second Bennet and the bare surname stops nudging the first. That is the rule
 * working — once two people share a name, the name has stopped picking one out —
 * but it means the same prose and the same character can match differently
 * before and after an unrelated edit, so it is tested rather than assumed.
 */
export function castAliases(
  characters: readonly Pick<Character, 'id' | 'name' | 'aliases'>[],
): Map<string, string[]> {
  const derived = new Map<string, string[]>()
  const claims = new Map<string, number>()
  const count = (word: string) => claims.set(word, (claims.get(word) ?? 0) + 1)

  for (const c of characters) {
    const own = nameAliases(c.name ?? '')
    derived.set(c.id, own)
    for (const a of own) if (!a.includes(' ')) count(a)
    // An author alias occupies the word too, so a derived word cannot take it.
    for (const a of (c.aliases ?? [])) if (a.trim() && !a.trim().includes(' ')) count(a.trim())
  }

  const out = new Map<string, string[]>()
  for (const c of characters) {
    const stated = (c.aliases ?? []).map((a) => a.trim()).filter(Boolean)
    /*
      Only single words are ever counted as claims, so a full name — which is
      not a guess — survives by construction rather than by a branch here. A
      stated alias survives the same way, since it is unioned in below whatever
      happens to the derived copy of it. Both had explicit branches at first and
      the mutation sweep showed nothing could reach either.
    */
    const kept = (derived.get(c.id) ?? []).filter((a) => (claims.get(a) ?? 0) < 2)
    out.set(c.id, [...new Set([...stated, ...kept])].sort((a, b) => b.length - a.length))
  }
  return out
}

/**
 * Find which characters are named in a scene's prose, matching every form of
 * the name that `nameAliases` derives, as whole words and case-SENSITIVELY.
 * Pure string matching — no AI. Sorted by descending mention count, then name.
 *
 * This powers "you wrote Kael into this scene but he isn't on the scene" nudges
 * and one-click involvement, closing the gap between the metadata and the words.
 */
export function detectMentions(text: string, characters: Character[]): DetectedMention[] {
  if (!text.trim()) return []

  const byCharacter = castAliases(characters)
  const results: DetectedMention[] = []
  for (const c of characters) {
    const name = c.name.trim()
    if (!name) continue

    const aliases = byCharacter.get(c.id) ?? []
    if (aliases.length === 0) continue

    /*
      One alternation over every form of the name, longest first, matched
      case-SENSITIVELY as whole words — so the proper noun "Will" counts and the
      verb "will" does not, which is the rule this has always had.

      One pattern rather than one per alias, because the matches must not
      overlap: "Mrs Bennet" in the prose is one mention, and counting each alias
      separately would score it twice. `\s+` between words lets a name that
      breaks across a line still match.
    */
    const pattern = aliases.map(aliasPattern).join('|')
    const re = new RegExp(`\\b(?:${pattern})\\b`, 'g')
    const matches = text.match(re)
    const count = matches ? matches.length : 0

    if (count > 0) results.push({ characterId: c.id, name, count })
  }

  return results.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
}
