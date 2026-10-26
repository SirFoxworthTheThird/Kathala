import type { Character } from '@/types'
import { mentionSpans, type NameSpan } from './manuscript'

/*
  A header line suggested from a scene's prose (next-plan.md, Part D1): what
  the prose already says that the header would have the writer type again.

  Pure string matching, no AI, and offered only as far as it has been measured
  to be right: on the Library's books, against the headers their curators
  wrote (`scripts/suggest-probe.ts`, `docs/records/part-d1-suggestions.md`).
  Of the four kinds the plan started with, one passed — who is in the scene,
  read from who speaks in it. Places named, items said to change hands and
  deaths said outright were measured too, and were too often wrong to offer;
  their rules are in the probe, not here.
*/

/** The people a suggestion can name, as `detectMentions` matches them. */
export type SuggestPeople = readonly Pick<Character, 'id' | 'name' | 'aliases' | 'nameChanges'>[]

/** Speech said of whoever is named beside it: "said Bruno", "Bruno replied". */
export const SAID = /\b(?:said|says|asked|asks|replied|replies|answered|cried|exclaimed|whispered|shouted|muttered|called|added|continued|returned|observed|remarked)\b/

/** How close, in characters either side of a name, a word of speech has to be to be said of them. */
const SAID_NEAR = 24

/**
 * Times somebody has to be said to speak before they are offered as in the
 * scene. Twice, measured: once, a whole suggested line was right 64% of the
 * time on the books it was tuned on; twice, 80% (74% on books held out from
 * tuning, 96% on the writer runs' own).
 */
export const SPEAKS_MIN = 2

/** Sentences of the prose, each with where it starts: speech is said of somebody within one. */
export function sentences(text: string): Array<{ at: number; text: string }> {
  const out: Array<{ at: number; text: string }> = []
  for (const m of text.matchAll(/[^.!?\n]+(?:[.!?]+["”’)]*|\n|$)/g)) if (m[0].trim()) out.push({ at: m.index, text: m[0] })
  return out
}

/** The names in `spans` that fall in sentence `s`, at their offsets in it, in order. */
export function inSentence(spans: ReadonlyMap<string, readonly NameSpan[]>, s: { at: number; text: string }) {
  const out: Array<{ id: string; at: number; length: number }> = []
  for (const [id, list] of spans) for (const sp of list) if (sp.at >= s.at && sp.at < s.at + s.text.length) out.push({ id, at: sp.at - s.at, length: sp.length })
  return out.sort((a, b) => a.at - b.at)
}

/** How many times each person named in the prose is said to speak there. */
export function speakers(text: string, people: SuggestPeople, others: readonly string[] = []): Map<string, number> {
  const named = mentionSpans(text, people, others)
  const out = new Map<string, number>()
  for (const s of sentences(text)) {
    for (const n of inSentence(named, s)) {
      const near = s.text.slice(Math.max(0, n.at - SAID_NEAR), n.at + n.length + SAID_NEAR)
      if (SAID.test(near)) out.set(n.id, (out.get(n.id) ?? 0) + 1)
    }
  }
  return out
}

/**
 * Who a scene's prose has speaking often enough to be in it, and whom its
 * header does not account for: neither in its cast, nor mentioned, nor there
 * from elsewhere. Most-speaking first. `others` are the world's places and
 * items, by name (see `detectMentions`).
 */
export function suggestCast(
  text: string,
  people: SuggestPeople,
  accounted: Iterable<string>,
  others: readonly string[] = [],
): string[] {
  const known = new Set(accounted)
  return [...speakers(text, people, others)]
    .filter(([id, n]) => n >= SPEAKS_MIN && !known.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
}

/**
 * A scene's header with `names` added to its cast, as the writer would have
 * typed them: `@@Name` at the end of a one-line header, or on a block's
 * Characters line — made, if the block has none. With no header, a line of
 * them.
 */
export function withCast(header: string | null, names: readonly string[]): string {
  const tokens = names.map((n) => `@@${n}`).join(' ')
  if (!header?.trim()) return `[${tokens}]`
  const lines = header.split('\n')
  if (lines.length === 1) return header.replace(/\s*\]\s*$/, ` ${tokens}]`)
  const cast = lines.findIndex((l) => /^\s*Characters\s*:/i.test(l))
  if (cast >= 0) {
    lines[cast] = `${lines[cast].replace(/\s+$/, '')} ${tokens}`
    return lines.join('\n')
  }
  // After the Place line where there is one, as the block draws it; else first.
  const place = lines.findIndex((l) => /^\s*Place\s*:/i.test(l))
  lines.splice(place >= 0 ? place + 1 : 1, 0, `  Characters: ${tokens}`)
  return lines.join('\n')
}
