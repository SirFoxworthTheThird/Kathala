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
export function searchIndex(
  haystack: string | null | undefined,
  query: string,
  wholeWord: boolean,
): number {
  if (!haystack || !query) return -1
  if (!wholeWord) return haystack.toLowerCase().indexOf(query.toLowerCase())
  const re = new RegExp(`\\b${escapeRegExp(query)}\\b`, 'i')
  return haystack.search(re)
}

export function searchMatches(
  haystack: string | null | undefined,
  query: string,
  wholeWord: boolean,
): boolean {
  return searchIndex(haystack, query, wholeWord) !== -1
}
