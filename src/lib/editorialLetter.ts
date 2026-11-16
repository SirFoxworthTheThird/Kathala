import { castAliases } from '@/lib/manuscript'
import type { Character, TaskLink } from '@/types'

/*
  An editorial letter, split into tasks (editorial-plan.md, R5). Pasted as it
  came — an email, a Word document's text — and split where the editor split
  it: at each bullet or numbered point, and between paragraphs. A short line
  standing over points is their heading, and every task under it keeps it as
  its group. A greeting and a sign-off are split out too, and offered unkept:
  they are not work. The writer keeps, merges or drops each before any is made.

  Nothing here is a judgement about what the letter means. It is cut where it
  is visibly cut, and the writer decides the rest.
*/

export interface LetterItem {
  text: string
  /**
   * A heading over the points after it, not a point itself. A guess, from how
   * the line looks, so the writer sees it and can make it a point instead.
   */
  heading: boolean
  /** Offered to be made into a task. A greeting or sign-off is not. */
  keep: boolean
  /** A heading that is a sentence introducing the points under it ("Three things on pace:"): it stands over those points only. */
  intro?: boolean
  /** A bullet or numbered point, as the letter marked it. */
  marker?: boolean
}

/** A bullet or a numbered point, and what follows its marker. */
const MARKER = /^\s*(?:[-*•–—·▪◦‣]|\(?\d{1,3}[.)]|\(\d{1,3}\)|\(?[a-z][.)])\s+(.*)$/i
const MD_HEADING = /^\s*#{1,6}\s+(.*?)\s*#*\s*$/
const GREETING = /^(?:dear|hi|hello|hey|greetings)\b/i
// "With best wishes," as well as "Best wishes," (round-trip-plan.md, T3).
const SIGN_OFF = /^(?:with\s+)?(?:best|all best|all the best|warmly|warm wishes|warm regards|regards|kind regards|best wishes|thanks|many thanks|thank you|cheers|yours|love|talk soon|speak soon|until soon|onward|onwards)\b/i
/** A numbered line, and its words: `1. THE CLOCK`, `2) Pacing`. */
const NUMBERED = /^\s*\(?\d{1,3}[.)]\s+(.*)$/

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/**
 * A line that can stand over points: short, and not a sentence. A question
 * in capitals is a heading too — "DOES THE CLOCK HOLD?" — where one in
 * ordinary case is a question to answer (round-trip-plan.md, T3).
 */
function headingLike(line: string, longest = 60): boolean {
  const t = line.trim()
  if (!t || t.length > longest || MARKER.test(t)) return false
  const capitals = /\p{L}/u.test(t) && t === t.toUpperCase()
  if (/[.!,;]$/.test(t) || (t.endsWith('?') && !capitals)) return false
  // A heading ends at a colon or with no stop; its first letter is a capital or a digit.
  return /^[\p{Lu}\p{N}"“‘'*_]/u.test(t)
}

/** The next line with words in it, after `i`. */
const nextWords = (lines: readonly string[], i: number) => lines.slice(i + 1).find((l) => l.trim()) ?? ''

/** `said`: a heading's line as it was written, for when it turns out to stand over nothing. */
interface Raw { text: string; heading?: boolean; said?: string; intro?: boolean; marker?: boolean; table?: string[] }

/** A line set in from the margin, as a table's rows are: with spaces, or a tab, before it. */
const INDENTED = /^(?: {2,}|\t)\S/

/** The letter's pieces in order: points, paragraphs and heading candidates. */
function pieces(letter: string): Raw[] {
  const lines = letter.replace(/\r\n?/g, '\n').split('\n')
  const out: Raw[] = []
  // A numbered line alone over prose, as a numbered heading stands: "1. THE CLOCK", then a blank line, then a paragraph.
  const standsAlone = (i: number) => !(lines[i + 1] ?? '').trim() && !!nextWords(lines, i) && !MARKER.test(nextWords(lines, i))
  /*
    Among numbered headings, a longer one is a heading too, where it is no
    sentence: "1. The scheme: told too often, and never quite pinned down (your
    question 1)", 74 characters, was a task under the third loop's letter where
    the others were headings (round-trip-plan-4.md, T20).
  */
  const numberedHeadings = lines.filter((l, i) => { const n = NUMBERED.exec(l); return !!n && headingLike(n[1]) && standsAlone(i) }).length
  const longest = numberedHeadings > 0 ? 120 : 60
  let current: Raw | null = null
  const end = () => {
    // A table keeps its rows as lines: run together, "4th night of the gale ~5th a man in the Gull" read as one sentence (round-trip-plan-3.md, T11.2).
    if (current?.table && current.table.length > 1) out.push({ text: current.table.map(squash).join('\n') })
    else if (current && squash(current.text)) out.push({ ...current, text: squash(current.text) })
    current = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) { end(); continue }
    const md = MD_HEADING.exec(line)
    if (md) { end(); out.push({ text: squash(md[1]), heading: true }); continue }
    const next = lines[i + 1] ?? ''
    /*
      A numbered line standing alone over paragraphs is a numbered heading —
      "1. THE CLOCK" — not a point: a short line, not a sentence, with a blank
      line after it and prose, not another point, after that. Taken for a
      point, every task under it was filed under the heading before.
    */
    const numbered = NUMBERED.exec(line)
    if (numbered && current === null && headingLike(numbered[1], longest) && !/[.!?…]["”’)]*\s+\p{Lu}/u.test(numbered[1]) && standsAlone(i)) {
      out.push({ text: squash(numbered[1]).replace(/:$/, ''), heading: true, said: squash(line) })
      continue
    }
    const marker = MARKER.exec(line)
    if (marker) { end(); current = { text: marker[1], marker: true }; continue }
    // A line, alone or at the head of points, that reads as a heading — unless it comes straight after one.
    const startsBlock = current === null
    const underHeading = out.length > 0 && out[out.length - 1].heading === true
    if (startsBlock && !underHeading && headingLike(line) && (!next.trim() || MARKER.test(next))) {
      out.push({ text: squash(line).replace(/:$/, ''), heading: true, said: squash(line) })
      continue
    }
    // A sentence that introduces the points under it ("Three things on pace:").
    if (startsBlock && /:\s*$/.test(line) && MARKER.test(next) && line.trim().length <= 120) {
      out.push({ text: squash(line).replace(/:$/, ''), heading: true, said: squash(line), intro: true })
      continue
    }
    /*
      Rows set in from the margin, one under another: a table, as an editor
      lays out a calendar with spaces. Kept as one point, a row a line.
    */
    if (INDENTED.test(line) && (current === null || current.table)) {
      current = current ? { text: `${current.text} ${line}`, table: [...current.table!, line] } : { text: line, table: [line] }
      continue
    }
    if (current) current.text += ' ' + line
    else current = { text: line }
  }
  end()
  return out
}

export function splitLetter(letter: string): LetterItem[] {
  const raw = pieces(letter)
  const items: LetterItem[] = raw.map((p, i) => {
    /*
      A heading with nothing under it before the next heading, or the end, is
      a point of its own. Not where the heading under it is a lesser one: a
      sentence introducing points ("These are all in the margins:"), or one
      not in capitals under one that is ("WHAT MOST NEEDS WORK" over "1. The
      letter that nobody asks for"). Those lost their heading to the line under
      them, and were filed as tasks (round-trip-plan-3.md, T11.2).
    */
    const next = raw[i + 1]
    const capitals = (t: string) => /\p{L}/u.test(t) && t === t.toUpperCase()
    const over = !!p.heading && next !== undefined && (!next.heading || !!next.intro || (capitals(p.text) && !capitals(next.text)))
    return { text: over ? p.text : p.said ?? p.text, heading: over, keep: true, ...(over && p.intro ? { intro: true } : {}), ...(p.marker ? { marker: true } : {}) }
  })
  /*
    The greeting, and anything above it — a letter's title, its date, who it
    is from and to, a title short enough to look like a heading — are not
    work. Looked for among the first few pieces, not only the first: both of
    a writer run's letters opened with a title line, and their "Dear Ruth,"
    was offered as a task (round-trip-plan.md, T3).
  */
  const greeting = items.slice(0, 4).findIndex((it) => GREETING.test(it.text) && it.text.length <= 60)
  for (let i = 0; i <= greeting; i++) items[i] = { ...items[i], keep: false, heading: false }
  /*
    The sign-off, and everything under it — the name, a second name, what
    they are — likewise; looked for among the last few pieces, since a
    signature can run to more than one line, and its name, short and with no
    stop, can look like a heading.
  */
  for (let i = items.length - 1; i >= Math.max(greeting + 1, items.length - 5); i--) {
    /*
      Short, or ending as a sign-off does, at a comma, however long the clause
      after it: "With warm regards, and thanks for a book I was glad to spend a
      week in," (T11.2). And by where it is, not only its words: a line near
      the end that opens "With" and ends at a comma is one, whatever the
      wishes: "With warm good wishes," was not a listed phrase, and it and the
      name under it were ticked as tasks in both of the third loop's letters
      (round-trip-plan-4.md, T20).
    */
    const t = items[i].text
    const closing = (SIGN_OFF.test(t) && (t.length <= 60 || t.endsWith(','))) || (/^with\b/i.test(t) && t.endsWith(','))
    if (!closing) continue
    const below = items.slice(i + 1)
    if (below.every((it) => it.text.length <= 60 && !/[.!?]$/.test(it.text))) {
      for (let k = i; k < items.length; k++) items[k] = { ...items[k], keep: false, heading: false }
    }
    break
  }
  return items
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec'
/** A date as a letter's head gives one: "14 November", "November 14th, 2026", "2026-11-14". */
const DATE = new RegExp(`\\b(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?(?:,?\\s+\\d{4})?|(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?|\\d{4}-\\d{2}-\\d{2})\\b`, 'i')
/** A name as it stands in a letter's head or under its sign-off: a few words, each with a capital. */
const NAME = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){0,3}$/u
const ORDINALS = ['', '', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/**
 * What a letter's tasks say they are from (round-trip-plan-4.md, T20): whose,
 * and which. The name typed for it, or read from its head ("Maren Hollis, 14
 * November") or its signature; the date its head gives; and, where a letter
 * from the same hand is already among the book's tasks, its round. Two of the
 * third loop's letters, both from Maren Hollis and both of 14 November, said
 * only "From the letter: Maren Hollis", and the writer could not say which
 * round asked for what.
 *
 * `earlier`: what the book's letters already say they are. A name typed with
 * its own date in it is taken as it is, its round added only where it is
 * already used.
 */
export function letterName(letter: string, typed: string, earlier: readonly string[]): string {
  const lines = letter.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)
  const greeting = lines.slice(0, 5).findIndex((l) => GREETING.test(l))
  const head = greeting > 0 ? lines.slice(0, greeting) : []
  const dated = head.find((l) => DATE.test(l))
  const date = dated ? DATE.exec(dated)![0] : null
  // Whose, before the date: "Maren Hollis, 14 November", or "Margit Hale to Ruth Callan, 9 November 2026".
  const before = dated ? dated.slice(0, DATE.exec(dated)!.index).replace(/[\s,;:–—-]+$/, '').replace(/\s+to\s+.*$/i, '') : ''
  const signed = lines.at(-1) ?? ''
  const typedName = typed.trim()
  const who = typedName || (NAME.test(before) ? before : NAME.test(signed) && signed.length <= 30 ? signed : '')
  const same = (l: string) => !!who && (l === who || l.startsWith(`${who}’s `) || l.startsWith(`${who},`))
  const round = 1 + new Set(earlier.filter(same)).size
  const nth = ORDINALS[round] ?? `${round}th`
  if (typedName && DATE.test(typedName)) return round > 1 && earlier.includes(typedName) ? `${typedName}, the ${nth} letter` : typedName
  if (!who) return date ? `the letter of ${date}` : 'an editorial letter'
  if (round > 1) return `${who}’s ${nth} letter${date ? `, of ${date}` : ''}`
  return `${who}’s letter${date ? ` of ${date}` : ''}`
}

/** A point made a heading, where the guess missed one: it stands over the points after it until the next heading. */
export function makeHeading(items: readonly LetterItem[], index: number): LetterItem[] {
  return items.map((it, k) => (k === index ? { text: it.text, heading: true, keep: true } : it))
}

/** The tasks a split letter makes: each point kept, under the heading before it. */
export function lettersTasks(items: readonly LetterItem[]): Array<{ text: string; group?: string }> {
  const out: Array<{ text: string; group?: string }> = []
  // The heading of the section, and the group a point is in: a sentence introducing points groups those points only.
  let section: string | undefined
  let group: string | undefined
  let introduced = false
  for (const it of items) {
    if (it.heading) {
      group = it.text
      introduced = !!it.intro
      if (!it.intro) section = it.text
      continue
    }
    // The points it introduced have ended: what follows is the section's again (round-trip-plan.md, T3).
    if (introduced && !it.marker) { group = section; introduced = false }
    if (it.keep && it.text.trim()) out.push({ text: it.text.trim(), ...(group ? { group } : {}) })
  }
  return out
}

/** The point at `index` joined onto the point before it: the editor made two points of what is one. */
export function mergeWithPrevious(items: readonly LetterItem[], index: number): LetterItem[] {
  if (index <= 0 || index >= items.length || items[index].heading || items[index - 1].heading) return [...items]
  const before = items[index - 1]
  const joined: LetterItem = { ...before, text: `${before.text} ${items[index].text}`, keep: before.keep || items[index].keep }
  return [...items.slice(0, index - 1), joined, ...items.slice(index + 1)]
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
}
const NUM = `(?:\\d{1,3}|${Object.keys(NUMBER_WORDS).join('|')})`
/*
  "ch." may run straight into its number, as an editor's shorthand does: "ch.3"
  (round-trip-plan-2.md, T7.6; R2-4). And "Ch3", with no stop and no space, a
  number in figures after it: the third loop's editor wrote every chapter so,
  and 16 of the 18 tasks from her first letter that named one were linked to
  none (round-trip-plan-4.md, T20).
*/
const CHAPTERS = new RegExp(`\\b(?:chapters?\\s+|chs?\\.\\s*|chs?\\s+|chs?(?=\\d))(${NUM}(?:\\s*(?:[-–—]|to|through|and|&|,|or)\\s*${NUM})*)`, 'gi')

const toNumber = (s: string) => NUMBER_WORDS[s.toLowerCase()] ?? Number(s)

/** The chapter numbers a text names: "chapter 3", "ch. 12", "chapters 4 and 6", "chapters 3–5". */
export function chapterNumbers(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(CHAPTERS)) {
    const list = m[1]
    const parts = list.split(/\s*(?:,|and|&|or)\s*/i)
    for (const part of parts) {
      const range = part.split(/\s*(?:[-–—]|to|through)\s*/i).map(toNumber)
      if (range.length === 2 && range[0] < range[1] && range[1] - range[0] <= 50) {
        for (let n = range[0]; n <= range[1]; n++) out.push(n)
      } else out.push(...range)
    }
  }
  return [...new Set(out.filter((n) => Number.isInteger(n) && n > 0))]
}

/**
 * What a task's words are about, offered as its links: the chapters it names
 * by number, and the characters it names, as the prose matcher would find
 * them (whole words, the case as written, a word two characters share not
 * counted for either). The writer keeps or removes each.
 */
export function suggestLinks(
  text: string,
  book: { chapters: ReadonlyArray<{ id: string; number: number }>; characters: ReadonlyArray<Pick<Character, 'id' | 'name' | 'aliases' | 'nameChanges'>> },
): TaskLink[] {
  const links: TaskLink[] = []
  for (const n of chapterNumbers(text)) {
    for (const c of book.chapters) if (c.number === n) links.push({ kind: 'chapter', id: c.id })
  }
  const aliases = castAliases(book.characters)
  const found: Array<{ id: string; at: number }> = []
  for (const c of book.characters) {
    let at = -1
    for (const name of aliases.get(c.id) ?? []) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const m = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').exec(text)
      if (m && (at < 0 || m.index < at)) at = m.index
    }
    if (at >= 0) found.push({ id: c.id, at })
  }
  found.sort((a, b) => a.at - b.at)
  return [...links, ...found.map((f) => ({ kind: 'character' as const, id: f.id }))]
}
