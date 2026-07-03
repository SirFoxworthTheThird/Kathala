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

/** A character detected by name in a scene's prose. */
export interface DetectedMention {
  characterId: string
  name: string
  /** Number of times the name appears. */
  count: number
}

/**
 * Find which characters are named in a scene's prose, matching on full name and
 * on the first name as a whole word (case-insensitive). Pure string matching —
 * no AI. Sorted by descending mention count, then name.
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

    // Prose usually refers to a character by first name; fall back to the full
    // name for mononyms. Match the stored (capitalized) form case-SENSITIVELY as
    // a whole word, so proper-noun "Will" counts but the verb "will" does not.
    const firstToken = name.split(/\s+/)[0]
    const alias = firstToken.length >= 3 ? firstToken : name

    const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g')
    const matches = text.match(re)
    const count = matches ? matches.length : 0

    if (count > 0) results.push({ characterId: c.id, name, count })
  }

  return results.sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
}
