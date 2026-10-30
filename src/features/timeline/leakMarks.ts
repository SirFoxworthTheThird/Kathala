import { EditorView, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, StateEffect } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'
import { sceneLeaks, type SceneLeak } from '@/lib/proseContinuity'
import type { KnowledgeFact } from '@/types'

/*
  The early-reveal check, on the scene being written (next-plan.md, Part E1):
  a fact's spoiler words, typed before the scene where the reader is set to
  learn it, underlined as they are typed, saying where the reader learns it.
  The check is the continuity checker's own (`sceneLeaks`, `factMatches`), so
  the page and the checker cannot disagree about what gives a fact away.
*/

/** What the underlines are drawn from: read when the page redraws them, so it can change after the page is made. */
export interface LeakInfo {
  facts: readonly KnowledgeFact[]
  /** A scene's place in the whole book, every timeline: a reveal may be in another era's chapter (`positionLookup`). */
  order: (sceneId: string) => number
  /** What an underline says, for a leak in scene `sceneId`. */
  describe: (leak: SceneLeak, sceneId: string) => string
}

/** Draw the underlines again: the facts or the book's order have changed. */
export const redrawLeaks = StateEffect.define<null>()

export function leakMarks(info: { current: LeakInfo }) {
  const build = (view: EditorView) => {
    const b = new RangeSetBuilder<Decoration>()
    const { facts, order, describe } = info.current
    if (!facts.some((f) => f.readerLearnsAtEventId)) return b.finish()
    const headings = view.state.field(headingsField)
    // Each scene any of which is in view, once and in order: the marks go in in order.
    headings.forEach((h, i) => {
      if (h.kind !== 'scene') return
      const end = headings[i + 1]?.pos ?? view.state.doc.length
      if (!view.visibleRanges.some(({ from, to }) => end >= from && h.pos <= to)) return
      const region = regionOf(view.state, i)
      for (const leak of sceneLeaks(region.text, h.id, facts, order)) {
        b.add(region.bodyFrom + leak.from, region.bodyFrom + leak.to, Decoration.mark({
          class: 'cm-draft-leak',
          attributes: { title: describe(leak, h.id), 'data-leak': leak.fact.id },
        }))
      }
    })
    return b.finish()
  }
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) {
      const redraw = u.transactions.some((tr) => tr.effects.some((e) => e.is(redrawLeaks)))
      if (u.docChanged || u.viewportChanged || redraw) this.decorations = build(u.view)
    }
  }, { decorations: (v) => v.decorations })
}

export const LEAK_THEME = {
  // The checker's warning colour: the same finding, where it is written.
  '.cm-draft-leak': { textDecoration: 'underline wavy rgb(245 158 11)', textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
}
