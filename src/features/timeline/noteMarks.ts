import { EditorView, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { StateEffect, type Range } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'
import { placeNote } from '@/lib/noteAnchor'
import type { ProseNote } from '@/types'

/*
  Notes on the prose, marked on the Page (editorial-plan.md, R1): each open
  note's passage lightly highlighted, found in the scene's prose as it is being
  typed (`placeNote`), so a mark follows its words while the writer works
  around them. Clicking one opens the note.

  A note is looked for in the scene it was last found in — its own, or the one
  a split or join moved its words to, as the Notes panel places it against
  the whole book — so only the scenes in view are read.
*/

export interface NoteMarkInfo {
  /** The notes to mark: the open ones. */
  notes: readonly ProseNote[]
  /** The scene each note was last found in, where that is not its own. */
  foundIn: ReadonlyMap<string, string | null>
  /** A mark was clicked. */
  open: (noteId: string) => void
}

/** Draw the marks again: the notes, or where they are, have changed. */
export const redrawNotes = StateEffect.define<null>()

export function noteMarks(info: { current: NoteMarkInfo }) {
  const build = (view: EditorView): DecorationSet => {
    const { notes, foundIn } = info.current
    if (notes.length === 0) return Decoration.none
    const marks: Range<Decoration>[] = []
    const headings = view.state.field(headingsField)
    headings.forEach((h, i) => {
      if (h.kind !== 'scene') return
      const end = headings[i + 1]?.pos ?? view.state.doc.length
      if (!view.visibleRanges.some(({ from, to }) => end >= from && h.pos <= to)) return
      const here = notes.filter((n) => (foundIn.get(n.id) ?? n.eventId) === h.id)
      if (here.length === 0) return
      const region = regionOf(view.state, i)
      for (const note of here) {
        const place = placeNote({ ...note, eventId: h.id }, [{ eventId: h.id, text: region.text }])
        if (!place || place.to <= place.from) continue
        marks.push(Decoration.mark({
          class: 'cm-prose-note',
          attributes: { 'data-note-id': note.id, title: note.body ? `Note: ${note.body}` : 'Note' },
        }).range(region.bodyFrom + place.from, region.bodyFrom + place.to))
      }
    })
    return Decoration.set(marks, true)
  }
  return [
    ViewPlugin.fromClass(class {
      decorations: DecorationSet
      constructor(view: EditorView) { this.decorations = build(view) }
      update(u: ViewUpdate) {
        const redraw = u.transactions.some((tr) => tr.effects.some((e) => e.is(redrawNotes)))
        if (u.docChanged || u.viewportChanged || redraw) this.decorations = build(u.view)
      }
    }, { decorations: (v) => v.decorations }),
    // A click on a mark opens its note; the caret still goes where it was clicked.
    EditorView.domEventHandlers({
      click: (e) => {
        const mark = (e.target as HTMLElement | null)?.closest?.('[data-note-id]')
        const id = mark?.getAttribute('data-note-id')
        if (id) info.current.open(id)
        return false
      },
    }),
  ]
}

export const NOTE_THEME = {
  '.cm-prose-note': {
    backgroundColor: 'rgb(250 204 21 / 0.22)',
    borderBottom: '2px solid rgb(234 179 8 / 0.7)',
    cursor: 'pointer',
  },
}
