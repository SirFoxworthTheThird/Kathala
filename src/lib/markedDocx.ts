import { diffWords } from '@/lib/textDiff'
import { declinedName, shownChange } from '@/lib/docxEdits'
import { emphasisSpans } from '@/lib/proseEmphasis'
import { paragraphBlocks } from '@/lib/manuscriptParagraphs'
import { placeNotes } from '@/lib/noteAnchor'
import { CARRIED, paragraphs, shareIn, type DraftBook } from '@/lib/bookDraft'
import type { EditorChange, ProseNote } from '@/types'

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

/**
 * A stretch of a paragraph: the same in both, put in by the writer, or taken
 * out; whether it is in italics; and, put in or taken out, whether it turns an
 * edit of the editor's back (`markDeclined`).
 */
export interface MarkedRun { kind: 'same' | 'ins' | 'del'; text: string; em: boolean; declined?: boolean }

/**
 * A paragraph of the marked scene: as it was, put in whole, or taken out
 * whole, and its runs; and its paragraph mark, which is not always the
 * paragraph's own case (see `markedParagraphs`).
 */
export interface MarkedParagraph {
  mark: 'same' | 'ins' | 'del'
  verse: boolean
  runs: MarkedRun[]
  breakMark: 'same' | 'ins' | 'del'
  /** Put in or taken out whole, turning an edit of the editor's back: a paragraph they cut, put back; one they wrote, taken out. */
  declined?: boolean
  /**
   * This paragraph and the next are one paragraph on the other side, their
   * words as they were: the change is the break between them (`breakMark`), and
   * the space a join puts in or a split takes out (round-trip-plan-4.md, T18.2).
   */
  joins?: true
}

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
export function markedParagraphs(
  base: string | null,
  current: string,
  /**
   * Whether a comment goes in a paragraph of these words (`commentedIn`). A
   * split or a join whose first half holds one is marked as before, the
   * paragraph put in or taken out whole: with a comment in the paragraph whose
   * break is marked, LibreOffice's Reject All restores the space and keeps the
   * break, as T8.4 found of a paragraph put in after one (npm run probe:marked,
   * T18.2: four cases, both ways).
   */
  commented: (text: string) => boolean = () => false,
): MarkedParagraph[] {
  const was = base === null ? [] : paragraphBlocks(base)
  const now = paragraphBlocks(current)
  const out: MarkedParagraph[] = []
  const whole = (mark: 'ins' | 'del', p: { text: string; verse: boolean }): MarkedParagraph => {
    const flat = plain(p.text, p.verse)
    return { mark, verse: p.verse, runs: runsOf(mark, flat.text, flat.em, 0), breakMark: mark }
  }
  /*
    A paragraph split in two, or two joined, their words as they were: the
    break between them put in or taken out, and the space a join puts between
    them. Written as a paragraph taken out whole and its words put into the
    next, a declined join went out as two changes under two names, the sentence
    twice, and Reject All left an empty paragraph (loop-2026-11-14.md, finding
    7); and the editor's join was counted rewritten since, its two halves read
    apart (T18.0).
  */
  const sepOf = (one: { text: string; verse: boolean }, a: { text: string; verse: boolean }, b: { text: string; verse: boolean } | undefined) =>
    !b || one.verse || a.verse || b.verse || commented(plain(a.text, false).text) ? null : ([' ', ''] as const).find((sep) => one.text === `${a.text}${sep}${b.text}`) ?? null
  const halves = (first: { text: string; verse: boolean }, second: { text: string; verse: boolean }, sep: string, kind: 'ins' | 'del') => {
    const a = plain(first.text, false)
    const b = plain(second.text, false)
    const sepRun: MarkedRun[] = sep ? [{ kind: kind === 'ins' ? 'del' : 'ins', text: sep, em: false }] : []
    out.push({ mark: 'same', verse: false, runs: [...runsOf('same', a.text, a.em, 0), ...sepRun], breakMark: kind, joins: true })
    out.push({ mark: 'same', verse: false, runs: runsOf('same', b.text, b.em, 0), breakMark: 'same' })
  }
  const gap = (wasFrom: number, wasTo: number, nowFrom: number, nowTo: number) => {
    for (let x = wasFrom; x < wasTo; x++) for (let y = nowFrom; y < nowTo; y++) {
      const split = y + 1 < nowTo ? sepOf(was[x], now[y], now[y + 1]) : null
      const join = split === null && x + 1 < wasTo ? sepOf(now[y], was[x], was[x + 1]) : null
      if (split === null && join === null) continue
      pairedGap(wasFrom, x, nowFrom, y)
      if (split !== null) { halves(now[y], now[y + 1], split, 'ins'); gap(x + 1, wasTo, y + 2, nowTo) }
      else { halves(was[x], was[x + 1], join!, 'del'); gap(x + 2, wasTo, y + 1, nowTo) }
      return
    }
    pairedGap(wasFrom, wasTo, nowFrom, nowTo)
  }
  // Between two paragraphs the same in both, the ones that differ: each paired with its like, and the rest whole.
  const pairedGap = (wasFrom: number, wasTo: number, nowFrom: number, nowTo: number) => {
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
  /*
    And paragraphs taken out at a scene's end, after one that is in both: the
    break taken out is the one at the end of that paragraph, and the last ends
    with the break it had, as Word marks a scene's last paragraph cut. Marked
    on its own break, the scene break after it was joined to the paragraph by
    LibreOffice's save, and the app read it back as the scene's last line:
    found by a split's first half ending in paragraphs cut
    (npm run probe:marked, round-trip-plan-4.md, T14.1).
  */
  let start = out.length
  while (start > 0 && out[start - 1].mark === 'del') start--
  if (start > 0 && start < out.length && out[start - 1].mark === 'same') {
    out[start - 1].breakMark = 'del'
    out[out.length - 1].breakMark = 'same'
  }
  return out
}

/**
 * Whether a comment of these threads goes in a paragraph of a scene's, by the
 * words it is on, as the export looks for them (`markedParagraphs`). One whose
 * words are not in the scene goes at its start, in a paragraph not known
 * until it is marked: then every paragraph is taken to hold one.
 */
export function commentedIn(threads: ReadonlyArray<{ eventId: string; quote: string; outside?: unknown }>, eventId: string, scene: string): (text: string) => boolean {
  const words = threads.filter((t) => t.eventId === eventId && !t.outside).map((t) => emphasisSpans(t.quote).map((x) => x.text).join('') || t.quote)
  const flat = paragraphBlocks(scene).map((p) => plain(p.text, p.verse).text).join('\n')
  if (words.some((w) => !flat.includes(w))) return () => true
  return (text) => words.some((w) => w && text.includes(w))
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

/** Of the words kept either side of a change, this many characters are enough to say where it is. */
const CONTEXT = 40
/** A scene's and a paragraph's start and end, in the texts changes are looked for in: so that "the start of a paragraph", or "the end of the scene", can be asked for. */
const SCENE_OPEN = '\u0001'
const OPEN = '\u0002'
const CLOSE = '\u0003'
const SCENE_CLOSE = '\u0004'

/** A scene's text as `changeItems` says it: each paragraph between `OPEN` and `CLOSE`, its italics marks taken out, and the whole between the scene's. */
export function scenePlain(text: string): string {
  return `${SCENE_OPEN}${paragraphBlocks(text).map((p) => `${OPEN}${plain(p.text, p.verse).text}${CLOSE}`).join('')}${SCENE_CLOSE}`
}

/**
 * One change in a marked scene, counted as `changeCount` counts them: what it
 * takes out (`out`) and puts in (`in`), each with the paragraph marks it takes
 * or puts with it, and the words kept between it and the change before
 * (`gapBefore`) and the one after (`gapAfter`).
 */
export interface ChangeItem {
  out: string
  in: string
  gapBefore: string
  gapAfter: string
  runs: MarkedRun[]
  paras: MarkedParagraph[]
  /** Where its `out` is in the text it takes out of, as `scenePlain` gives it; and where its `in` is in the text it puts into. */
  at: number
  atIn: number
}

/** A marked scene's changes, in order (`ChangeItem`). */
export function changeItems(paras: readonly MarkedParagraph[]): ChangeItem[] {
  // The scene as a line of pieces, each in the text before, the text after, or both.
  type Piece = { out: string; in: string; run?: MarkedRun; para?: MarkedParagraph; brk?: MarkedParagraph }
  const pieces: Piece[] = [{ out: SCENE_OPEN, in: SCENE_OPEN }]
  paras.forEach((p, k) => {
    const side = (t: string): Piece => (p.mark === 'same' ? { out: t, in: t } : p.mark === 'del' ? { out: t, in: '' } : { out: '', in: t })
    // The break between two halves of one paragraph: on one side only, with the paragraph it ends (T18.2).
    const split = paras[k - 1]?.joins
    const brk = (t: string, of: MarkedParagraph): Piece => (of.breakMark === 'ins' ? { out: '', in: t, brk: of } : { out: t, in: '', brk: of })
    pieces.push(split ? brk(OPEN, paras[k - 1]) : { ...side(OPEN), ...(p.mark !== 'same' ? { para: p } : {}) })
    for (const r of p.runs) pieces.push(p.mark !== 'same' || r.kind === 'same' ? { ...side(r.text), run: r } : { out: r.kind === 'del' ? r.text : '', in: r.kind === 'ins' ? r.text : '', run: r })
    pieces.push(p.joins ? brk(CLOSE, p) : side(CLOSE))
  })
  pieces.push({ out: SCENE_CLOSE, in: SCENE_CLOSE })
  const kept = (x: Piece) => x.out === x.in
  // Where each piece starts in the text before.
  const starts: number[] = []
  pieces.reduce((n, x) => { starts.push(n); return n + x.out.length }, 0)
  const startsIn: number[] = []
  pieces.reduce((n, x) => { startsIn.push(n); return n + x.in.length }, 0)
  const items: ChangeItem[] = []
  let k = 0
  while (k < pieces.length) {
    if (kept(pieces[k])) { k++; continue }
    let end = k
    while (end < pieces.length && !kept(pieces[end])) end++
    const changed = pieces.slice(k, end)
    let from = k
    while (from > 0 && kept(pieces[from - 1])) from--
    let to = end
    while (to < pieces.length && kept(pieces[to])) to++
    items.push({
      out: changed.map((x) => x.out).join(''),
      in: changed.map((x) => x.in).join(''),
      gapBefore: pieces.slice(from, k).map((x) => x.out).join(''),
      gapAfter: pieces.slice(end, to).map((x) => x.out).join(''),
      runs: changed.flatMap((x) => (x.run && x.run.kind !== 'same' ? [x.run] : [])).concat(changed.flatMap((x) => (x.para ? x.para.runs : []))).filter((r, i, all) => all.indexOf(r) === i),
      paras: [...new Set(changed.flatMap((x) => (x.para ? [x.para] : x.brk ? [x.brk] : [])))],
      at: starts[k],
      atIn: startsIn[k],
    })
    k = end
  }
  return items
}

/*
  Which of the writer's changes turn an edit of the editor's back
  (round-trip-plan-3.md, T10.1; decision D-7).

  The marked file is measured from the editor's text (D-4), so an edit the
  writer declined is a change of the writer's like any other, and looks like
  new writing. The second loop's writer turned a sentence back and left it out
  of the cover note; the editor could not tell a choice from an accident.

  A third text is on the device: the scene as it went to the editor. A change
  of the writer's turns an edit back where, with the words kept either side of
  it, it puts back what the scene had there when it went, and the editor's
  words in that place are not what it had. A paragraph the editor wrote, taken
  out, is so; one they cut, put back. A change that puts back some of what the
  editor changed and not all, or rewrites it again, is new writing.
*/
export function markDeclined(paras: MarkedParagraph[], went: string | null, held?: { base: string | null; waiting: readonly WaitingChange[] }): void {
  if (went === null) return
  const items = changeItems(paras)
  /*
    A change of the editor's still waiting in Changes leaves the book as it
    went, so it reads as put back — and was signed *(edit declined)* for a
    decision the writer had not made (UX-2-3, D-3). It goes signed as theirs.
  */
  const waiting = held?.base ? waitingSpans(scenePlain(held.base), held.waiting) : []
  sidesIn(items, scenePlain(went)).forEach((side, i) => {
    if (side !== 'in') return
    if (waiting.some(([from, to]) => touches(items[i], from, to))) return
    for (const r of items[i].runs) r.declined = true
    for (const p of items[i].paras) p.declined = true
  })
}

/**
 * One of the editor's changes still waiting in Changes (`EditSuggestion`): what
 * it does, where, as bringing the file in found it — the same hunk the file's
 * `editorChanges` keep.
 */
export type WaitingChange = Pick<EditorChange, 'eventId' | 'before' | 'after' | 'prefix' | 'suffix'>

/** Whether a change of the marks is at a stretch `from`–`to` of the text it takes out of; either being no words at all, touching it. */
function touches(item: ChangeItem, from: number, to: number): boolean {
  const end = item.at + item.out.length
  return from === to || item.at === end ? item.at <= to && end >= from : item.at < to && end > from
}

/**
 * Where, in the editor's text as `scenePlain` puts it, each waiting change has
 * their words. A change keeps the words either side as the text had them
 * before the file's other changes, so where those were changed too — " in the
 * rain" put in a paragraph before a cut of " now" — the whole of them is not
 * in the editor's text: fewer are looked for, so long as they are found once.
 */
function waitingSpans(basePlain: string, waiting: readonly WaitingChange[]): Array<[number, number]> {
  return waiting.flatMap((w): Array<[number, number]> => {
    const lead = asPlain(w.prefix)
    const words = asPlain(w.after)
    const tail = asPlain(w.suffix)
    for (const k of [Infinity, 32, 16, 8]) {
      const l = k === Infinity ? lead : lead.slice(-k)
      const needle = `${l}${words}${k === Infinity ? tail : tail.slice(0, k)}`
      const at = basePlain.indexOf(needle)
      if (at >= 0 && basePlain.indexOf(needle, at + 1) < 0) return [[at + l.length, at + l.length + words.length]]
    }
    return []
  })
}

/** Whether an editor's change is one still waiting: the same hunk, in the same scene. */
const sameChange = (a: WaitingChange, b: WaitingChange) =>
  a.eventId === b.eventId && a.before === b.before && a.after === b.after && a.prefix === b.prefix && a.suffix === b.suffix

/**
 * Which side of each change a third text has at its place (`scenePlain`): its
 * `in`, its `out`, or neither, or both, null. Found by the change with the
 * words kept either side, at most `CONTEXT` of them. Where the words kept
 * before it are fewer — a change at the head of a paragraph, after one at the
 * end of the last — they run back through the change before, with whichever
 * side of it the text was found to have.
 */
export function sidesIn(
  items: readonly ChangeItem[],
  text: string,
  /**
   * Stretches of the text the items take out of (`coord: 'out'`) or put into
   * (`'in'`) that have changed again in the third text: the words kept either
   * side of a change stop short of them, since the third text does not have
   * them as they are here: checked against the book as it is, the writer's
   * *boxes* beside the editor's cut (T10.2).
   */
  cuts?: { coord: 'out' | 'in'; ranges: ReadonlyArray<[number, number]> },
): Array<'in' | 'out' | null> {
  const sides: Array<'in' | 'out' | null> = []
  // The words kept either side of each change, as they were asked with.
  const kept: Array<[string, string]> = []
  items.forEach((c, i) => {
    let before = c.gapBefore
    let after = c.gapAfter
    if (cuts) {
      const start = cuts.coord === 'out' ? c.at : c.atIn
      const end = start + (cuts.coord === 'out' ? c.out : c.in).length
      /*
        The nearest stretch changed since, before the change and after it,
        within the words kept either side. One that touches the change is its
        other half — the editor's cut that the writer's words put back — and
        not a change beside it.
      */
      const lastBefore = Math.max(start - before.length, ...cuts.ranges.filter(([, e]) => e < start).map(([, e]) => e))
      /*
        And one that starts on the paragraph's opening the change put in, as a
        paragraph the writer took out whole after the editor's split begins
        there: it is beside the change too, in the next paragraph (T18.0, the
        second loop's round 3).
      */
      const opensOn = (cuts.coord === 'out' ? c.out : c.in).endsWith(OPEN)
      const firstAfter = Math.min(end + after.length, ...cuts.ranges.filter(([b]) => b > end || (opensOn && b === end - 1 && b > start)).map(([b]) => Math.max(b, end)))
      before = before.slice(before.length - (start - lastBefore))
      after = after.slice(0, firstAfter - end)
    }
    // The words kept before run back through the change before, where they are cut by nothing changed since.
    for (let j = i - 1; j >= 0 && before.length < CONTEXT && before === c.gapBefore; j--) {
      const side = sides[j]
      if (!side) break
      before = `${items[j].gapBefore}${items[j][side]}${before}`
    }
    /*
      Asked with the words kept either side, at most `CONTEXT`; and where
      neither side is found, asked again within the change's own paragraph,
      from its start to its end. The words kept may run into the paragraph
      before, and an edit there the writer took is not in the scene as it went.
    */
    kept.push([before, after])
    sides.push(ask(c, before, after, text))
  })
  /*
    And the words kept after, run on through the change after, where they are
    too few to tell: a paragraph put in whole, then words taken out of the one
    after it, has only that paragraph's opening between them. So a declined
    join, marked as a paragraph put back and its words taken out of the joined
    one, was signed in two names (T18.2).
  */
  items.forEach((c, i) => {
    const [before, after] = kept[i]
    const next = items[i + 1]
    const side = sides[i + 1]
    if (sides[i] !== null || !next || !side || after !== c.gapAfter || after.length >= CONTEXT) return
    sides[i] = ask(c, before, `${after}${next[side]}${next.gapAfter}`, text)
  })
  return sides
}

/** Which side of a change a text has, asked with the words kept either side of it (`sidesIn`). */
function ask(c: ChangeItem, before: string, after: string, text: string): 'in' | 'out' | null {
  const open = before.lastIndexOf(OPEN)
  const close = after.indexOf(CLOSE)
  const asks: Array<[string, string]> = [
    [before.slice(-CONTEXT), after.slice(0, CONTEXT)],
    [(open < 0 ? before : before.slice(open)).slice(-CONTEXT), (close < 0 ? after : after.slice(0, close + 1)).slice(0, CONTEXT)],
  ]
  for (const [lead, tail] of asks) {
    const isIn = text.includes(`${lead}${c.in}${tail}`)
    const isOut = text.includes(`${lead}${c.out}${tail}`)
    if (!isIn && !isOut) continue
    return isIn && !isOut ? 'in' : isOut && !isIn ? 'out' : null
  }
  return null
}

/**
 * The scenes of the book that a split or a join made, against the scenes of
 * an editor's file (round-trip-plan-4.md, T14.1), by the rule Compare reads
 * them with (`compareDrafts`):
 * - `split`: a scene of the file still in the book, and the scenes new to the
 *   file that most of whose paragraphs were in it, and are no longer;
 * - `joined`: a scene of the book, and the scenes of the file no longer in it
 *   whose paragraphs are now mostly in it, and were not.
 */
export function sceneLineage(
  base: ReadonlyMap<string, string>,
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
): { split: Map<string, string[]>; joined: Map<string, string[]> } {
  const now = new Map(scenes.map((s) => [s.eventId, s.text]))
  const split = new Map<string, string[]>()
  for (const s of scenes) {
    if (base.has(s.eventId)) continue
    const from = [...base.keys()].find((id) => now.has(id) && shareIn(s.text, base.get(id)!) >= CARRIED && shareIn(s.text, now.get(id)!) < CARRIED)
    if (from) split.set(from, [...(split.get(from) ?? []), s.eventId])
  }
  const joined = new Map<string, string[]>()
  for (const [id, text] of base) {
    if (now.has(id)) continue
    const into = scenes.find((n) => base.has(n.eventId) && shareIn(text, n.text) >= CARRIED && shareIn(text, base.get(n.eventId)!) < CARRIED)
    if (into) joined.set(into.eventId, [...(joined.get(into.eventId) ?? []), id])
  }
  return { split, joined }
}

/**
 * The editor's text each scene of the book is marked against
 * (round-trip-plan-4.md, T14.1). A scene's own, where the file has it; and
 * where a scene was split or joined since, the part of the file's text it
 * now holds:
 * - **a split:** the scene it came from is cut, paragraph by paragraph and in
 *   their order, between it and the scenes made from it, each taking the run
 *   of paragraphs that are most of all its own. So the half that went is not
 *   struck from the first, nor put in whole as new in the second: of the
 *   third loop's split, 150 words that had not changed went both ways, and
 *   the editor's "Don't touch it" was on the struck copy;
 * - **a join:** the scene that took the others in is marked against all of
 *   them, in the file's order.
 * A scene new to the file and from no other is marked against nothing: new.
 */
export function basesFor(
  base: ReadonlyMap<string, string>,
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
): Map<string, string | null> {
  return sceneParts(base, scenes).bases
}

/**
 * `basesFor`, and where each part of the file's text came from, for the book's
 * shape to be marked against the file's (round-trip-plan-4.md, T15):
 * - `starts`: for each scene of the book with a part, the scene of the file it
 *   is from and the paragraph it starts at there — 0 where it is that scene's
 *   start, more for the half of a split that went on from another;
 * - `took`: for a scene that took others in by a join, those of the file in
 *   their order, itself among them, and how many paragraphs each gave.
 */
export function sceneParts(
  base: ReadonlyMap<string, string>,
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
): { bases: Map<string, string | null>; starts: Map<string, { from: string; at: number }>; took: Map<string, Array<{ id: string; paragraphs: number }>> } {
  const now = new Map(scenes.map((s) => [s.eventId, s.text]))
  const out = new Map<string, string | null>(scenes.map((s) => [s.eventId, base.get(s.eventId) ?? null]))
  const starts = new Map<string, { from: string; at: number }>(scenes.filter((s) => base.has(s.eventId)).map((s) => [s.eventId, { from: s.eventId, at: 0 }]))
  const took = new Map<string, Array<{ id: string; paragraphs: number }>>()
  const { split, joined } = sceneLineage(base, scenes)
  for (const [from, made] of split) {
    const paras = paragraphs(base.get(from)!)
    const parts = [from, ...made]
    /*
      How much each paragraph of the file is each part's: 1 where the part has
      it word for word, and as alike as the part's likest paragraph is
      otherwise (`likeness`, 0 for unlike), so that one edited since goes
      with the part it is in: the third loop's boots paragraph, edited in the
      half that went, was struck from the first half and put in whole in the
      second while ownership asked for the same words.
    */
    const own = parts.map((id) => {
      const theirs = paragraphs(now.get(id)!)
      const exact = new Set(theirs)
      return paras.map((p) => (exact.has(p) ? 1 : Math.max(0, ...theirs.map((q) => likeness(p, q)))))
    })
    // In the order their paragraphs stood: a half moved before the scene it came from is still its second half.
    const first = (k: number) => { const i = own[k].findIndex((x) => x > 0); return i < 0 ? paras.length : i }
    const order = parts.map((_, k) => k).sort((a, b) => first(a) - first(b))
    /*
      Cut into one run each, in that order, so that most paragraphs fall to a
      part that still has them; and a paragraph none has, between two parts,
      to the earlier. Between the half that stayed and the half that went are
      the paragraphs the writer rewrote, and they were rewritten where they
      stayed: the third loop's four, rewritten into the hearing.
    */
    const P = paras.length
    const K = order.length
    const owns = (k: number, a: number, b: number) => { let n = 0; for (let i = a; i < b; i++) n += own[order[k]][i]; return n }
    const best: number[][] = Array.from({ length: K + 1 }, () => new Array<number>(P + 1).fill(-Infinity))
    const cut: number[][] = Array.from({ length: K + 1 }, () => new Array<number>(P + 1).fill(0))
    best[0][0] = 0
    for (let k = 1; k <= K; k++) {
      for (let b = 0; b <= P; b++) {
        for (let a = 0; a <= b; a++) {
          const score = best[k - 1][a] + owns(k - 1, a, b)
          if (score >= best[k][b]) { best[k][b] = score; cut[k][b] = a }
        }
      }
    }
    for (let k = K, b = P; k >= 1; k--) {
      const a = cut[k][b]
      out.set(parts[order[k - 1]], paras.slice(a, b).join('\n\n'))
      starts.set(parts[order[k - 1]], { from, at: a })
      b = a
    }
  }
  const order = [...base.keys()]
  for (const [into, others] of joined) {
    const ids = [into, ...others].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const parts = ids.map((id) => ({ id, text: (id === into ? out.get(into) : base.get(id)) ?? '' })).filter((x) => x.text)
    out.set(into, parts.map((x) => x.text).join('\n\n'))
    took.set(into, parts.map((x) => ({ id: x.id, paragraphs: paragraphs(x.text).length })))
    // It starts where the first of those started.
    if (parts[0] && parts[0].id !== into) starts.set(into, { from: parts[0].id, at: 0 })
  }
  return { bases: out, starts, took }
}

/** What stands before a scene: a scene break, a chapter's heading, or nothing, the scene going on from the one before. */
export type Boundary = { kind: 'break' } | { kind: 'chapter'; chapterId: string } | { kind: 'none' }

/**
 * The editor's file's shape, read at each scene of the book
 * (round-trip-plan-4.md, T15): what stood before the scene's start there,
 * and inside a scene that took others in by a join, what stood between them.
 * A new chapter, its title and a scene break put in went out with no mark,
 * and rejecting every change left the new chapter in place: *"Chapter Seven
 * appears as if it had always been there"* (editor-run-2026-11-14-loop3.md, F-2).
 */
export interface BookShape {
  /** What stood before the scene's start in the file: null for a scene new to it. */
  before: (eventId: string) => Boundary | null
  /** In a scene that took others in: after how many of its paragraphs from the file, what stood between them. */
  joins: (eventId: string) => ReadonlyArray<{ after: number; boundary: Boundary }>
  /** A chapter of the file, by id, for the heading it had. */
  chapter: (chapterId: string) => { number: number; title: string } | null
}

export function bookShape(base: DraftBook, scenes: ReadonlyArray<{ eventId: string; text: string }>): BookShape {
  const { starts, took } = sceneParts(new Map(base.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text])), scenes)
  const at = new Map<string, Boundary>()
  for (const c of base.chapters) c.scenes.forEach((s, i) => at.set(s.id, i === 0 ? { kind: 'chapter', chapterId: c.id } : { kind: 'break' }))
  const chapters = new Map(base.chapters.map((c) => [c.id, { number: c.number, title: c.title }]))
  return {
    before: (id) => {
      const from = starts.get(id)
      if (!from) return null
      return from.at > 0 ? { kind: 'none' } : at.get(from.from) ?? null
    },
    joins: (id) => {
      const parts = took.get(id) ?? []
      const out: Array<{ after: number; boundary: Boundary }> = []
      let after = 0
      parts.forEach((p, k) => {
        if (k > 0) out.push({ after, boundary: at.get(p.id) ?? { kind: 'break' } })
        after += p.paragraphs
      })
      return out
    },
    chapter: (id) => chapters.get(id) ?? null,
  }
}

/** The book's shape changed since the file, counted for the dialog to say: chapters and scene breaks put in and taken out, and chapters whose heading changed, renamed or renumbered. */
export interface ShapeCount { chaptersIn: number; chaptersOut: number; breaksIn: number; breaksOut: number; headings: number }

/** What `shape` has changed, read along the book's scenes in order, each with its chapter: as the marked file marks it. */
export function shapeCount(
  shape: BookShape,
  scenes: ReadonlyArray<{ eventId: string; chapterId: string }>,
  heading: (chapterId: string) => { number: number; title: string } | null,
): ShapeCount {
  const n: ShapeCount = { chaptersIn: 0, chaptersOut: 0, breaksIn: 0, breaksOut: 0, headings: 0 }
  const out = (b: Boundary) => { if (b.kind === 'break') n.breaksOut++; if (b.kind === 'chapter') n.chaptersOut++ }
  scenes.forEach((s, i) => {
    const now: Boundary = i === 0 || scenes[i - 1].chapterId !== s.chapterId ? { kind: 'chapter', chapterId: s.chapterId } : { kind: 'break' }
    const was = shape.before(s.eventId) ?? { kind: 'none' as const }
    for (const j of shape.joins(s.eventId)) out(j.boundary)
    if (now.kind === 'chapter' && was.kind === 'chapter' && was.chapterId === now.chapterId) {
      const a = shape.chapter(was.chapterId)
      const b = heading(now.chapterId)
      if (a?.number !== b?.number || a?.title !== b?.title) n.headings++
      return
    }
    if (now.kind === was.kind && now.kind === 'break') return
    out(was)
    if (now.kind === 'break') n.breaksIn++
    else n.chaptersIn++
  })
  return n
}

/**
 * What the dialog says of the book's shape marked (T15), or null where none
 * of it changed: "The book's shape is marked too: 1 chapter put in, 1 scene
 * break put in and 1 taken out."
 */
export function shapeSaid(n: ShapeCount): string | null {
  const parts: string[] = []
  const both = (what: string, put: number, taken: number) => {
    const name = (k: number) => (k === 1 ? what : `${what}s`)
    if (put && taken) parts.push(`${put} ${name(put)} put in and ${taken} taken out`)
    else if (put) parts.push(`${put} ${name(put)} put in`)
    else if (taken) parts.push(`${taken} ${name(taken)} taken out`)
  }
  both('chapter', n.chaptersIn, n.chaptersOut)
  both('scene break', n.breaksIn, n.breaksOut)
  if (n.headings) parts.push(`${n.headings} ${n.headings === 1 ? 'chapter heading' : 'chapter headings'} changed`)
  if (!parts.length) return null
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, ${parts.at(-1)}`
  return `The book’s shape is marked too: ${list}.`
}

/** What became of an editor's changes, counted against the book as it is (`editTally`). */
export interface Tally {
  stand: number; turnedBack: number; rewritten: number
  /** Still waiting in Changes: not decided, so neither standing nor turned back (UX-2-3, D-3). Absent where none is. */
  waiting?: number
}

/** The tally as a line for the cover note: "Of Ines Marlowe's 58 changes: 49 stand, 8 turned back, 1 rewritten since." */
export function tallyLine(editors: readonly string[], t: Tally): string {
  const all = t.stand + t.turnedBack + t.rewritten + (t.waiting ?? 0)
  const whose = editors.length ? `${editors.join(' and ')}’s` : 'the editor’s'
  const parts = [
    t.stand ? `${t.stand} ${t.stand === 1 ? 'stands' : 'stand'}` : '',
    t.turnedBack ? `${t.turnedBack} turned back` : '',
    t.rewritten ? `${t.rewritten} rewritten since` : '',
    t.waiting ? `${t.waiting} still waiting` : '',
  ].filter(Boolean)
  return `Of ${whose} ${all} ${all === 1 ? 'change' : 'changes'}: ${parts.join(', ')}.`
}

/** One of the editor's changes the book has not as they left it, for the cover note: where it was, and what it did. */
export interface NotTaken { scene: string; became: 'turnedBack' | 'rewritten' | 'waiting'; said: string }

/**
 * Words of a change as the editor reads them: their italics marks out, one
 * line, no longer than a line, and cut at a word. `'end'` is the words before
 * a change, kept from the end: those a change keeps either side of it are a
 * stretch of characters, and start part way through a word.
 */
function quoted(raw: string, keep: 'start' | 'end' = 'start'): string {
  const t = raw.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()
  if (keep === 'end') {
    const tail = t.length > 70 ? t.slice(-70) : t
    return `“…${tail.replace(/^\S*\s+/, '')}”`
  }
  if (t.length <= 70) return `“${t}”`
  return `“${t.slice(0, 70).replace(/\s+\S*$/, '')}…”`
}

/**
 * What one of the editor's changes did, in a few words: *cut “…”*, *put in
 * “…”*, *“…” for “…”*, a paragraph split or two joined, or moved.
 */
export function changeSaid(c: EditorChange, moved = false): string {
  if (moved) return `moved ${quoted(c.before || c.after)}`
  /*
    Narrowed to the words that differ, at whole words: bringing a file in
    keeps a change with the words about it, so a cut of "now" is kept as
    "her now." made "her.".
  */
  let was = c.before.replace(/[*_]/g, '')
  let now = c.after.replace(/[*_]/g, '')
  let lead = c.prefix
  let head = 0
  while (head < was.length && head < now.length && was[head] === now[head]) head++
  // Not inside a word: where letters run on across the cut, on either side.
  const letter = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’]/u.test(ch)
  while (head > 0 && letter(was[head - 1]) && (letter(was[head]) || letter(now[head]))) head--
  const tailOf = () => {
    let tail = 0
    while (tail < was.length - head && tail < now.length - head && was[was.length - 1 - tail] === now[now.length - 1 - tail]) tail++
    while (tail > 0 && letter(was[was.length - tail]) && (letter(was[was.length - 1 - tail]) || letter(now[now.length - 1 - tail]))) tail--
    return tail
  }
  let tail = tailOf()
  // Nor starting on a stop: "lap and" made "lap. Before she…", and not "and" made ". Before she…".
  const stop = (ch: string | undefined) => !!ch && /[^\s\p{L}\p{N}]/u.test(ch)
  const starts = (t: string) => t.slice(head, t.length - tail)[0]
  if (head > 0 && (stop(starts(was)) || stop(starts(now)))) {
    while (head > 0 && !/\s/.test(was[head - 1])) head--
    tail = tailOf()
  }
  lead += was.slice(0, head)
  was = was.slice(head, was.length - tail)
  now = now.slice(head, now.length - tail)
  if (was.replace(/\s+/g, ' ').trim() === now.replace(/\s+/g, ' ').trim() && /\n\s*\n/.test(was) !== /\n\s*\n/.test(now)) {
    const at = quoted(`${lead}${was}`.replace(/\n\s*\n/g, ' '), 'end')
    return /\n\s*\n/.test(now) ? `a new paragraph after ${at}` : `two paragraphs joined after ${at}`
  }
  if (!now.trim()) return `cut ${quoted(was)}`
  if (!was.trim()) return `put in ${quoted(now)} after ${quoted(lead, 'end')}`
  return `${quoted(was)} made ${quoted(now)}`
}

/**
 * What became of the editor's changes, for the cover note (round-trip-plan-4.md,
 * T18.1, D-14): the figures, as the dialog says them, and each change not
 * taken, with its scene and its words. Every one not listed stands. The third
 * loop's editor wrote a classifier against the clean copy to learn which of
 * theirs stood, and the writer's note said 4 turned back and listed seven.
 */
export function tallyNote(editors: readonly string[], t: Tally, notTaken: readonly NotTaken[], signer: string): string {
  const of = (b: NotTaken['became']) => notTaken.filter((n) => n.became === b).map((n) => `- ${n.scene}: ${n.said}`)
  const parts = [tallyLine(editors, t)]
  if (t.turnedBack) parts.push([`Turned back, each marked in the file and signed ${declinedName(signer)}:`, ...of('turnedBack')].join('\n'))
  if (t.rewritten) parts.push(['Rewritten since, where the words are now my own:', ...of('rewritten')].join('\n'))
  if (t.waiting) parts.push(['Not decided yet, so marked as the book has them for now:', ...of('waiting')].join('\n'))
  if (t.turnedBack || t.rewritten || t.waiting) parts.push('Every other change of yours stands as you made it.')
  return parts.join('\n\n')
}

/** A stretch of a scene's text, as it is kept (`EditorChange`), put as `scenePlain` puts it. */
const asPlain = (raw: string) => raw.replace(/\n\s*\n/g, `${CLOSE}${OPEN}`).replace(/[*_]/g, '')

/**
 * What became of an editor's changes (round-trip-plan-3.md, T10.2): of those
 * the file held, as bringing it in counted them (`editorChanges`), how many
 * stand in the book as it is, how many the writer turned back, and how many
 * were rewritten since, for the cover note: of the second loop's first file,
 * *Of Ines Marlowe's 58 changes: 49 stand, 8 turned back, 1 rewritten since*
 * (`markedRunFiles.test.ts`).
 *
 * Counted from the three texts, scene by scene: as it went to the editor,
 * as they sent it back, and as it is. The editor's text is marked against
 * what went (`changeItems`), and the book as it is is read at each piece
 * (`sidesIn`); each change of the editor's is the pieces in its words. It
 * stands where the book has every piece as the editor left it, and is turned
 * back where it has every one as it went. Anything else, it was rewritten:
 * some of it taken and some not, or new words in its place. A scene since
 * taken out of the book is rewritten too.
 */
export function editTally(...args: Parameters<typeof editVerdicts>): Tally {
  return tallyOf(editVerdicts(...args))
}

/** The figures of a set of verdicts; `waiting` only where one is. */
export function tallyOf(verdicts: readonly EditVerdict[]): Tally {
  const tally: Tally = { stand: 0, turnedBack: 0, rewritten: 0 }
  for (const v of verdicts) tally[v.became] = (tally[v.became] ?? 0) + 1
  return tally
}

/** What became of one of the editor's changes: a move's two halves are one. */
export interface EditVerdict { changes: EditorChange[]; became: keyof Tally }

/** Each of an editor's changes, and what became of it (`editTally`), in the file's order. */
export function editVerdicts(
  changes: readonly EditorChange[],
  went: (eventId: string) => string | null,
  back: (eventId: string) => string | null,
  now: (eventId: string) => string | null,
  /**
   * The scenes of the book a change's scene became, where it was split or
   * joined since (`sceneLineage`): its words are looked for in them too, with
   * the texts given for each as its part (`basesFor`). A change in the half of
   * a split scene that went was counted rewritten (round-trip-plan-4.md, T14.2).
   */
  became: (eventId: string) => readonly string[] = () => [],
  /** Those still waiting in Changes: not stood yet, and not turned back either (UX-2-3, D-3). */
  waiting: readonly WaitingChange[] = [],
): EditVerdict[] {
  const verdicts: EditVerdict[] = []
  // The pieces of each scene, and what the book as it is has at each.
  const scenes = new Map<string, { text: string; now: string; items: ChangeItem[]; sides: Array<'in' | 'out' | null> } | null>()
  const sceneOf = (id: string) => {
    if (!scenes.has(id)) {
      const w = went(id)
      const b = back(id)
      const n = now(id)
      if (w === null || b === null || n === null) scenes.set(id, null)
      else {
        const items = changeItems(markedParagraphs(w, b))
        // The writer's changes since, where they are in the editor's text: the words kept either side of one of the editor's stop there.
        const since = changeItems(markedParagraphs(b, n)).map((x): [number, number] => [x.at, x.at + x.out.length])
        scenes.set(id, { text: scenePlain(w), now: scenePlain(n), items, sides: sidesIn(items, scenePlain(n), { coord: 'in', ranges: since }) })
      }
    }
    return scenes.get(id)!
  }
  // A move's two halves are one change, from one scene to another as well: a move's id is the file's, not the scene's.
  const groups = new Map<string, EditorChange[]>()
  changes.forEach((c, i) => {
    const key = c.move ? `move:${c.move}` : `#${i}`
    groups.set(key, [...(groups.get(key) ?? []), c])
  })
  for (const group of groups.values()) {
    const sides: Array<'in' | 'out' | null> = []
    let gone = false
    for (const c of group) {
      // Where its words are in the scene as it went, or in a scene it became; the pieces in them are this change's.
      const lead = asPlain(c.prefix)
      const words = asPlain(c.before)
      const whole = `${lead}${words}${asPlain(c.suffix)}`
      const where = [c.eventId, ...became(c.eventId)].map((id) => sceneOf(id)).filter((x) => x !== null)
      const inContext = where.find((x) => x.text.includes(whole))
      const scene = inContext ?? where.find((x) => x.text.includes(words))
      /*
        Its words are nowhere in the scene as it went: a change made on another
        of theirs, as a space put right where a move left two sentences run
        together. It stands where the book has it as they left it, words either
        side and all (T18.0: two of the third loop's round 3, read rewritten).
      */
      if (!scene) {
        const theirs = `${lead}${asPlain(c.after)}${asPlain(c.suffix)}`
        if (where.some((x) => x.now.includes(theirs))) sides.push('in')
        else gone = true
        continue
      }
      const from = inContext ? inContext.text.indexOf(whole) + lead.length : scene.text.indexOf(words)
      const to = from + words.length
      // The pieces in its words, or touching them where either is no words at all: a split puts in only a mark.
      scene.items.forEach((item, i) => {
        if (touches(item, from, to)) sides.push(scene.sides[i])
      })
    }
    const of = (b: keyof Tally) => verdicts.push({ changes: group, became: b })
    const stands = !gone && sides.length > 0 && sides.every((x) => x === 'in')
    // Waiting, where the book has not got it as they left it: the writer has decided nothing.
    if (!stands && group.some((c) => waiting.some((w) => sameChange(c, w)))) of('waiting')
    else if (gone || sides.length === 0) of('rewritten')
    else if (sides.every((x) => x === 'in')) of('stand')
    else if (sides.every((x) => x === 'out')) of('turnedBack')
    else of('rewritten')
  }
  return verdicts
}

/**
 * Whether the paragraph mark after paragraph `k` turns an edit back: a
 * paragraph's own, where it is put in or taken out whole; and the one marked
 * on a paragraph that stands, which is the break of the paragraph put in
 * after it (`markedParagraphs`).
 */
export function breakDeclined(paras: readonly MarkedParagraph[], k: number): boolean {
  const p = paras[k]
  if (p.breakMark === 'same') return false
  // The break between a paragraph's halves is its own change (T18.2).
  if (p.joins) return !!p.declined
  return !!(p.mark !== 'same' ? p.declined : paras[k + 1]?.declined)
}

/** Whether a scene has anything marked in it. */
export function hasMarks(paras: readonly MarkedParagraph[]): boolean {
  return paras.some((p) => p.mark !== 'same' || p.joins || p.runs.some((r) => r.kind !== 'same'))
}

/** What a marked export is given (`EditingMarks.marked`), and what it holds, for the dialog to say. */
export interface MarkedPlan {
  marked: {
    author: string
    date: string
    base: (eventId: string) => string | null
    against: string
    titleCount?: string
    threads: Array<{ eventId: string; quote: string; done: boolean; outside?: 'title page' | 'heading'; was?: string; comments: Array<{ author: string; initials: string; text: string; date: string }> }>
    /** The scene as it went to the editor: a change of the writer's that puts it back is signed as an edit declined (T10.1). */
    went?: (eventId: string) => string | null
    /** The editor's changes still waiting in Changes, by scene: not signed as declined (UX-2-3, D-3). */
    waiting?: (eventId: string) => readonly WaitingChange[]
    /** The editor's file's shape, for the book's to be marked against it: chapters, their headings, scene breaks (T15). */
    shape?: BookShape
  }
  changes: number
  /** What of the book's shape is marked, where the scenes said their chapters. */
  shape: ShapeCount | null
  threads: number
  /** Of those changes, how many turn an edit of the editor's back (T10.1). */
  declined: number
  /** What became of the editor's changes, where what they were is known (T10.2). */
  tally: Tally | null
  /** Those of them not taken, in the file's order, for the cover note (T18.1). */
  notTaken: NotTaken[]
}

export { declinedName } from '@/lib/docxEdits'

/** A name's initials, as a comment carries them. */
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 3)

/**
 * The line the marked file says of a thread whose words the writer has since
 * rewritten, so that it goes at its scene's start: the words it was made on.
 *
 * It was written into the editor's own comment, before their words and under
 * their name: on 5 comments of the second loop's round 2, and 10 of round 3.
 * The editor: "I would rather it didn't look as though I'd said it." It is a
 * reply, first under the thread, and is known for the app's coming back, so
 * that it is never one of the writer's replies in Notes (round-trip-plan-3.md,
 * T9.2, D-8).
 *
 * Signed by the app (`APP_SIGNER`) and dated with the comment it is under
 * (round-trip-plan-4.md, T17.1, D-12). Signed by the writer, the third loop's
 * editor read it as theirs: *"in Word they look like your words"*; dated with
 * the export, it went first in its thread, before replies made earlier, and was
 * dated again by each export though nobody touched it.
 */
export const APP_SIGNER = 'Kathala'
const REWRITTEN = 'On words since rewritten:'
export const rewrittenLine = (quote: string) => `${REWRITTEN} “${quote}”`
/**
 * And of a thread on a chapter's heading, in a file made without headings:
 * there is no line for it to stand on, so it goes at its scene's start and
 * says what it was on, the same way (round-trip-plan-3.md, T9.4).
 */
const ON_HEADING = 'On the chapter’s heading:'
export const headingLine = (quote: string) => `${ON_HEADING} “${quote}”`
/** Whether a reply is one of those lines, the app's own. */
export const isRewrittenLine = (text: string) => [REWRITTEN, ON_HEADING].some((line) => text.trimStart().startsWith(line))
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
  sentBack: { id: string; editors?: readonly string[]; titleCount?: string; editorChanges?: readonly EditorChange[] }
  base: DraftBook
  /** The book as it went to the editor, where it is known (`BookDraftRecord.wentAs`). */
  went?: DraftBook | null
  /** The book's scenes in order, and each one's chapter where it is known: the shape is counted then (T15). */
  scenes: ReadonlyArray<{ eventId: string; text: string; chapterId?: string }>
  /** The book's chapters as they are, for their headings. */
  chapters?: ReadonlyArray<{ id: string; number: number; title: string }>
  notes: readonly ProseNote[]
  author: string
  now: number
  /** The editor's changes still waiting in Changes (UX-2-3, D-3). */
  waiting?: readonly WaitingChange[]
}): MarkedPlan {
  const sentBase = new Map(o.base.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
  // Each scene against the part of the editor's text it now holds: a split's halves divide it, a join takes in both (T14.1).
  const base = basesFor(sentBase, o.scenes)
  const { split, joined } = sceneLineage(sentBase, o.scenes)
  const intoOf = new Map([...joined].flatMap(([into, others]) => others.map((id) => [id, into] as const)))
  const became = (id: string) => [...(split.get(id) ?? []), ...(intoOf.has(id) ? [intoOf.get(id)!] : [])]
  const shape = bookShape(o.base, o.scenes)
  const nowChapters = new Map((o.chapters ?? []).map((c) => [c.id, { number: c.number, title: c.title }]))
  const placed = o.scenes.every((s) => s.chapterId) ? o.scenes.map((s) => ({ eventId: s.eventId, chapterId: s.chapterId! })) : null
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
      // On the words that took its words' place: the words it was made on, for the app's line to say (T16).
      ...(place?.replaced ? { was: n.quote } : {}),
      // On the title page or a chapter's heading: it goes back on that line (T9.4).
      ...(n.outside ? { outside: n.outside } : {}),
      comments: [
        // Each with its own date: when the editor said it, and when each reply was made (T9.3).
        { author: by, initials: initials(by), text: n.body, date: commentDate(n.createdAt) },
        ...n.replies.map((r) => {
          const who = r.author.kind === 'me' ? signer : r.author.name ?? 'The editor'
          return { author: who, initials: initials(who), text: r.body, date: commentDate(r.createdAt) }
        }),
      ],
    }
  // A thread on the title page goes whatever scenes go: every file has one.
  }).filter((t) => t.outside === 'title page' || text.has(t.eventId))
  let changes = 0
  const went = o.went ? basesFor(new Map(o.went.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text])), o.scenes) : null
  // What became of each of the editor's changes, where what they were is known (T10.2), and the scene each was in, as their file had it.
  const verdicts = went && o.sentBack.editorChanges?.length
    ? editVerdicts(o.sentBack.editorChanges, (id) => went.get(id) ?? null, (id) => base.get(id) ?? null, (id) => text.get(id) ?? null, became, o.waiting ?? [])
    : null
  const waitingIn = (id: string) => (o.waiting ?? []).filter((w) => w.eventId === id)
  const sceneName = new Map(o.base.chapters.flatMap((c) => c.scenes.map((s) => [s.id, `Chapter ${c.number}, “${s.title || 'Untitled scene'}”`])))
  let declined = 0
  for (const s of o.scenes) {
    // As the export will mark it: a split or join with a comment in its first half marked as before (T18.2).
    const paras = markedParagraphs(base.get(s.eventId) ?? null, s.text, commentedIn(threads, s.eventId, s.text))
    changes += changeCount(paras)
    markDeclined(paras, went?.get(s.eventId) ?? null, { base: base.get(s.eventId) ?? null, waiting: waitingIn(s.eventId) })
    declined += changeItems(paras).filter((c) => c.runs.some((r) => r.declined) || c.paras.some((p) => p.declined)).length
  }
  return {
    marked: {
      author: signer, date: new Date(o.now).toISOString(), base: (id) => base.get(id) ?? null, against: o.sentBack.id, threads, shape,
      ...(o.sentBack.titleCount ? { titleCount: o.sentBack.titleCount } : {}),
      ...(went ? { went: (id: string) => went.get(id) ?? null } : {}),
      ...(o.waiting?.length ? { waiting: waitingIn } : {}),
    },
    changes,
    shape: placed && o.chapters ? shapeCount(shape, placed, (id) => nowChapters.get(id) ?? null) : null,
    threads: threads.length,
    declined,
    tally: verdicts && tallyOf(verdicts),
    notTaken: (verdicts ?? []).flatMap((v): NotTaken[] => (v.became === 'stand' ? [] : [{
      scene: sceneName.get(v.changes[0].eventId) ?? 'A scene since taken out', became: v.became,
      said: changeSaid(v.changes.find((c) => c.after) ?? v.changes[0], v.changes.length > 1 || !!v.changes[0].move),
    }])),
  }
}

