import { diffWords } from '@/lib/textDiff'
import { shownChange } from '@/lib/docxEdits'
import { emphasisSpans } from '@/lib/proseEmphasis'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { placeNotes } from '@/lib/noteAnchor'
import type { DraftBook } from '@/lib/bookDraft'
import type { ProseNote } from '@/types'

/*
  The book as the writer sends it back to the editor, marked: a scene's prose
  as tracked changes against the text the editor sent back (round-trip-plan-2.md,
  T5.1; decisions D-4 and D-6).

  Both editors of the blind runs had to reconstruct what the writer changed by
  diffing the book themselves, with scripts; an editor without them rereads it.
  Marked, Word shows it: the edits the writer took are no change at all, those
  she declined are her turning them back, and her own rewriting is hers.

  The paragraphs are aligned first — the same paragraph in both is unchanged —
  and of the rest, each is paired with the one it resembles, in order, and the
  two compared (`paired`). A paragraph with no like on the other side is
  inserted or deleted whole, its paragraph mark with it, so that rejecting
  every change gives back the editor's text and accepting every one gives the
  writer's: the test the reader keeps (`markedDocx.test.ts`).

  An editor has to be able to read it (round-trip-plan-3.md, T8). Paired in
  order, first with first, a new paragraph was compared word by word with an
  old one it had nothing to do with — 112 marks in one paragraph of the second
  loop's revision — and the old one, barely touched, came back whole as new
  (`markedRunFiles.test.ts`). And within a paragraph rightly paired, a
  rewritten phrase is one stretch out and one in, not its words turn about.
*/

/** A stretch of a paragraph: the same in both, put in by the writer, or taken out; and whether it is in italics. */
export interface MarkedRun { kind: 'same' | 'ins' | 'del'; text: string; em: boolean }

/**
 * A paragraph of the marked scene: as it was, put in whole, or taken out
 * whole, and its runs; and its paragraph mark, which is not always the
 * paragraph's own case (see `markedParagraphs`).
 */
export interface MarkedParagraph { mark: 'same' | 'ins' | 'del'; verse: boolean; runs: MarkedRun[]; breakMark: 'same' | 'ins' | 'del' }

/** A paragraph's text with its italics marks taken out, and which of its characters are in italics. */
function plain(text: string, verse: boolean): { text: string; em: boolean[] } {
  // Verse keeps its line breaks; prose is one line. Emphasis is read as the export reads it.
  const spans = emphasisSpans(text)
  const parts = spans.length ? spans : [{ text, em: false }]
  let out = ''
  const em: boolean[] = []
  for (const s of parts) { out += s.text; for (let i = 0; i < s.text.length; i++) em.push(s.em) }
  return verse ? { text: out, em } : { text: out, em }
}

/** `text` from `from`, cut into runs where its italics change. */
function runsOf(kind: MarkedRun['kind'], text: string, em: boolean[], from: number): MarkedRun[] {
  const out: MarkedRun[] = []
  for (let i = 0; i < text.length; i++) {
    const e = em[from + i] ?? false
    const last = out[out.length - 1]
    if (last && last.em === e) last.text += text[i]
    else out.push({ kind, text: text[i], em: e })
  }
  return out
}

/** A sentence's end, within words kept: a change is not run on across one. */
const SENTENCE_END = /[.!?…]["'”’)\]]*\s/

/**
 * How many words kept between two changes still make them one (T8.2): a
 * phrase rewritten is read as one stretch out and one in. Measured on the
 * second loop's files, with what 0, 1 and 3 give (`t8-1-readable-marks.md`).
 */
const WORDS_BETWEEN = 2

/**
 * One paragraph against another: their words compared, and the changes drawn
 * together as a reader would count them.
 * - A change is a run of words out and in, with at most spaces kept between.
 * - Two changes with a word or two kept between them, in one sentence, are one:
 *   "did not know" made "was not calm" is that, not "did" made "was" and "know"
 *   made "calm".
 * - What a change's two sides share at either end, in whole words, is kept and
 *   not marked (`shownChange`): "twice" made "twice, slowly," puts in ", slowly,".
 */
function pairRuns(before: { text: string; em: boolean[] }, after: { text: string; em: boolean[] }): MarkedRun[] {
  // Each change, as where it is in both texts.
  interface Span { a0: number; a1: number; b0: number; b1: number }
  const tokens = diffWords(before.text, after.text)
  const spans: Span[] = []
  let a = 0
  let b = 0
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k].op === 'equal') { a += tokens[k].text.length; b += tokens[k].text.length; continue }
    const span: Span = { a0: a, a1: a, b0: b, b1: b }
    const joins = (t: number) => tokens[t].op === 'equal' && /^\s+$/.test(tokens[t].text) && t + 1 < tokens.length && tokens[t + 1].op !== 'equal'
    while (k < tokens.length && (tokens[k].op !== 'equal' || joins(k))) {
      const { op, text } = tokens[k]
      if (op !== 'add') a += text.length
      if (op !== 'remove') b += text.length
      k++
    }
    k--
    span.a1 = a
    span.b1 = b
    spans.push(span)
  }

  // Drawn together: those a word or two apart, in one sentence.
  const changes: Span[] = []
  for (const sp of spans) {
    const last = changes[changes.length - 1]
    const kept = last ? before.text.slice(last.a1, sp.a0) : ''
    if (last && !SENTENCE_END.test(kept) && kept.trim().split(/\s+/).filter(Boolean).length <= WORDS_BETWEEN) changes[changes.length - 1] = { a0: last.a0, a1: sp.a1, b0: last.b0, b1: sp.b1 }
    else changes.push(sp)
  }

  const out: MarkedRun[] = []
  let atB = 0 // in `after`
  for (const c of changes) {
    // The whole words its sides share at either end stay as they are.
    const shown = shownChange(before.text.slice(c.a0, c.a1), after.text.slice(c.b0, c.b1))
    const a0 = c.a0 + shown.lead.length
    const b0 = c.b0 + shown.lead.length
    out.push(...runsOf('same', after.text.slice(atB, b0), after.em, atB))
    out.push(...runsOf('del', shown.out, before.em, a0))
    out.push(...runsOf('ins', shown.in, after.em, b0))
    atB = b0 + shown.in.length
  }
  out.push(...runsOf('same', after.text.slice(atB), after.em, atB))
  return out
}

/** A paragraph's words, for telling how alike two are: lower case, without its marks or its punctuation. */
const wordsOf = (text: string): string[] => text.toLowerCase().replace(/[*_]/g, '').match(/[\p{L}\p{N}'’]+/gu) ?? []

/** Half of the longer paragraph's words, in order, in the other: the two are the same paragraph, changed. */
const ALIKE = 0.5
/** Or four fifths of the shorter's words in the longer, in order, with an unbroken run of them: one kept inside the other. */
const WITHIN = 0.8
/** That run: this many words, or the whole of a shorter paragraph, and never fewer than three. */
const RUN = 6

/**
 * How alike two paragraphs are, 0 where they are not to be paired (T8.1).
 *
 * Their words in common, in order, over the longer. Two paragraphs with
 * nothing to do with each other share the small words of the language in some
 * order — up to 0.27 in the two loops' files — and a paragraph the writer
 * changed keeps half or more.
 *
 * And one kept inside another, which that measure calls unlike: a sentence
 * that has gained three after it ("So he knew that too." at 0.17), a paragraph
 * cut to its first lines, one split in two. There the shorter's words are
 * nearly all in the longer, and a run of them unbroken; without the run, a
 * five-word line finds four of its words, in order, in any long paragraph.
 *
 * The numbers are measured, in `t8-1-readable-marks.md`.
 */
export function likeness(a: string, b: string): number {
  const A = wordsOf(a)
  const B = wordsOf(b)
  const shorter = Math.min(A.length, B.length)
  const longer = Math.max(A.length, B.length)
  if (!shorter) return 0
  // Words in common whatever their order: no more can be in common in order. Most pairs end here.
  const bag = new Map<string, number>()
  for (const w of A) bag.set(w, (bag.get(w) ?? 0) + 1)
  let most = 0
  for (const w of B) {
    const n = bag.get(w) ?? 0
    if (n > 0) { most++; bag.set(w, n - 1) }
  }
  if (most / longer < ALIKE && most / shorter < WITHIN) return 0
  // In order (an LCS over words), and the longest run of them unbroken.
  let prev = new Array<number>(B.length + 1).fill(0)
  let prevRun = new Array<number>(B.length + 1).fill(0)
  let run = 0
  for (let i = 1; i <= A.length; i++) {
    const row = new Array<number>(B.length + 1).fill(0)
    const rowRun = new Array<number>(B.length + 1).fill(0)
    for (let j = 1; j <= B.length; j++) {
      if (A[i - 1] === B[j - 1]) {
        row[j] = prev[j - 1] + 1
        rowRun[j] = prevRun[j - 1] + 1
        if (rowRun[j] > run) run = rowRun[j]
      } else row[j] = Math.max(prev[j], row[j - 1])
    }
    prev = row
    prevRun = rowRun
  }
  const common = prev[B.length]
  if (common / longer >= ALIKE) return common / longer
  if (common / shorter >= WITHIN && run >= Math.max(3, Math.min(RUN, shorter))) return common / longer
  return 0
}

/**
 * Of two runs of paragraphs, which is paired with which: each with one like it
 * (`likeness`), in order, so that the pairs are as alike as they can be taken
 * together. The rest have no pair.
 */
function paired(was: readonly string[], now: readonly string[]): Array<[number, number]> {
  const n = was.length
  const m = now.length
  const like = was.map((a) => now.map((b) => likeness(a, b)))
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    best[i][j] = Math.max(best[i + 1][j], best[i][j + 1], like[i][j] > 0 ? like[i][j] + best[i + 1][j + 1] : 0)
  }
  const out: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (like[i][j] > 0 && best[i][j] === like[i][j] + best[i + 1][j + 1]) { out.push([i, j]); i++; j++ }
    else if (best[i + 1][j] >= best[i][j + 1]) i++
    else j++
  }
  return out
}

/** The longest common subsequence of two lists of paragraphs, as pairs of indices. */
function aligned(a: readonly string[], b: readonly string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return out
}

/**
 * A scene's prose, `current`, marked against `base`: what the editor sent back.
 * Null `base` is a scene the writer has added since, all of it put in.
 */
export function markedParagraphs(base: string | null, current: string): MarkedParagraph[] {
  const was = base === null ? [] : paragraphBlocks(base)
  const now = paragraphBlocks(current)
  const out: MarkedParagraph[] = []
  const whole = (mark: 'ins' | 'del', p: { text: string; verse: boolean }): MarkedParagraph => {
    const flat = plain(p.text, p.verse)
    return { mark, verse: p.verse, runs: runsOf(mark, flat.text, flat.em, 0), breakMark: mark }
  }
  // Between two paragraphs the same in both, the ones that differ: each paired with its like, and the rest whole.
  const gap = (wasFrom: number, wasTo: number, nowFrom: number, nowTo: number) => {
    let i = wasFrom
    let j = nowFrom
    const upTo = (x: number, y: number) => {
      // Those taken out first, then those put in: as they would be read.
      for (; i < x; i++) out.push(whole('del', was[i]))
      for (; j < y; j++) out.push(whole('ins', now[j]))
    }
    for (const [x, y] of paired(was.slice(wasFrom, wasTo).map((p) => p.text), now.slice(nowFrom, nowTo).map((p) => p.text))) {
      upTo(wasFrom + x, nowFrom + y)
      const p = now[j]
      out.push({ mark: 'same', verse: p.verse, runs: pairRuns(plain(was[i].text, was[i].verse), plain(p.text, p.verse)), breakMark: 'same' })
      i++
      j++
    }
    upTo(wasTo, nowTo)
  }
  let i = 0
  let j = 0
  for (const [x, y] of aligned(was.map((p) => p.text), now.map((p) => p.text))) {
    gap(i, x, j, y)
    const p = now[y]
    const flat = plain(p.text, p.verse)
    out.push({ mark: 'same', verse: p.verse, runs: runsOf('same', flat.text, flat.em, 0), breakMark: 'same' })
    i = x + 1
    j = y + 1
  }
  gap(i, was.length, j, now.length)
  /*
    Paragraphs put in after one that is in both: the break put in is the one at
    the end of that paragraph, and the last new paragraph ends with the break
    it had — as Word marks a paragraph typed after another. Marked on the new
    paragraph's own break instead, LibreOffice saved both, and rejecting it
    then joined two of the editor's paragraphs (npm run probe:marked, T5.2).
  */
  for (let k = 1; k < out.length; k++) {
    if (out[k].mark !== 'ins' || out[k - 1].mark !== 'same') continue
    let end = k
    while (end + 1 < out.length && out[end + 1].mark === 'ins') end++
    out[k - 1].breakMark = 'ins'
    out[end].breakMark = 'same'
    k = end
  }
  return out
}

/**
 * Which break a new paragraph's mark goes on, where the paragraph before it
 * holds a comment (round-trip-plan-3.md, T8.4).
 *
 * `markedParagraphs` marks the break of the paragraph before, as Word does.
 * With a comment anywhere in that paragraph, LibreOffice's reject-all takes
 * the new paragraph's words and leaves its break: an empty paragraph, 2 in the
 * second loop's round 2 and 1 in round 3 (`t8-0-measure.md`). There the mark
 * goes on the new paragraph's own break, and the last of several.
 *
 * Not where the paragraph before ends in words put in: with the mark on the
 * new paragraph's own break LibreOffice then joins two of the editor's
 * paragraphs, comment or none, and Word's form is right, comment or none.
 * Each case is in `npm run probe:marked`, both ways.
 */
export function settleBreaks(paras: MarkedParagraph[], commented: (k: number) => boolean): void {
  for (let k = 0; k < paras.length - 1; k++) {
    const p = paras[k]
    // A paragraph that stands, with its break marked: a new one follows it.
    if (p.mark !== 'same' || p.breakMark !== 'ins' || !commented(k)) continue
    const lastWords = [...p.runs].reverse().find((r) => r.text)
    if (lastWords?.kind === 'ins') continue
    let end = k + 1
    while (end + 1 < paras.length && paras[end + 1].mark === 'ins') end++
    p.breakMark = 'same'
    paras[end].breakMark = 'ins'
  }
}

/**
 * How many changes a marked scene holds, as a reader counts them and as
 * bringing the file in does (T8.3): each stretch of words and paragraph breaks
 * put in or taken out with nothing kept inside it. A word replaced is one. So
 * are two paragraphs put in one after the other, and a paragraph taken out
 * with another put in its place.
 */
export function changeCount(paras: readonly MarkedParagraph[]): number {
  let count = 0
  let inChange = false
  const item = (changed: boolean) => {
    if (changed && !inChange) count++
    inChange = changed
  }
  paras.forEach((p, i) => {
    for (const r of p.runs) if (r.text) item(r.kind !== 'same')
    // The break after it, where another paragraph follows: part of a change where the file marks it (`breakMark`),
    // and where the paragraph is put in or taken out whole, whose own break goes with it whichever the file marks.
    if (i < paras.length - 1) item(p.breakMark !== 'same' || p.mark !== 'same')
  })
  return count
}

/** Whether a scene has anything marked in it. */
export function hasMarks(paras: readonly MarkedParagraph[]): boolean {
  return paras.some((p) => p.mark !== 'same' || p.runs.some((r) => r.kind !== 'same'))
}

/** What a marked export is given (`EditingMarks.marked`), and what it holds, for the dialog to say. */
export interface MarkedPlan {
  marked: {
    author: string
    date: string
    base: (eventId: string) => string | null
    against: string
    titleCount?: string
    threads: Array<{ eventId: string; quote: string; done: boolean; comments: Array<{ author: string; initials: string; text: string; date: string }> }>
  }
  changes: number
  threads: number
}

/** A name's initials, as a comment carries them. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 3)

/**
 * The line the marked file says of a thread whose words the writer has since
 * rewritten, so that it goes at its scene's start: the words it was made on.
 *
 * It was written into the editor's own comment, before their words and under
 * their name: on 5 comments of the second loop's round 2, and 10 of round 3.
 * The editor: "I would rather it didn't look as though I'd said it." It is a
 * reply of the writer's now, first under the thread, and is known for the
 * app's coming back, so that it is never one of the writer's replies in Notes
 * (round-trip-plan-3.md, T9.2, D-8).
 */
const REWRITTEN = 'On words since rewritten:'
export const rewrittenLine = (quote: string) => `${REWRITTEN} “${quote}”`
export const isRewrittenLine = (text: string) => text.trimStart().startsWith(REWRITTEN)
/** A comment's own words, without the line a file sent before T9.2 put in front of them. */
export const withoutRewrittenLine = (text: string) => text.replace(/^On words since rewritten: “[^”]*”\s*/, '').trim()

/** When something was said, as a comment's date in the file: to the second, as Word writes it. */
export const commentDate = (at: number) => new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * A comment's date in a file, as a time. Word writes the clock where the
 * comment was made and calls it UTC, or gives no zone at all; either way its
 * figures are kept as they are, so that they go back as they came
 * (round-trip-plan-3.md, T9.3). Undefined where the file gives none that reads.
 */
export function commentTime(date: string | undefined): number | undefined {
  if (!date) return undefined
  const at = Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(date) ? date : `${date}Z`)
  return Number.isFinite(at) ? at : undefined
}

/**
 * The marked export of the book as it is, against the book as an editor's
 * file sent it back (round-trip-plan-2.md, T5.4): each scene's changes, signed
 * `author` (D-6), and the threads of that file's editors — their notes, with
 * the writer's replies under them — on their words as the book now has them,
 * or quoted where those are gone (D-5).
 */
export function markedPlan(o: {
  sentBack: { id: string; editors?: readonly string[]; titleCount?: string }
  base: DraftBook
  scenes: ReadonlyArray<{ eventId: string; text: string }>
  notes: readonly ProseNote[]
  author: string
  now: number
}): MarkedPlan {
  const base = new Map(o.base.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
  const editors = new Set(o.sentBack.editors ?? [])
  const theirs = o.notes.filter((n) => n.author.kind === 'editor' && (!editors.size || editors.has(n.author.name ?? '')))
  const places = placeNotes(theirs, o.scenes.map((s) => ({ eventId: s.eventId, text: s.text })))
  const text = new Map(o.scenes.map((s) => [s.eventId, s.text]))
  const signer = o.author.trim() || 'The author'
  const threads = theirs.map((n) => {
    const place = places.get(n.id)
    const eventId = place?.eventId ?? n.eventId
    const quote = place ? text.get(place.eventId)!.slice(place.from, place.to) : n.quote
    const by = n.author.name ?? 'The editor'
    return {
      eventId, quote, done: n.status === 'resolved',
      comments: [
        // Each with its own date: when the editor said it, and when each reply was made (T9.3).
        { author: by, initials: initials(by), text: n.body, date: commentDate(n.createdAt) },
        ...n.replies.map((r) => {
          const who = r.author.kind === 'me' ? signer : r.author.name ?? 'The editor'
          return { author: who, initials: initials(who), text: r.body, date: commentDate(r.createdAt) }
        }),
      ],
    }
  }).filter((t) => text.has(t.eventId))
  let changes = 0
  for (const s of o.scenes) changes += changeCount(markedParagraphs(base.get(s.eventId) ?? null, s.text))
  return {
    marked: { author: signer, date: new Date(o.now).toISOString(), base: (id) => base.get(id) ?? null, against: o.sentBack.id, threads, ...(o.sentBack.titleCount ? { titleCount: o.sentBack.titleCount } : {}) },
    changes,
    threads: threads.length,
  }
}

