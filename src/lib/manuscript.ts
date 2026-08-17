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
 * Every form of a character's name worth looking for in prose, longest first.
 *
 * - The **full name** as stored, always.
 * - The name with a leading title removed, so "Mrs Bennet" is findable as
 *   *Bennet* and "Dr Henry Jekyll" as *Henry Jekyll*.
 * - Its **first word**, which is how prose usually refers to someone — subject
 *   to the pre-existing three-character floor.
 *
 * **An epithet keeps its shape.** A name beginning with an article — "The
 * Sorting Hat", "The Watcher in the Water", 48 characters in the library — gives
 * up the article and nothing else. Splitting a first word off it would put
 * *Sorting* and *Watcher* into the matcher, which are ordinary words in the
 * prose those characters appear in, and the whole point of this change is to
 * stop matching on a word that does not identify anybody.
 *
 * **What this deliberately does not do is match on a surname alone** for a name
 * with no title: "Teodor Sarn" is findable as *Teodor Sarn* and *Teodor*, and a
 * scene that says only *Sarn* still finds nothing. Catching that means deciding
 * a token is distinctive relative to the rest of the cast — which is a different
 * rule with a different failure (a family of Bennets would nudge every one of
 * them), and it is filed rather than smuggled in here.
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
    if (rest.length > 1 && rest[0].length >= 3) aliases.push(rest[0])
  } else if (tokens.length > 1 && tokens[0].length >= 3) {
    aliases.push(tokens[0])
  }

  // Longest first: the alternation below is scanned left to right, so "Mrs
  // Bennet" must be tried before "Bennet" or one mention would count as two.
  return [...new Set(aliases)].sort((a, b) => b.length - a.length)
}

/** A character detected by name in a scene's prose. */
export interface DetectedMention {
  characterId: string
  name: string
  /** Number of times the name appears. */
  count: number
}

/**
 * Find which characters are named in a scene's prose, matching every form of
 * the name that `nameAliases` derives, as whole words and case-SENSITIVELY.
 * Pure string matching — no AI. Sorted by descending mention count, then name.
 *
 * This powers "you wrote Kael into this scene but he isn't on the event" nudges
 * and one-click involvement, closing the gap between the metadata and the words.
 */
export function detectMentions(text: string, characters: Character[]): DetectedMention[] {
  if (!text.trim()) return []

  const results: DetectedMention[] = []
  for (const c of characters) {
    const name = c.name.trim()
    if (!name) continue

    const aliases = nameAliases(name)
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
    const pattern = aliases
      .map((a) => escapeRegExp(a).replace(/\\?\s+/g, '\\s+'))
      .join('|')
    const re = new RegExp(`\\b(?:${pattern})\\b`, 'g')
    const matches = text.match(re)
    const count = matches ? matches.length : 0

    if (count > 0) results.push({ characterId: c.id, name, count })
  }

  return results.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
}
