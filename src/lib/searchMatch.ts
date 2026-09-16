import { escapeRegExp } from './findReplace'

/**
 * Where a search query matches, honouring "whole words".
 *
 * The palette matched inside words, so a fantasy writer searching `tin` was
 * handed a scene whose only hit was *cas**tin**g*, and `Bel` returned
 * *Bellhouse* and *bells* alongside *Bel Andry*. That is noise in proportion to
 * how short and invented your names are, which for this app's readers is very.
 *
 * It is an option rather than a change of behaviour: a partial-word search is
 * the right default for *"where did I write that"*, and Find & Replace has had
 * the same switch all along. The semantics are deliberately identical to it —
 * `\b` around an escaped literal — so a writer who has learned one has learned
 * the other.
 *
 * The *index* rather than a boolean, because the snippet under a prose result
 * and the highlight in a label both have to point at the match this found. They
 * used `indexOf`, which with whole words on would centre the snippet on an
 * earlier partial hit — the very match the writer asked not to be shown.
 */
/**
 * Accents folded away, without moving anything.
 *
 * A blind reader run typed `Dantes`, `Mercedes`, `Gerard`, `Renee` and was told
 * **No results** — for characters already on screen. Five of twelve ordinary
 * queries failed, the protagonist among them, and in reading mode "No results"
 * is indistinguishable from "hidden because you have not met them", which is
 * the one answer this app must never give by accident.
 *
 * Folded a character at a time rather than with `normalize('NFD')` over the
 * whole string, because `searchIndex` returns a position into the *original*
 * text and the snippet and the highlight both slice with it. Decomposing `è`
 * into `e` plus a combining mark makes the string longer and every index after
 * it wrong. A code point that does not fold to exactly one character is left
 * alone, so the length is always the length it was.
 */
function fold(text: string): string {
  let out = ''
  for (const ch of text) {
    const bare = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    out += bare.length === 1 ? bare : ch
  }
  return out
}

export function searchIndex(
  haystack: string | null | undefined,
  query: string,
  wholeWord: boolean,
): number {
  if (!haystack || !query) return -1
  const flat = fold(haystack)
  const needle = fold(query)
  if (!wholeWord) return flat.toLowerCase().indexOf(needle.toLowerCase())
  const re = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i')
  return flat.search(re)
}

export function searchMatches(
  haystack: string | null | undefined,
  query: string,
  wholeWord: boolean,
): boolean {
  return searchIndex(haystack, query, wholeWord) !== -1
}
