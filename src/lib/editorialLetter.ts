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
}

/** A bullet or a numbered point, and what follows its marker. */
const MARKER = /^\s*(?:[-*•–—·▪◦‣]|\(?\d{1,3}[.)]|\(\d{1,3}\)|\(?[a-z][.)])\s+(.*)$/i
const MD_HEADING = /^\s*#{1,6}\s+(.*?)\s*#*\s*$/
const GREETING = /^(?:dear|hi|hello|hey|greetings)\b/i
const SIGN_OFF = /^(?:best|all best|all the best|warmly|warm wishes|warm regards|regards|kind regards|best wishes|thanks|many thanks|thank you|cheers|yours|love|talk soon|speak soon|until soon|onward|onwards)\b/i

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A line that can stand over points: short, and not a sentence. */
function headingLike(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 60 || MARKER.test(t)) return false
  if (/[.?!,;]$/.test(t)) return false
  // A heading ends at a colon or with no stop; its first letter is a capital or a digit.
  return /^[\p{Lu}\p{N}"“‘'*_]/u.test(t)
}

/** `said`: a heading's line as it was written, for when it turns out to stand over nothing. */
interface Raw { text: string; heading?: boolean; said?: string }

/** The letter's pieces in order: points, paragraphs and heading candidates. */
function pieces(letter: string): Raw[] {
  const lines = letter.replace(/\r\n?/g, '\n').split('\n')
  const out: Raw[] = []
  let current: Raw | null = null
  const end = () => { if (current && squash(current.text)) out.push({ ...current, text: squash(current.text) }); current = null }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) { end(); continue }
    const md = MD_HEADING.exec(line)
    if (md) { end(); out.push({ text: squash(md[1]), heading: true }); continue }
    const marker = MARKER.exec(line)
    if (marker) { end(); current = { text: marker[1] }; continue }
    const next = lines[i + 1] ?? ''
    // A line, alone or at the head of points, that reads as a heading — unless it comes straight after one.
    const startsBlock = current === null
    const underHeading = out.length > 0 && out[out.length - 1].heading === true
    if (startsBlock && !underHeading && headingLike(line) && (!next.trim() || MARKER.test(next))) {
      out.push({ text: squash(line).replace(/:$/, ''), heading: true, said: squash(line) })
      continue
    }
    // A sentence that introduces the points under it ("Three things on pace:").
    if (startsBlock && /:\s*$/.test(line) && MARKER.test(next) && line.trim().length <= 120) {
      out.push({ text: squash(line).replace(/:$/, ''), heading: true, said: squash(line) })
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
    // A heading with nothing under it before the next heading, or the end, is a point of its own.
    const over = !!p.heading && raw[i + 1] !== undefined && !raw[i + 1].heading
    return { text: over ? p.text : p.said ?? p.text, heading: over, keep: true }
  })
  // The greeting, and the sign-off with the name under it, are not work.
  const first = items.findIndex((it) => !it.heading)
  if (first >= 0 && GREETING.test(items[first].text) && items[first].text.length <= 60) items[first] = { ...items[first], keep: false }
  for (let i = items.length - 1; i >= 0 && i >= items.length - 3; i--) {
    const t = items[i].text
    // A name under a sign-off, on a line of its own.
    const isName = i === items.length - 1 && i > 0 && SIGN_OFF.test(items[i - 1].text) && items[i - 1].text.length <= 60
      && t.length <= 30 && !/[.?!:]$/.test(t) && t.split(' ').length <= 3
    if (items[i].heading || !((SIGN_OFF.test(t) && t.length <= 60) || isName)) break
    items[i] = { ...items[i], keep: false }
  }
  return items
}

/** The tasks a split letter makes: each point kept, under the heading before it. */
export function lettersTasks(items: readonly LetterItem[]): Array<{ text: string; group?: string }> {
  const out: Array<{ text: string; group?: string }> = []
  let group: string | undefined
  for (const it of items) {
    if (it.heading) { group = it.text; continue }
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
const CHAPTERS = new RegExp(`\\b(?:chapters?|chs?\\.?)\\s+(${NUM}(?:\\s*(?:[-–—]|to|through|and|&|,|or)\\s*${NUM})*)`, 'gi')

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
