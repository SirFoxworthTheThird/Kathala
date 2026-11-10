import { diffWords } from '@/lib/textDiff'
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
  and the rest paired in order and compared word by word. A paragraph left over
  on either side is inserted or deleted whole, its paragraph mark with it, so
  that rejecting every change gives back the editor's text and accepting every
  one gives the writer's: the test the reader keeps (`markedDocx.test.ts`).
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

/** One paragraph against another, word by word. */
function pairRuns(before: { text: string; em: boolean[] }, after: { text: string; em: boolean[] }): MarkedRun[] {
  const out: MarkedRun[] = []
  let a = 0
  let b = 0
  for (const t of diffWords(before.text, after.text)) {
    if (t.op === 'equal') { out.push(...runsOf('same', t.text, after.em, b)); a += t.text.length; b += t.text.length }
    else if (t.op === 'remove') { out.push(...runsOf('del', t.text, before.em, a)); a += t.text.length }
    else { out.push(...runsOf('ins', t.text, after.em, b)); b += t.text.length }
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
  // Between two paragraphs the same in both, the ones that differ: paired in order, and any left over whole.
  const gap = (wasFrom: number, wasTo: number, nowFrom: number, nowTo: number) => {
    const pairs = Math.min(wasTo - wasFrom, nowTo - nowFrom)
    for (let k = 0; k < pairs; k++) {
      const p = now[nowFrom + k]
      out.push({ mark: 'same', verse: p.verse, runs: pairRuns(plain(was[wasFrom + k].text, was[wasFrom + k].verse), plain(p.text, p.verse)), breakMark: 'same' })
    }
    for (let k = wasFrom + pairs; k < wasTo; k++) out.push(whole('del', was[k]))
    for (let k = nowFrom + pairs; k < nowTo; k++) out.push(whole('ins', now[k]))
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
    threads: Array<{ eventId: string; quote: string; done: boolean; comments: Array<{ author: string; initials: string; text: string }> }>
  }
  changes: number
  threads: number
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 3)

/**
 * The marked export of the book as it is, against the book as an editor's
 * file sent it back (round-trip-plan-2.md, T5.4): each scene's changes, signed
 * `author` (D-6), and the threads of that file's editors — their notes, with
 * the writer's replies under them — on their words as the book now has them,
 * or quoted where those are gone (D-5).
 */
export function markedPlan(o: {
  sentBack: { id: string; editors?: readonly string[] }
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
        { author: by, initials: initials(by), text: n.body },
        ...n.replies.map((r) => {
          const who = r.author.kind === 'me' ? signer : r.author.name ?? 'The editor'
          return { author: who, initials: initials(who), text: r.body }
        }),
      ],
    }
  }).filter((t) => text.has(t.eventId))
  let changes = 0
  for (const s of o.scenes) {
    for (const p of markedParagraphs(base.get(s.eventId) ?? null, s.text)) {
      // Each stretch put in or taken out; a word replaced, out and in side by side, counts once.
      p.runs.forEach((r, i) => { if (r.kind !== 'same' && !(r.kind === 'ins' && p.runs[i - 1]?.kind === 'del')) changes++ })
    }
  }
  return {
    marked: { author: signer, date: new Date(o.now).toISOString(), base: (id) => base.get(id) ?? null, against: o.sentBack.id, threads },
    changes,
    threads: threads.length,
  }
}

