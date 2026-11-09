/**
 * Emphasis in prose: underscores, as Project Gutenberg writes it, and asterisks.
 *
 * Every book in the Library carries its italics as `_like this_`, and the
 * manuscript printed the underscores. A blind reader run reading *The Count of
 * Monte Cristo* hit it on the first page; across the 41 shipped books there are
 * **6,304** such spans in 28 of them, from `_I_` to a 336-character run of
 * Melville's stage directions.
 *
 * Asterisks too, by the same rule (round-trip-plan.md, T2.1): a writer types
 * `*italic*`, and a writer run's draft had 19 such spans, which went to the
 * editor as asterisks. Not one paragraph of the Library's Gutenberg books reads
 * differently for it — measured over 51 books and 98,474 paragraphs
 * (`npm run probe:emphasis`), 150 of which have an asterisk: footnote marks,
 * `* * *` lines, Gutenberg's NIND markers. The 32 that do are all in *The
 * Undersong*, an original book written with asterisks, whose italics had
 * shown as asterisks until then. An asterisk beside another is never one
 * (`**bold**`, `f***`), so a line of asterisks and spaces, `* * *`, can open
 * nothing: each is followed by a space or another.
 *
 * The rule is CommonMark's, including the part that looks like a shortcoming:
 * an underscore with word characters on both sides is neither an opener nor a
 * closer, so `snake_case` survives, and so does Dracula's `C_{2}HCl_{3}O`. The
 * cost is Gutenberg's intraword italics — `21_st_`, `_Un_important`,
 * `_my_self` — which stay literal. That is 209 underscores against 6,304 spans
 * rendered, and the alternative turns a chemical formula into italics and back
 * mid-word.
 */

const WORD = /[\p{L}\p{N}_]/u

/** What can wrap emphasis: Gutenberg's underscores, and the asterisks writers type. */
export type Delimiter = '_' | '*'
const DELIMITERS: readonly Delimiter[] = ['_', '*']

const isWord = (c: string | undefined) => c !== undefined && WORD.test(c)
const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c)

export interface ProseSpan {
  /** The text itself, with the delimiters removed. */
  text: string
  /** Whether it was wrapped in underscores. */
  em: boolean
}

/**
 * Find the closing underscore for one opened at `open`, or -1.
 *
 * Bounded by the paragraph: emphasis never spans a paragraph break in any
 * shipped book — parsing whole scenes and parsing paragraph by paragraph leave
 * the same 209 underscores literal. A single line break is inside the
 * paragraph, though: a verse set in italics, `_line one⏎line two_`, printed
 * its underscores when this stopped at the line (writer run 8). Measured on
 * the shipped books, crossing one renders 96 more spans in 86,719 paragraphs —
 * Gutenberg's italics broken by its own hard wrap, *The⏎Black Arrow* — the
 * longest 76 characters, so no run-away pairing.
 */
function findCloser(text: string, open: number, d: Delimiter): number {
  for (let j = open + 1; j < text.length; j++) {
    const c = text[j]
    if (c === '\n' && (text[j + 1] === '\n' || (text[j + 1] === '\r' && text[j + 2] === '\n'))) return -1
    if (c !== d) continue
    // Intraword: not a delimiter at all, so keep looking rather than give up.
    if (isWord(text[j - 1]) && isWord(text[j + 1])) continue
    // An asterisk beside another is not one alone: `**bold**`, `f***`.
    if (d === '*' && (text[j - 1] === '*' || text[j + 1] === '*')) continue
    // No emptiness check: the caller only opens on a non-underscore, so the
    // first `_` this can reach is at least two along. A `j > open + 1` guard
    // here read as behaviour and was never once false — a mutation run caught
    // it by leaving it out and changing nothing.
    const closes = !isSpace(text[j - 1]) && !isWord(text[j + 1])
    return closes ? j : -1
  }
  return -1
}

/**
 * Split prose into runs of plain and emphasised text.
 *
 * Always returns at least one span for non-empty input, and joining every
 * span's `text` returns the input with only the delimiters of matched pairs
 * removed — an unmatched underscore is part of the prose and stays there.
 */
export function emphasisSpans(text: string, delimiters: readonly Delimiter[] = DELIMITERS): ProseSpan[] {
  const out: ProseSpan[] = []
  let plain = ''
  let i = 0

  const flush = () => {
    if (plain) out.push({ text: plain, em: false })
    plain = ''
  }

  while (i < text.length) {
    const d = text[i] as Delimiter
    const next = text[i + 1]
    const opens =
      delimiters.includes(d) &&
      !isWord(text[i - 1]) &&
      text[i - 1] !== d &&
      next !== undefined &&
      next !== d &&
      !isSpace(next)

    if (opens) {
      const close = findCloser(text, i, d)
      if (close > 0) {
        flush()
        out.push({ text: text.slice(i + 1, close), em: true })
        i = close + 1
        continue
      }
    }
    plain += text[i]
    i++
  }
  flush()
  return out
}

/**
 * The same spans as markup, for the compiled formats.
 *
 * The escaper is the caller's, because HTML and XHTML disagree about quotes and
 * each already has one. It runs on the span text only — never on the tags —
 * which is the whole reason this is not a string replace over escaped output.
 */
export function emphasisMarkup(text: string, escape: (s: string) => string): string {
  return emphasisSpans(text)
    .map((s) => (s.em ? `<em>${escape(s.text)}</em>` : escape(s.text)))
    .join('')
}
