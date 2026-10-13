/**
 * The Markdown a lore page is written in, as far as its preview and its card
 * excerpt need it. The page says "Markdown supported", and the preview drew
 * headings, quotes and lists but left `**bold**` with its asterisks, while the
 * card's excerpt stripped every `-` with the asterisks — so writer run 9's
 * "salt-frost" read "saltfrost".
 *
 * Unlike prose (`proseEmphasis`, underscores only) a lore page is Markdown by
 * its own say-so, so asterisks are emphasis here.
 */

export interface InlineSpan {
  text: string
  strong?: boolean
  em?: boolean
  code?: boolean
}

/*
  `**x**` / `__x__`, then `*x*` / `_x_`, then `` `x` ``. A delimiter hugs its
  text, as CommonMark's flanking rule asks, so `2 * 3 * 4` stays arithmetic;
  and an underscore inside a word is not one, so `snake_case` stays.
*/
const INLINE = /(\*\*|__)(?=\S)([\s\S]*?\S)\1|(?<![\p{L}\p{N}])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}])|\*(?=[^\s*])([^*]*?[^\s*])\*|`([^`]+)`/gu

/** A line of lore Markdown as runs of plain, strong, emphasised and code text. */
export function inlineMarkdown(line: string): InlineSpan[] {
  const out: InlineSpan[] = []
  let last = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) })
    if (m[2] !== undefined) out.push({ text: m[2], strong: true })
    else if (m[3] !== undefined) out.push({ text: m[3], em: true })
    else if (m[4] !== undefined) out.push({ text: m[4], em: true })
    else out.push({ text: m[5], code: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last) })
  return out
}

/**
 * A lore page's opening as plain text, for a card: block marks taken off the
 * start of each line, inline ones off the text they wrap, and nothing else —
 * a hyphen in a word stays. At most `length` characters.
 */
export function markdownExcerpt(body: string, length: number): string {
  const plain = body
    .split('\n')
    .map((line) => line.replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, ''))
    .map((line) => inlineMarkdown(line).map((s) => s.text).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.slice(0, length).trim()
}
