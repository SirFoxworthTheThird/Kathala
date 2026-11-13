import { EditorView, Decoration, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type { EditorState, Range } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'
import { loneLineEnds } from '@/lib/manuscriptParagraphs'

/*
  A single Enter in prose, marked on the Page (round-trip-plan-3.md, T12.1,
  D-11). On the Page it starts a new line, and looks like a new paragraph;
  Read, every export and the Word file an editor gets run the line into the
  one before. A writer typed a scene of twelve paragraphs that way, and it went
  to Word as one. The mark is at the end of each such line, the place the
  lines will be joined.
*/

export const LONE_TITLE = 'One Enter: a new line here, joined to the line before in Read and every export. Press Enter twice for a new paragraph.'

class LineEnd extends WidgetType {
  eq() { return true }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-lone-break'
    span.textContent = '↵'
    span.title = LONE_TITLE
    span.setAttribute('aria-hidden', 'true')
    return span
  }
  ignoreEvent() { return false }
}

const mark = Decoration.widget({ widget: new LineEnd(), side: -1 })

/** Each single line end in a scene's prose, where the page has it: in the scenes `inView` says are shown. */
export function loneEndsIn(state: EditorState, inView: (from: number, to: number) => boolean = () => true): number[] {
  const out: number[] = []
  const headings = state.field(headingsField)
  headings.forEach((h, i) => {
    if (h.kind !== 'scene') return
    const end = headings[i + 1]?.pos ?? state.doc.length
    if (!inView(h.pos, end)) return
    const region = regionOf(state, i)
    for (const at of loneLineEnds(region.text)) out.push(region.bodyFrom + at)
  })
  return out
}

export function lineEndMarks() {
  const build = (view: EditorView): DecorationSet => {
    const inView = (from: number, to: number) => view.visibleRanges.some((r) => to >= r.from && from <= r.to)
    const marks: Range<Decoration>[] = loneEndsIn(view.state, inView).map((at) => mark.range(at))
    return Decoration.set(marks, true)
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
    }
  }, { decorations: (v) => v.decorations })
}

/**
 * Whether the writer's own input has just put words after a single Enter: the
 * line end before the caret's line is one the page marks. So it is said when
 * words follow it, not at the Enter, since a line end with nothing after it
 * yet is a paragraph's end; never in verse, whose lines are its own; and on a
 * paste of hard-wrapped lines as on typing.
 */
export function typedAfterOneEnter(u: ViewUpdate): boolean {
  if (!u.docChanged || !u.transactions.some((tr) => tr.isUserEvent('input'))) return false
  const line = u.state.doc.lineAt(u.state.selection.main.head)
  return loneEndsIn(u.state, (from, to) => line.from >= from && line.from <= to).includes(line.from - 1)
}

export const LONE_THEME = {
  '.cm-lone-break': { color: 'hsl(var(--muted-foreground))', opacity: '0.6', paddingLeft: '2px', userSelect: 'none', fontSize: '0.85em' },
}
