import { Annotation, EditorSelection, EditorState, StateEffect, StateField, type Extension, type Transaction, type StateCommand } from '@codemirror/state'
import {
  composeDraft, readDraft, proseStart, lineEndAt, HEADING_PREFIX,
  type DraftChapter, type DraftHeading, type DraftSegment,
} from '@/lib/draftDocument'

/*
  The Page view's editor state, without the view: which lines are headings,
  and which edits the text is allowed to make.

  A heading is a record — a chapter or a scene, with an id that snapshots,
  goals and History point at — so the document carries each heading's id and
  position beside the text, never in it. In this step the book's structure is
  not edited from the text: a heading cannot be deleted, merged into the line
  above it, have its `#` marks changed, or be split by a line break. Every such
  edit is refused whole, with a reason the page shows. Making structure by
  typing is a later step, and its rules (the editor spike's record describes
  them) are not written here, because nothing in this step can reach them.

  So the only thing that moves a heading is text typed before it, and one rule
  covers that: a heading's start maps *after* anything inserted exactly there.
  The one insertion allowed there is a line break typed at the start of a scene
  heading, which pushes the heading down and leaves the new line to the scene
  above.
*/

/** A change made to match the store, not by the writer: never refused, never undone. */
export const fromStore = Annotation.define<boolean>()

export type Refusal = 'heading' | 'title-break' | 'chapter-text' | 'before-first'

/** Carried by the empty transaction that replaces a refused one. */
export const refused = StateEffect.define<Refusal>()

export const headingsField = StateField.define<DraftHeading[]>({
  create: () => [],
  update(headings, tr) {
    if (!tr.docChanged) return headings
    return headings.map((h) => ({ ...h, pos: tr.changes.mapPos(h.pos, 1) }))
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

function refusalOf(tr: Transaction): Refusal | null {
  if (!tr.docChanged || tr.annotation(fromStore) || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return null
  const doc = tr.startState.doc
  const headings = tr.startState.field(headingsField)
  if (headings.length === 0) return 'before-first'
  let why: Refusal | null = null
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (why) return
    if (fromA < headings[0].pos) { why = 'before-first'; return }

    // Deleting: nothing may touch a heading's line break before it, its `#`
    // marks, its line break after it, or anything between a chapter heading
    // and the next heading — there is no prose there to delete.
    if (toA > fromA) {
      for (let i = Math.max(0, headingAt(headings, fromA)); i < headings.length && headings[i].pos - 1 < toA; i++) {
        const h = headings[i]
        const lineEnd = lineEndAt(doc, h.pos)
        const next = headings[i + 1]?.pos ?? doc.length
        const guarded: Array<[number, number]> = [
          [Math.max(0, h.pos - 1), h.pos + HEADING_PREFIX[h.kind].length],
          [lineEnd, Math.min(doc.length, lineEnd + 1)],
        ]
        if (h.kind === 'chapter') guarded.push([lineEnd, next])
        if (guarded.some(([from, to]) => to > from && fromA < to && toA > from)) { why = 'heading'; return }
      }
    }

    // Inserting, where the change lands.
    if (inserted.length === 0) return
    const text = inserted.toString()
    const i = headingAt(headings, fromA)
    const h = headings[i]
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
  return why
}

/** Refuse, whole, any edit that would change the book's structure. */
export const keepHeadings: Extension = EditorState.transactionFilter.of((tr) => {
  const why = refusalOf(tr)
  return why ? { effects: refused.of(why) } : tr
})

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
  return EditorState.create({ doc: text, extensions: [headingsField.init(() => headings), keepHeadings, ...extensions] })
}

/** Every heading's title and every scene's prose, as the document has them now. */
export function draftSegments(state: EditorState): DraftSegment[] {
  return readDraft(state.doc, state.field(headingsField))
}
