import { EditorView, Decoration, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { StateEffect, type Range } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'
import { placeNote } from '@/lib/noteAnchor'
import { breakChange, showBreaks, shownChange } from '@/lib/docxEdits'
import type { EditSuggestion } from '@/types'

/*
  An editor's changes, shown where they would go on the Page (editorial-plan.md,
  R4): the words a change replaces struck through, and what it puts in their
  place beside them. Each is found in the scene's prose as it is being typed,
  as a note's words are (`placeNote`). Clicking one opens it to be decided.
*/

export interface EditMarkInfo {
  suggestions: readonly EditSuggestion[]
  open: (id: string) => void
}

/** Draw the marks again: the suggestions have changed. */
export const redrawEdits = StateEffect.define<null>()

class Insertion extends WidgetType {
  readonly text: string
  readonly id: string
  readonly title: string
  constructor(text: string, id: string, title = '') { super(); this.text = text; this.id = id; this.title = title }
  eq(other: Insertion) { return other.text === this.text && other.id === this.id && other.title === this.title }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-edit-ins'
    span.textContent = this.text
    span.dataset.editId = this.id
    if (this.title) span.title = this.title
    return span
  }
  ignoreEvent() { return false }
}

export function editMarks(info: { current: EditMarkInfo }) {
  const build = (view: EditorView): DecorationSet => {
    const { suggestions } = info.current
    if (suggestions.length === 0) return Decoration.none
    const marks: Range<Decoration>[] = []
    const headings = view.state.field(headingsField)
    headings.forEach((h, i) => {
      if (h.kind !== 'scene') return
      const end = headings[i + 1]?.pos ?? view.state.doc.length
      if (!view.visibleRanges.some(({ from, to }) => end >= from && h.pos <= to)) return
      const here = suggestions.filter((s) => s.eventId === h.id)
      if (here.length === 0) return
      const region = regionOf(view.state, i)
      for (const s of here) {
        const place = placeNote({ eventId: h.id, quote: s.before, prefix: s.prefix, suffix: s.suffix }, [{ eventId: h.id, text: region.text }])
        if (!place || place.to <= place.from) continue
        // Only what changes is marked: an insertion anchored on the word before it strikes nothing.
        const words = region.text.slice(place.from, place.to)
        const shown = shownChange(words, s.after)
        const from = region.bodyFrom + place.from + shown.lead.length
        const to = region.bodyFrom + place.to - shown.tail.length
        const by = s.author ? `${s.author}: ` : ''
        // A paragraph broken or joined is a mark of its own: struck or inserted whitespace shows nothing.
        const brk = breakChange(words, s.after)
        if (brk) {
          marks.push(Decoration.widget({ widget: new Insertion(brk === 'split' ? '¶' : '⌒', s.id, `${by}${brk === 'split' ? 'a new paragraph here' : 'join these paragraphs'}`), side: 1 }).range(from))
          continue
        }
        if (to > from) marks.push(Decoration.mark({ class: 'cm-edit-del', attributes: { 'data-edit-id': s.id, title: `${by}${shown.in ? 'change' : 'delete'} this` } }).range(from, to))
        if (shown.in) marks.push(Decoration.widget({ widget: new Insertion(showBreaks(shown.in), s.id), side: 1 }).range(to))
      }
    })
    return Decoration.set(marks, true)
  }
  return [
    ViewPlugin.fromClass(class {
      decorations: DecorationSet
      constructor(view: EditorView) { this.decorations = build(view) }
      update(u: ViewUpdate) {
        const redraw = u.transactions.some((tr) => tr.effects.some((e) => e.is(redrawEdits)))
        if (u.docChanged || u.viewportChanged || redraw) this.decorations = build(u.view)
      }
    }, { decorations: (v) => v.decorations }),
    EditorView.domEventHandlers({
      click: (e) => {
        const el = (e.target as HTMLElement | null)?.closest?.('[data-edit-id]')
        const id = el?.getAttribute('data-edit-id')
        if (id) info.current.open(id)
        return false
      },
    }),
  ]
}

export const EDIT_THEME = {
  '.cm-edit-del': { textDecoration: 'line-through', textDecorationColor: 'rgb(239 68 68 / 0.8)', backgroundColor: 'rgb(239 68 68 / 0.12)', cursor: 'pointer' },
  '.cm-edit-ins': { color: 'rgb(16 185 129)', backgroundColor: 'rgb(16 185 129 / 0.12)', borderRadius: '2px', padding: '0 2px', marginLeft: '2px', cursor: 'pointer' },
}
