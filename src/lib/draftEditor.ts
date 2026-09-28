import { EditorSelection, EditorState, StateEffect, StateField, type Extension, type Transaction, type StateCommand } from '@codemirror/state'
import {
  composeDraft, readDraft, proseStart, lineEndAt, HEADING_PREFIX,
  type DraftChapter, type DraftHeading, type DraftSegment,
} from '@/lib/draftDocument'

/*
  The Page view's editor state, without the view: which lines are headings,
  and which edits the text is allowed to make.

  A heading is a record — a chapter or a scene, with an id that snapshots,
  goals and History point at — so the document carries each heading's id and
  position beside the text, never in it.

  Two edits change the book's scenes, and each is one act on the records:

  - **A line typed as `## Title`** inside a scene's prose splits the scene
    there, once the caret leaves the line — not on every keystroke, or `## T`
    would make a scene called "T". `lineTyped` follows the line being typed on,
    and `typedHeading` says whether the line just left is one. Only a line the
    writer typed on counts: a line of prose that already started with `## `,
    in a book imported that way, stays prose until it is edited.
  - **Deleting a scene heading's whole line** joins that scene to the one
    before it. The heading goes from the document at once, with a `joined`
    effect naming both scenes, so the page can make the records agree.

  Everything else that would change the structure is refused whole, with a
  reason the page shows: part of a heading, a chapter heading, the first scene
  of a chapter (there is no scene before it to join), two headings at once, a
  line break in a title, and text where no scene could keep it.

  Apart from those, the only thing that moves a heading is text typed before
  it, and one rule covers that: a heading's start maps *after* anything
  inserted exactly there. The one insertion allowed there is a line break typed
  at the start of a scene heading, which pushes the heading down and leaves
  the new line to the scene above.
*/

export type Refusal = 'heading' | 'chapter-heading' | 'first-scene' | 'two-headings' | 'title-break' | 'chapter-text' | 'before-first'

/** Carried by the empty transaction that replaces a refused one. */
export const refused = StateEffect.define<Refusal>()

/**
 * A scene heading deleted whole: `id` is joined onto `into`, the scene before
 * it. `at` is where the deletion started, in the document before it.
 */
export interface Join { id: string; into: string; at: number }
export const joined = StateEffect.define<Join>()

export const headingsField = StateField.define<DraftHeading[]>({
  create: () => [],
  update(headings, tr) {
    if (!tr.docChanged) return headings
    const gone = new Set(tr.effects.filter((e) => e.is(joined)).map((e) => (e.value as Join).id))
    return headings.filter((h) => !gone.has(h.id)).map((h) => ({ ...h, pos: tr.changes.mapPos(h.pos, 1) }))
  },
})

/** The last heading at or before `pos`, or -1 before the first. */
function headingAt(headings: readonly DraftHeading[], pos: number): number {
  let lo = 0
  let hi = headings.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (headings[mid].pos <= pos) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

function judge(tr: Transaction): { why: Refusal | null; join: Join | null } {
  // Undo and redo never reach here: CodeMirror's history dispatches them with
  // `filter: false`, and they only step back to states these rules allowed.
  if (!tr.docChanged) return { why: null, join: null }
  const doc = tr.startState.doc
  const headings = tr.startState.field(headingsField)
  if (headings.length === 0) return { why: 'before-first', join: null }
  let why: Refusal | null = null
  let join: Join | null = null
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (why) return
    // Deleting: a heading goes whole or not at all. Nothing may touch part of
    // one — its line break before, its `#` marks, its line break after. Under a
    // chapter heading that is all there is — the break after it and the break
    // before the scene heading that follows — since nothing may be typed there.
    if (toA > fromA) {
      for (let i = Math.max(0, headingAt(headings, fromA)); i < headings.length && headings[i].pos - 1 < toA; i++) {
        const h = headings[i]
        const lineEnd = lineEndAt(doc, h.pos)
        if (fromA <= h.pos && toA >= lineEnd) {
          if (h.kind === 'chapter') { why = 'chapter-heading'; return }
          if (i === 0 || headings[i - 1].kind === 'chapter') { why = 'first-scene'; return }
          if (join) { why = 'two-headings'; return }
          join = { id: h.id, into: headings[i - 1].id, at: fromA }
          continue
        }
        const guarded: Array<[number, number]> = [
          [Math.max(0, h.pos - 1), h.pos + HEADING_PREFIX[h.kind].length],
          [lineEnd, Math.min(doc.length, lineEnd + 1)],
        ]
        if (guarded.some(([from, to]) => to > from && fromA < to && toA > from)) { why = 'heading'; return }
      }
    }

    // Inserting, where the change lands.
    if (inserted.length === 0) return
    const text = inserted.toString()
    const i = headingAt(headings, fromA)
    const h = headings[i]
    // Replacing a heading deleted whole: what is typed lands in the scene before.
    if (join && h.id === (join as Join).id) return
    const titleFrom = h.pos + HEADING_PREFIX[h.kind].length
    const lineEnd = lineEndAt(doc, h.pos)
    if (fromA === h.pos) {
      // Above a heading: only a line break typed at the start of a scene
      // heading, and only where the line it makes belongs to a scene.
      if (i === 0) why = 'before-first'
      else if (!(h.kind === 'scene' && text.endsWith('\n') && headings[i - 1].kind === 'scene')) why = 'heading'
    } else if (fromA < titleFrom) {
      why = 'heading'
    } else if (fromA < lineEnd) {
      if (text.includes('\n')) why = 'title-break'
    } else if (fromA === lineEnd) {
      if (text.includes('\n') && h.kind === 'chapter') why = 'chapter-text'
    } else if (h.kind === 'chapter') {
      why = 'chapter-text'
    }
  })
  return why ? { why, join: null } : { why: null, join }
}

/** Refuse, whole, any edit that would change the book's structure other than a join. */
export const keepHeadings: Extension = EditorState.transactionFilter.of((tr) => {
  const { why, join } = judge(tr)
  if (why) return { effects: refused.of(why) }
  return join ? [tr, { effects: joined.of(join) }] : tr
})

/**
 * The line the writer is typing on, if it is in a scene's prose, and the one
 * they have just left. Positions are line starts, mapped through later edits.
 */
interface Typing { line: number | null; left: number | null }

/** Clears `left` once the page has looked at it. */
export const settled = StateEffect.define<null>()

export const lineTyped = StateField.define<Typing>({
  create: () => ({ line: null, left: null }),
  update(value, tr) {
    let { line, left } = value
    if (tr.effects.some((e) => e.is(settled))) left = null
    if (tr.docChanged) {
      line = line === null ? null : tr.changes.mapPos(line, -1)
      left = left === null ? null : tr.changes.mapPos(left, -1)
    }
    const doc = tr.state.doc
    const caretLine = doc.lineAt(tr.state.selection.main.head).from
    if (line !== null && caretLine !== line) { left = line; line = null }
    if (tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete'))) {
      line = inSceneProse(tr.state, caretLine) ? caretLine : null
    }
    return line === value.line && left === value.left ? value : { line, left }
  },
})

/** Whether the line starting at `pos` is prose of a scene: below its heading's line, above the next heading. */
function inSceneProse(state: EditorState, pos: number): boolean {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  if (i < 0 || headings[i].kind !== 'scene') return false
  return pos > lineEndAt(state.doc, headings[i].pos)
}

/** A scene heading, as typed: `## ` and a title. Three or more marks are prose. */
const TYPED_SCENE = /^## (?!#)(.*\S.*)$/

export interface TypedHeading {
  /** The scene the line was typed in. */
  sceneId: string
  title: string
  /** The scene's prose with the heading line taken out, and where the new scene starts in it. */
  prose: string
  at: number
}

/**
 * The line starting at `pos`, if it is a scene heading typed into a scene's
 * prose: the scene to split, the new scene's title, and the cut.
 */
export function typedHeading(state: EditorState, pos: number): TypedHeading | null {
  if (!inSceneProse(state, pos)) return null
  const doc = state.doc
  const line = doc.lineAt(pos)
  const match = TYPED_SCENE.exec(line.text)
  if (!match) return null
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  const segment = draftSegments(state)[i]
  const from = line.from - proseFromOf(state, i)
  const head = segment.text.slice(0, from).replace(/\s+$/, '')
  const tail = segment.text.slice(from + line.length).replace(/^\s+/, '')
  return {
    sceneId: segment.id,
    title: match[1].trim(),
    prose: [head, tail].filter(Boolean).join('\n\n'),
    at: head.length,
  }
}

/**
 * The prose of a scene after a join: what the page shows under it now. Where
 * the deletion left the seam on blank lines — a heading's line deleted whole
 * leaves the blank lines that were either side of it — they close up to one
 * paragraph break, the seam `joinWithNext` makes. A deletion that ended
 * mid-line joined the words into one line, and that is kept as it is.
 */
export function joinedProse(state: EditorState, into: string, seam: number): string {
  const headings = state.field(headingsField)
  const i = headings.findIndex((h) => h.id === into)
  const text = draftSegments(state)[i].text
  const at = Math.max(0, Math.min(text.length, seam - proseFromOf(state, i)))
  const before = text.slice(0, at)
  const after = text.slice(at)
  if (!before.endsWith('\n') && !after.startsWith('\n')) return text
  return [before.replace(/\s+$/, ''), after.replace(/^\s+/, '')].filter(Boolean).join('\n\n')
}

/** Where the prose of heading `i` starts in the document: `readDraft` drops up to two line breaks after its line. */
function proseFromOf(state: EditorState, i: number): number {
  const afterTitle = lineEndAt(state.doc, state.field(headingsField)[i].pos)
  const lead = state.doc.sliceString(afterTitle, afterTitle + 2)
  return afterTitle + (lead === '\n\n' ? 2 : lead.startsWith('\n') ? 1 : 0)
}

/**
 * Enter on a heading goes to the prose under it rather than breaking the title
 * in two — the way out of a title a writer reaches for. On a scene with no
 * prose at the end of the book, it makes the line to write on. On a chapter,
 * it goes to the chapter's first scene. At the very start of a heading's line
 * it is left to the default, which pushes the heading down.
 */
export const enterOnHeading: StateCommand = ({ state, dispatch }) => {
  const sel = state.selection.main
  if (!sel.empty) return false
  const headings = state.field(headingsField)
  const i = headingAt(headings, sel.head)
  if (i < 0) return false
  const h = headings[i]
  const lineEnd = lineEndAt(state.doc, h.pos)
  if (sel.head === h.pos || sel.head > lineEnd) return false
  const target = h.kind === 'scene' ? i : (headings[i + 1]?.kind === 'scene' ? i + 1 : -1)
  if (target < 0) return true
  const at = proseStart(state.doc, headings, target)
  if (at !== null) {
    dispatch(state.update({ selection: EditorSelection.cursor(at), scrollIntoView: true, userEvent: 'select' }))
  } else {
    const end = lineEndAt(state.doc, headings[target].pos)
    dispatch(state.update({ changes: { from: end, insert: '\n\n' }, selection: EditorSelection.cursor(end + 2), scrollIntoView: true, userEvent: 'input' }))
  }
  return true
}

/** The book, as a starting state: the text, the headings, and the rules. */
export function draftState(chapters: DraftChapter[], extensions: Extension[] = []): EditorState {
  const { text, headings } = composeDraft(chapters)
  return EditorState.create({ doc: text, extensions: [headingsField.init(() => headings), keepHeadings, lineTyped, ...extensions] })
}

/** Every heading's title and every scene's prose, as the document has them now. */
export function draftSegments(state: EditorState): DraftSegment[] {
  return readDraft(state.doc, state.field(headingsField))
}
