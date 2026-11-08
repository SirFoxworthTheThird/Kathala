import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { emphasisSpans, type ProseSpan } from '@/lib/proseEmphasis'

/*
  A scene's prose as the prose checks read it (editorial-plan.md, R6): the
  text a reader sees — its paragraphs, with the italics' underscores gone —
  and where each paragraph and span of it is, so that what a check finds at
  an offset is found on the page at the same words.
*/

export interface PlainParagraph {
  /** Where it starts in the plain text. */
  start: number
  verse: boolean
  spans: Array<ProseSpan & { start: number }>
}

export interface PlainScene {
  /** The paragraphs' text, a blank line between each. */
  text: string
  paragraphs: PlainParagraph[]
}

export function plainScene(prose: string): PlainScene {
  const paragraphs: PlainParagraph[] = []
  let text = ''
  for (const p of paragraphBlocks(prose)) {
    if (text) text += '\n\n'
    const para: PlainParagraph = { start: text.length, verse: p.verse, spans: [] }
    for (const s of emphasisSpans(p.text)) {
      para.spans.push({ ...s, start: text.length })
      text += s.text
    }
    paragraphs.push(para)
  }
  return { text, paragraphs }
}

export interface Token {
  /** As written. */
  text: string
  /** Lower case, with a possessive ’s taken off. */
  key: string
  start: number
  end: number
  /** Its place among the scene's words. */
  index: number
  /** Whether it starts with a capital: a name, or a sentence's first word. */
  capital: boolean
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu

/*
  The words of the texts last asked for: the checks each read a scene's words,
  and a book's worth of tokenising is most of their time.
*/
const cache = new Map<string, Token[]>()

export function tokens(text: string): Token[] {
  const hit = cache.get(text)
  if (hit) return hit
  if (cache.size > 4000) cache.clear()
  const out = tokenize(text)
  cache.set(text, out)
  return out
}

function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(WORD)) {
    const t = m[0]
    out.push({
      text: t,
      key: t.toLowerCase().replace(/['’]s$/, ''),
      start: m.index,
      end: m.index + t.length,
      index: out.length,
      capital: /^\p{Lu}/u.test(t),
    })
  }
  return out
}

export interface Sentence {
  start: number
  end: number
  /** How many words it has. */
  words: number
  /** Whether it is spoken: it starts inside quotation marks, or with one. */
  spoken: boolean
}

/** Words ending in a full stop that do not end a sentence. */
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'jr', 'sr', 'vs', 'no', 'messrs', 'mme', 'mlle', 'capt', 'col', 'gen', 'lt', 'sgt', 'rev', 'prof', 'hon', 'esq', 'etc', 'viz', 'cf', 'ie', 'eg'])

/**
 * The sentences of a text: ended by `.`, `!` or `?` — with any closing quotes
 * and brackets after them — before a space, or by a paragraph's end. Not after
 * a title (Mr., Dr.) or an initial (J. R.).
 */
const sentenceCache = new Map<string, Sentence[]>()

export function sentences(text: string): Sentence[] {
  const hit = sentenceCache.get(text)
  if (hit) return hit
  if (sentenceCache.size > 4000) sentenceCache.clear()
  const out = splitSentences(text)
  sentenceCache.set(text, out)
  return out
}

function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = []
  const quoted = insideQuotes(text)
  let start = 0
  const close = (end: number) => {
    const raw = text.slice(start, end)
    const lead = raw.length - raw.trimStart().length
    const body = raw.trim()
    if (body) {
      const s = start + lead
      out.push({ start: s, end: s + body.length, words: (body.match(WORD) ?? []).length, spoken: quoted[s] === 1 || /^["“‘']/.test(body) })
    }
    start = end
  }
  const END = /[.!?…]+["”’')\]]*(?=\s|$)|\n\s*\n/g
  for (const m of text.matchAll(END)) {
    const at = m.index
    if (m[0].startsWith('\n')) { close(at); continue }
    if (m[0] === '.') {
      const before = /([\p{L}]+)$/u.exec(text.slice(Math.max(0, at - 12), at))?.[1] ?? ''
      if (ABBREVIATIONS.has(before.toLowerCase()) || /^\p{Lu}$/u.test(before)) continue
    }
    close(at + m[0].length)
  }
  close(text.length)
  return out
}

/**
 * For each offset, 1 where it is inside quotation marks: “ opens and ” closes,
 * and a straight " opens or closes by turns; ‘ opens a single quotation and ’
 * closes it, but not between two letters, where it is an apostrophe. A
 * paragraph's end closes any still open, as a speech running on into the next
 * paragraph opens again there.
 */
export function insideQuotes(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  let double = false
  let single = false
  const letter = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\n' && text[i + 1] === '\n') { double = false; single = false }
    else if (c === '“') double = true
    else if (c === '”') double = false
    else if (c === '"') double = !double
    else if (c === '‘' && !letter(text[i - 1])) single = true
    else if (c === '’' && !(letter(text[i - 1]) && letter(text[i + 1]))) single = false
    out[i] = double || single ? 1 : 0
  }
  return out
}
