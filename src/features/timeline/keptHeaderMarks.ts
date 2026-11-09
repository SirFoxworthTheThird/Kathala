import { EditorView, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { StateEffect, type Range } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'

/*
  A scene's header that was not applied, marked on the Page (round-trip-plan.md,
  T4): it names somebody or somewhere the world has not got, and waits as
  typed. It looked exactly like an applied one, and a writer run's pasted
  scenes sat with no cast and no place under headers that said otherwise; only
  the side panel told (writer run 2026-11-09, W-A).
*/

/** Draw the marks again: which scenes wait has changed. */
export const redrawKept = StateEffect.define<null>()

export const KEPT_TITLE = 'Not applied: it names something this world has not got. The note above the page offers to make it.'

export function keptHeaderMarks(info: { current: ReadonlySet<string> }) {
  const build = (view: EditorView): DecorationSet => {
    if (info.current.size === 0) return Decoration.none
    const marks: Range<Decoration>[] = []
    const headings = view.state.field(headingsField)
    headings.forEach((h, i) => {
      if (h.kind !== 'scene' || !info.current.has(h.id)) return
      const region = regionOf(view.state, i)
      if (region.headerFrom === null || region.headerTo === null || region.headerTo <= region.headerFrom) return
      marks.push(Decoration.mark({ class: 'cm-header-kept', attributes: { title: KEPT_TITLE } }).range(region.headerFrom, region.headerTo))
    })
    return Decoration.set(marks, true)
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) {
      if (u.docChanged || u.transactions.some((tr) => tr.effects.some((e) => e.is(redrawKept)))) this.decorations = build(u.view)
    }
  }, { decorations: (v) => v.decorations })
}

export const KEPT_THEME = {
  '.cm-header-kept': { textDecoration: 'underline wavy rgb(245 158 11 / 0.85)', textUnderlineOffset: '4px' },
}
