/**
 * Pure text find/replace used by the manuscript-wide Find & Replace panel.
 * Builds a global RegExp from a plain-text query (escaped, so it's literal) with
 * optional case-insensitivity and whole-word matching, then counts / replaces.
 */

export interface FindOptions {
  caseSensitive: boolean
  wholeWord: boolean
}

/** Escape a string so it matches literally inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A global RegExp for `query`, or null when the query is empty. */
export function buildQueryRegex(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null
  let pattern = escapeRegExp(query)
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`
  const flags = opts.caseSensitive ? 'g' : 'gi'
  return new RegExp(pattern, flags)
}

/** Number of matches of `query` in `text`. */
export function countMatches(text: string, query: string, opts: FindOptions): number {
  const re = buildQueryRegex(query, opts)
  if (!re) return 0
  let n = 0
  while (re.exec(text) !== null) {
    n++
    if (re.lastIndex === 0) break // zero-width guard (can't happen here, but safe)
  }
  return n
}

/** Replace every match of `query` with `replacement`; returns the new text and count. */
export function replaceAll(
  text: string,
  query: string,
  replacement: string,
  opts: FindOptions,
): { text: string; count: number } {
  const re = buildQueryRegex(query, opts)
  if (!re) return { text, count: 0 }
  let count = 0
  // Use a function replacer so `replacement` is treated literally ($ has no
  // special meaning) and we can count as we go.
  const next = text.replace(re, () => { count++; return replacement })
  return { text: next, count }
}

export interface MatchSnippet {
  before: string
  match: string
  after: string
}

/** Up to `max` context snippets around matches, for a preview. */
export function matchSnippets(
  text: string,
  query: string,
  opts: FindOptions,
  context = 32,
  max = 3,
): MatchSnippet[] {
  const re = buildQueryRegex(query, opts)
  if (!re) return []
  const out: MatchSnippet[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null && out.length < max) {
    const start = m.index
    const end = start + m[0].length
    out.push({
      before: (start - context > 0 ? '…' : '') + text.slice(Math.max(0, start - context), start),
      match: m[0],
      after: text.slice(end, end + context) + (end + context < text.length ? '…' : ''),
    })
    if (re.lastIndex === m.index) re.lastIndex++ // zero-width guard
  }
  return out
}

/** Does `name` equal `query` under the given options? (for character-rename offers) */
export function nameMatchesQuery(name: string, query: string, opts: FindOptions): boolean {
  if (!query) return false
  return opts.caseSensitive ? name === query : name.toLowerCase() === query.toLowerCase()
}
