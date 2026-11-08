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
}

/** One paragraph's text, one way, with where its comment markers fall, italics as `_…_`. */
function paragraphText(p: DocParagraph, view: 'original' | 'edited'): { text: string; marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> } {
  const keep = view === 'original' ? 'del' : 'ins'
  let raw = ''
  const italic: Array<[number, number]> = []
  const marks: Array<{ id: string; at: number; kind: 'start' | 'end' }> = []
  for (const piece of p.pieces) {
    if (piece.kind === 'commentStart' || piece.kind === 'commentEnd') {
      marks.push({ id: piece.id, at: raw.length, kind: piece.kind === 'commentStart' ? 'start' : 'end' })
      continue
    }
    if (piece.kind !== 'same' && piece.kind !== keep) continue
    if (piece.italic) {
      const last = italic[italic.length - 1]
      if (last && last[1] === raw.length) last[1] += piece.text.length
      else italic.push([raw.length, raw.length + piece.text.length])
    }
    raw += piece.text
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
    const original: string[] = []
    const edited: string[] = []
    const open = new Map<string, number>()
    const comments: DocComment[] = []
    let offset = 0
    for (const p of paras) {
      const o = paragraphText(p, 'original').text
      const e = paragraphText(p, 'edited')
      // An unwritten scene's placeholder is the export's, not the book's.
      if (o.trim() === '[No prose yet]' && e.text.trim() === '[No prose yet]') continue
      if (o.trim()) original.push(o)
      if (!e.text.trim()) continue
      for (const m of e.marks) {
        if (m.kind === 'start') open.set(m.id, offset + m.at)
        else comments.push({ id: m.id, start: open.get(m.id) ?? offset, end: offset + m.at })
      }
      edited.push(e.text)
      offset += e.text.length + 2
    }
    const authors = [...new Set(paras.flatMap((p) => p.pieces.flatMap((x) => ('author' in x && x.author && x.kind !== 'same' ? [x.author] : []))))]
    return { index: paras[0].scene, original: original.join('\n\n'), edited: edited.join('\n\n'), comments, authors }
  }).filter((s) => s.original.trim() || s.edited.trim())
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
  if (a === b) return []
  const pa = paragraphsOf(a)
  const pb = paragraphsOf(b)
  // Paragraphs in common, in order (an LCS over paragraphs).
  const n = pa.length
  const m = pb.length
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = pa[i] === pb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])

  const out: Hunk[] = []
  // Where each paragraph of `a` starts in `a`.
  const startOf: number[] = []
  let at = 0
  for (const p of pa) { startOf.push(at); at += p.length + 2 }
  startOf.push(a.length + 2)

  // A run of paragraphs that changed: `a[i0, i1)` became `b[j0, j1)`. Compared word by word, joined as they are in the text.
  const changed = (i0: number, i1: number, j0: number, j1: number) => {
    const before = pa.slice(i0, i1).join('\n\n')
    const after = pb.slice(j0, j1).join('\n\n')
    // A run with nothing in `a`: the paragraphs were added after paragraph i0 - 1 (or before the first).
    const base = i0 < n ? startOf[i0] : a.length
    if (i0 === i1) {
      const joinAfter = i0 > 0
      const anchor = joinAfter ? pa[i0 - 1] : pa[0] ?? ''
      out.push(joinAfter
        ? withContext(a, startOf[i0 - 1], startOf[i0 - 1] + anchor.length, anchor, `${anchor}\n\n${after}`)
        : withContext(a, 0, anchor.length, anchor, `${after}\n\n${anchor}`))
      return
    }
    out.push(...wordHunks(a, base, before, after))
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

/** The word changes from `before` to `after`, where `before` starts at `base` in `whole`. */
function wordHunks(whole: string, base: number, before: string, after: string): Hunk[] {
  const out: Hunk[] = []
  const tokens = diffWords(before, after)
  let pos = 0 // in `before`
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k]
    if (tok.op === 'equal') { pos += tok.text.length; continue }
    /*
      A change: a run of removals and additions, until the next equal stretch
      of words. Only a space between two changed words does not end it: "belonged
      to her" made "was hers" is one change, not two, the second of which would
      be anchored on words the first has just replaced.
    */
    let removed = ''
    let added = ''
    const start = pos
    const joins = (t: number) => tokens[t].op === 'equal' && /^\s+$/.test(tokens[t].text) && t + 1 < tokens.length && tokens[t + 1].op !== 'equal'
    while (k < tokens.length && (tokens[k].op !== 'equal' || joins(k))) {
      const { op, text } = tokens[k]
      if (op !== 'add') { removed += text; pos += text.length }
      if (op !== 'remove') added += text
      k++
    }
    k--
    let from = base + start
    let to = base + pos
    let after_ = added
    // Every hunk has words to look for: an insertion takes the word before it, or after it at the start.
    if (removed.trim() === '') {
      const prev = whole.slice(0, from).match(/\S+\s*$/)
      if (prev) { from -= prev[0].length; after_ = prev[0] + added }
      else {
        const next = whole.slice(to).match(/^\s*\S+/)
        if (next) { after_ = added + next[0]; to += next[0].length }
      }
    }
    out.push(withContext(whole, from, to, whole.slice(from, to), after_))
  }
  return out
}

function withContext(whole: string, from: number, to: number, before: string, after: string): Hunk {
  return { before, after, prefix: whole.slice(Math.max(0, from - CONTEXT_CHARS), from), suffix: whole.slice(to, to + CONTEXT_CHARS) }
}
