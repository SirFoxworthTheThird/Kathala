import { isProse, type DocParagraph, type EditedDocx } from '@/lib/docxRead'
import { diffWords } from '@/lib/textDiff'
import { CONTEXT_CHARS } from '@/lib/noteAnchor'

/*
  What an editor's Word file says about each scene (editorial-plan.md, R4).

  A file read (`readEditedDocx`) is cut into its scenes — by bookmark, or,
  where an editor's work lost one, by the export's own paragraphs between
  them — and each scene's prose is read two ways:
  - **original**: as if every tracked change were rejected, which is the text
    the editor started from plus anything they changed with tracking off;
  - **edited**: as if every tracked change were accepted, which is what the
    file reads as.
  Italics come back as `_like this_`, the book's own markup, as they went out.

  A change is a hunk (`hunks`): words before, words after, and a little text
  either side to find them by, as a note's anchor is found (`noteAnchor.ts`).
  An insertion takes a word beside it, so every hunk has words to look for.
*/

export interface DocComment { id: string; start: number; end: number }

export interface DocScene {
  /** The scene's bookmark number; null where the bookmark was lost. */
  index: number | null
  original: string
  edited: string
  /** Where each comment's range is, in `edited`. */
  comments: DocComment[]
  /** Who made the tracked changes in it. */
  authors: string[]
  /**
   * Where the file has tracked moves: the scene in two steps between
   * `original` and `edited` — `out`, with only the text moved away taken out,
   * and `moved`, with it put where it went too. A move is then those two steps,
   * its words as the editor moved them, and every other change is from
   * `moved` to `edited` (round-trip-plan.md, T1.2).
   */
  moves?: { out: string; moved: string; words: { from: string[]; to: string[] } }
}

/** Words as a move is matched by: whitespace, and paragraph breaks, aside. */
export function moveWords(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * The runs of text a scene's tracked moves take away (`from`) and put in
 * (`to`), as `moveWords`: a run is the moved text of one paragraph, carried on
 * into the next where the paragraph's own mark moved with it.
 */
function movedRuns(paras: readonly DocParagraph[]): { from: string[]; to: string[] } {
  const out = { from: [] as string[], to: [] as string[] }
  for (const kind of ['del', 'ins'] as const) {
    const runs = out[kind === 'del' ? 'from' : 'to']
    let run = ''
    const end = () => { if (moveWords(run)) runs.push(moveWords(run)); run = '' }
    for (const p of paras) {
      for (const piece of p.pieces) {
        if (!('text' in piece)) continue
        if (piece.kind === kind && piece.moved) run += piece.text
        else if (piece.text.trim()) end()
      }
      if (!(p.mark?.moved && p.mark.kind === kind)) end()
      else run += '\n\n'
    }
    end()
  }
  return out
}

/**
 * Which tracked changes a reading of the file makes: insertions and deletions,
 * and, apart from them, the two halves of a move — the text moved away
 * (`moveFrom`) and where it went (`moveTo`).
 */
interface View { ins: boolean; del: boolean; moveIn: boolean; moveOut: boolean }
const ORIGINAL: View = { ins: false, del: false, moveIn: false, moveOut: false }
const EDITED: View = { ins: true, del: true, moveIn: true, moveOut: true }
const MOVED_OUT: View = { ...ORIGINAL, moveOut: true }
const MOVED: View = { ...ORIGINAL, moveOut: true, moveIn: true }

/** Whether a view makes a change: an insertion, or a deletion, moved or not. */
const makes = (view: View, kind: 'ins' | 'del', moved: boolean | undefined) => (moved ? (kind === 'ins' ? view.moveIn : view.moveOut) : view[kind])

/** One paragraph's text, one way, with where its comment markers fall, italics as `_…_`. */
function paragraphText(p: DocParagraph, view: View): { text: string; marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> } {
  let raw = ''
  const italic: Array<[number, number]> = []
  const marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> = []
  for (const piece of p.pieces) {
    if (!('text' in piece)) {
      marks.push({ id: piece.id, at: raw.length, kind: piece.kind === 'commentStart' ? 'start' : 'end' })
      continue
    }
    const run = piece
    // Text inserted is there where the view makes it, text deleted where it does not.
    if (run.kind !== 'same' && makes(view, run.kind, run.moved) !== (run.kind === 'ins')) continue
    if (run.italic) {
      const last = italic[italic.length - 1]
      if (last && last[1] === raw.length) last[1] += run.text.length
      else italic.push([raw.length, raw.length + run.text.length])
    }
    raw += run.text
  }
  // Each italic stretch's words in underscores; the spaces at its edges stay outside them.
  const inserts: number[] = []
  for (const [a, b] of italic) {
    let s = a
    let e = b
    while (s < e && /\s/.test(raw[s])) s++
    while (e > s && /\s/.test(raw[e - 1])) e--
    if (s < e) inserts.push(s, e)
  }
  let text = ''
  let from = 0
  for (const at of inserts) { text += raw.slice(from, at) + '_'; from = at }
  text += raw.slice(from)
  // A marker's place moves on by the underscores put before it.
  const shift = (at: number) => at + inserts.filter((i) => i < at).length
  return { text, marks: marks.map((m) => ({ ...m, at: shift(m.at) })) }
}

/** The file's scenes: runs of prose paragraphs under one bookmark, or between the export's own paragraphs where there is none. */
export function docScenes(doc: EditedDocx): DocScene[] {
  const groups: DocParagraph[][] = []
  let current: DocParagraph[] | null = null
  for (const p of doc.paragraphs) {
    if (!isProse(p)) { current = null; continue }
    if (!current || current[0].scene !== p.scene) { current = []; groups.push(current) }
    current.push(p)
  }
  return groups.map((paras) => {
    // An unwritten scene's placeholder is the export's, not the book's.
    const placeholder = (p: DocParagraph) => paragraphText(p, ORIGINAL).text.trim() === '[No prose yet]' && paragraphText(p, EDITED).text.trim() === '[No prose yet]'
    const prose = paras.filter((p) => !placeholder(p))
    const original = joined(prose, ORIGINAL)
    const edited = joined(prose, EDITED)
    const hasMoves = prose.some((p) => p.mark?.moved || p.pieces.some((x) => 'moved' in x && x.moved))
    const open = new Map<string, number>()
    const comments: DocComment[] = []
    for (const m of edited.marks) {
      if (m.kind === 'start') open.set(m.id, m.at)
      else comments.push({ id: m.id, start: open.get(m.id) ?? m.at, end: m.at })
    }
    const authors = [...new Set(paras.flatMap((p) => [
      ...p.pieces.flatMap((x) => ('author' in x && x.author && x.kind !== 'same' ? [x.author] : [])),
      ...(p.mark?.author ? [p.mark.author] : []),
    ]))]
    return {
      index: paras[0].scene, original: original.text, edited: edited.text, comments, authors,
      ...(hasMoves ? { moves: { out: joined(prose, MOVED_OUT).text, moved: joined(prose, MOVED).text, words: movedRuns(prose) } } : {}),
    }
  }).filter((s) => s.original.trim() || s.edited.trim())
}

/**
 * A scene's paragraphs, one way, as the book's text: a blank line between
 * paragraphs, except where a tracked mark says that, this way, there is no
 * break — an inserted mark before the change, a deleted one after it — and
 * the paragraph runs on into the next. A paragraph with no words this way (one
 * the change puts in, or takes out) is not there, and passes its mark on to
 * the paragraph it was joined to. Comment markers are placed in the text.
 */
function joined(paras: readonly DocParagraph[], view: View): { text: string; marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> } {
  // No break after a paragraph whose mark is inserted where the view does not make it, or deleted where it does.
  const unbroken = (p: DocParagraph) => !!p.mark && makes(view, p.mark.kind, p.mark.moved) === (p.mark.kind === 'del')
  const out: string[] = []
  const marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> = []
  let offset = 0 // where the paragraph being built starts in the text
  let current = ''
  let currentMarks: typeof marks = []
  const flush = () => {
    if (current.trim()) {
      marks.push(...currentMarks.map((m) => ({ ...m, at: offset + m.at })))
      out.push(current)
      offset += current.length + 2
    } else {
      // A paragraph with no words keeps its comment markers, where the next paragraph starts.
      marks.push(...currentMarks.map((m) => ({ ...m, at: offset })))
    }
    current = ''
    currentMarks = []
  }
  for (const p of paras) {
    const t = paragraphText(p, view)
    currentMarks.push(...t.marks.map((m) => ({ ...m, at: current.length + m.at })))
    current += t.text
    if (!unbroken(p)) flush()
  }
  flush()
  return { text: out.join('\n\n'), marks }
}

/**
 * A change as it is shown: the whole words its two sides share at either end
 * taken off, so an insertion anchored on the word before it shows only what
 * it adds ("dawn." made "dawn in the rain." is " in the rain" put in after
 * "dawn"), and the rest is one stretch out and one in. Never inside a word:
 * "was" made "were" is the word changed, not "as" made "ere".
 */
export function shownChange(before: string, after: string): { lead: string; out: string; in: string; tail: string } {
  const word = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_'’]/u.test(c)
  const edge = (t: string, i: number) => !(word(t[i - 1]) && word(t[i]))
  let p = 0
  while (p < before.length && p < after.length && before[p] === after[p]) p++
  while (p > 0 && !(edge(before, p) && edge(after, p))) p--
  let q = 0
  while (q < before.length - p && q < after.length - p && before[before.length - 1 - q] === after[after.length - 1 - q]) q++
  while (q > 0 && !(edge(before, before.length - q) && edge(after, after.length - q))) q--
  return { lead: before.slice(0, p), out: before.slice(p, before.length - q), in: after.slice(p, after.length - q), tail: before.slice(before.length - q) }
}

/**
 * Whether a change only breaks a paragraph in two, or joins two: its words the
 * same either side, the paragraph breaks between them not. Null for a change
 * to words, with or without a break in it.
 */
export function breakChange(before: string, after: string): 'split' | 'join' | null {
  if (before.replace(/\s+/g, '') !== after.replace(/\s+/g, '')) return null
  const breaks = (t: string) => (t.match(/\n\s*\n/g) ?? []).length
  const [b, a] = [breaks(before), breaks(after)]
  return a > b ? 'split' : a < b ? 'join' : null
}

/** A change's words as shown on one line: each paragraph break a pilcrow, which a space or a line end would hide. */
export function showBreaks(text: string): string {
  return text.replace(/[ \t]*\n\s*\n[ \t]*/g, ' ¶ ')
}

export interface Hunk {
  /** The words to replace, and what with. */
  before: string
  after: string
  /** A little of the text either side of `before`, in the text compared from. */
  prefix: string
  suffix: string
}

function paragraphsOf(text: string): string[] {
  return text.split(/\n\s*\n/)
}

/**
 * The changes from `a` to `b`, as hunks. Paragraphs first — those the same in
 * both are passed over without comparing their words, which keeps a long
 * scene's diff small — then words, within the paragraphs that changed.
 */
export function hunks(a: string, b: string): Hunk[] {
  return locatedHunks(a, b).map((l) => l.hunk)
}

/** A hunk, with where its words are in the text compared from (`from`, `to`) and where its new words are in the text compared to (`toFrom`, `toTo`). */
export interface LocatedHunk { hunk: Hunk; from: number; to: number; toFrom: number; toTo: number }

/** `hunks`, each with where it is in both texts. */
export function locatedHunks(a: string, b: string): LocatedHunk[] {
  if (a === b) return []
  const pa = paragraphsOf(a)
  const pb = paragraphsOf(b)
  // Paragraphs in common, in order (an LCS over paragraphs).
  const n = pa.length
  const m = pb.length
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = pa[i] === pb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])

  const out: LocatedHunk[] = []
  // Where each paragraph starts, in `a` and in `b`.
  const starts = (ps: string[], whole: string) => {
    const out: number[] = []
    let at = 0
    for (const p of ps) { out.push(at); at += p.length + 2 }
    out.push(whole.length + 2)
    return out
  }
  const startOf = starts(pa, a)
  const startOfB = starts(pb, b)

  // A run of paragraphs that changed: `a[i0, i1)` became `b[j0, j1)`. Compared word by word, joined as they are in the text.
  const changed = (i0: number, i1: number, j0: number, j1: number) => {
    const before = pa.slice(i0, i1).join('\n\n')
    const after = pb.slice(j0, j1).join('\n\n')
    // A run with nothing in `a`: the paragraphs were added after paragraph i0 - 1 (or before the first).
    const base = i0 < n ? startOf[i0] : a.length
    const baseB = j0 < m ? startOfB[j0] : b.length
    if (i0 === i1) {
      const joinAfter = i0 > 0
      const anchor = joinAfter ? pa[i0 - 1] : pa[0] ?? ''
      if (joinAfter) {
        const from = startOf[i0 - 1]
        out.push({ hunk: withContext(a, from, from + anchor.length, anchor, `${anchor}\n\n${after}`), from, to: from + anchor.length, toFrom: startOfB[j0 - 1], toTo: baseB + after.length })
      } else {
        out.push({ hunk: withContext(a, 0, anchor.length, anchor, `${after}\n\n${anchor}`), from: 0, to: anchor.length, toFrom: 0, toTo: after.length + 2 + anchor.length })
      }
      return
    }
    out.push(...wordHunks(a, base, baseB, before, after))
  }

  let i = 0
  let j = 0
  let i0 = 0
  let j0 = 0
  while (i < n || j < m) {
    if (i < n && j < m && pa[i] === pb[j]) {
      if (i0 < i || j0 < j) changed(i0, i, j0, j)
      i++; j++; i0 = i; j0 = j
    } else if (j >= m || (i < n && t[i + 1][j] >= t[i][j + 1])) i++
    else j++
  }
  if (i0 < n || j0 < m) changed(i0, n, j0, m)
  return out
}

/** The word changes from `before` to `after`, where `before` starts at `base` in `whole`, and `after` at `baseB` in the text compared to. */
function wordHunks(whole: string, base: number, baseB: number, before: string, after: string): LocatedHunk[] {
  const out: LocatedHunk[] = []
  const tokens = diffWords(before, after)
  let pos = 0 // in `before`
  let posB = 0 // in `after`
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k]
    if (tok.op === 'equal') { pos += tok.text.length; posB += tok.text.length; continue }
    /*
      A change: a run of removals and additions, until the next equal stretch
      of words. Only a space between two changed words does not end it: "belonged
      to her" made "was hers" is one change, not two, the second of which would
      be anchored on words the first has just replaced.
    */
    let removed = ''
    let added = ''
    const start = pos
    const startB = posB
    const joins = (t: number) => tokens[t].op === 'equal' && /^\s+$/.test(tokens[t].text) && t + 1 < tokens.length && tokens[t + 1].op !== 'equal'
    while (k < tokens.length && (tokens[k].op !== 'equal' || joins(k))) {
      const { op, text } = tokens[k]
      if (op !== 'add') { removed += text; pos += text.length }
      if (op !== 'remove') { added += text; posB += text.length }
      k++
    }
    k--
    let from = base + start
    let to = base + pos
    let toFrom = baseB + startB
    let toTo = baseB + posB
    let after_ = added
    // Every hunk has words to look for: an insertion takes the word before it, or after it at the start.
    if (removed.trim() === '') {
      const prev = whole.slice(0, from).match(/\S+\s*$/)
      if (prev) { from -= prev[0].length; toFrom -= prev[0].length; after_ = prev[0] + added }
      else {
        const next = whole.slice(to).match(/^\s*\S+/)
        if (next) { after_ = added + next[0]; to += next[0].length; toTo += next[0].length }
      }
    }
    out.push({ hunk: withContext(whole, from, to, whole.slice(from, to), after_), from, to, toFrom, toTo })
  }
  return out
}

/**
 * A hunk taking `length` characters out of `text` at `at` (`put` empty), or
 * putting `put` in there (`length` 0): anchored on the word before, as every
 * insertion is, or the word after at the start.
 */
export function hunkAt(text: string, at: number, length: number, put: string): Hunk {
  let from = at
  let to = at + length
  let after = put
  if (length === 0) {
    const prev = text.slice(0, from).match(/\S+\s*$/)
    if (prev) { from -= prev[0].length; after = prev[0] + put }
    else {
      const next = text.slice(to).match(/^\s*\S+/)
      if (next) { after = put + next[0]; to += next[0].length }
    }
  }
  return withContext(text, from, to, text.slice(from, to), after)
}

function withContext(whole: string, from: number, to: number, before: string, after: string): Hunk {
  return { before, after, prefix: whole.slice(Math.max(0, from - CONTEXT_CHARS), from), suffix: whole.slice(to, to + CONTEXT_CHARS) }
}
