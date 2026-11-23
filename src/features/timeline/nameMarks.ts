import { EditorView, Decoration, ViewPlugin, showTooltip, keymap, type DecorationSet, type ViewUpdate, type Tooltip } from '@codemirror/view'
import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { headingsField, regionOf } from '@/lib/draftEditor'
import { bare, corrected, nearMissName, nearMisses } from '@/lib/nameSpelling'

/*
  A misspelt name on the Page (issue #705, D-2, D-4): a word one or two
  letters from a name the world has, marked as it is typed; with the caret in
  it, *Did you mean Teodora?* offers the name, or to keep the word, and
  Ctrl+. (⌘. on a Mac) takes the name. The browser's own underline is a
  different thing, and stays: a page cannot teach a browser the world's names.
*/

/** What the marks are drawn from: read when the page redraws them, so it can change after the page is made. */
export interface NameInfo {
  check: readonly string[]
  /** Every name word, lower case. */
  known: ReadonlySet<string>
  /** An ordinary word, or one the writer said is not a misspelt name. */
  isCommon: (lower: string) => boolean
  /** How often the book uses a word, lower case. */
  used: (lower: string) => number
  /** The writer says a word is not a misspelt name (D-4). */
  keep: (word: string) => void
}

/** Draw the marks again: the names, the book's words or the kept words have changed. */
export const redrawNames = StateEffect.define<null>()

/** The scene heading `pos` is under, or -1. */
function sceneAt(state: EditorState, pos: number): number {
  const headings = state.field(headingsField)
  let at = -1
  for (let i = 0; i < headings.length && headings[i].pos <= pos; i++) at = i
  return at >= 0 && headings[at].kind === 'scene' ? at : -1
}

/** The near miss the caret is in, in a scene's prose: its word's stretch and the name. */
export function nearMissAt(state: EditorState, info: NameInfo): { from: number; to: number; word: string; name: string } | null {
  const sel = state.selection.main
  if (!sel.empty) return null
  const range = state.wordAt(sel.head)
  if (!range) return null
  const i = sceneAt(state, range.from)
  if (i < 0 || range.from < regionOf(state, i).bodyFrom) return null
  const word = bare(state.sliceDoc(range.from, range.to))
  const name = nearMissName(word, info.check, info.known, info.isCommon, info.used)
  return name ? { from: range.from, to: range.from + word.length, word, name } : null
}

/** Put the name in the word's place. */
function takeName(view: EditorView, info: NameInfo): boolean {
  const hit = nearMissAt(view.state, info)
  if (!hit) return false
  const insert = corrected(hit.word, hit.name)
  view.dispatch({ changes: { from: hit.from, to: hit.to, insert }, selection: { anchor: hit.from + insert.length }, userEvent: 'input.spelling' })
  return true
}

export function nameMarks(info: { current: NameInfo }): Extension {
  const build = (view: EditorView) => {
    const b = new RangeSetBuilder<Decoration>()
    const { check, known, isCommon, used } = info.current
    if (check.length === 0) return b.finish()
    const headings = view.state.field(headingsField)
    headings.forEach((h, i) => {
      if (h.kind !== 'scene') return
      const end = headings[i + 1]?.pos ?? view.state.doc.length
      if (!view.visibleRanges.some(({ from, to }) => end >= from && h.pos <= to)) return
      const region = regionOf(view.state, i)
      for (const m of nearMisses(region.text, check, known, isCommon, used)) {
        b.add(region.bodyFrom + m.start, region.bodyFrom + m.end, Decoration.mark({
          class: 'cm-name-near',
          attributes: { title: `Did you mean ${m.name}?`, 'data-near-name': m.name },
        }))
      }
    })
    return b.finish()
  }
  const marks = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) {
      const redraw = u.transactions.some((tr) => tr.effects.some((e) => e.is(redrawNames)))
      if (u.docChanged || u.viewportChanged || redraw) this.decorations = build(u.view)
    }
  }, { decorations: (v) => v.decorations })

  // The offer, while the caret is in a near miss.
  const offer = StateField.define<Tooltip | null>({
    create: (state) => tooltipFor(state),
    update: (tip, tr) => (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(redrawNames)) ? tooltipFor(tr.state) : tip),
    provide: (f) => showTooltip.from(f),
  })
  function tooltipFor(state: EditorState): Tooltip | null {
    const hit = nearMissAt(state, info.current)
    if (!hit) return null
    return {
      pos: hit.from,
      above: true,
      create: (view) => {
        const dom = document.createElement('div')
        dom.className = 'cm-name-offer'
        dom.setAttribute('role', 'group')
        dom.setAttribute('aria-label', `Did you mean ${hit.name}?`)
        const ask = document.createElement('span')
        ask.textContent = `Did you mean ${hit.name}?`
        const use = document.createElement('button')
        use.type = 'button'
        use.textContent = `Use ${hit.name}`
        use.title = 'Ctrl+. (⌘. on a Mac)'
        const keep = document.createElement('button')
        keep.type = 'button'
        keep.textContent = 'Not a typo'
        // The editor keeps the caret: a press on the offer is not a click away from the prose.
        for (const b of [use, keep]) b.addEventListener('mousedown', (e) => e.preventDefault())
        use.addEventListener('click', () => { takeName(view, info.current); view.focus() })
        keep.addEventListener('click', () => { info.current.keep(hit.word); view.focus() })
        dom.append(ask, use, keep)
        return { dom }
      },
    }
  }

  return [
    marks,
    offer,
    keymap.of([{ key: 'Mod-.', run: (view) => takeName(view, info.current) }]),
  ]
}

export const NAME_THEME = {
  // Not the browser's red: a name the world has, nearly.
  '.cm-name-near': { textDecoration: 'underline wavy rgb(14 165 233)', textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
  '.cm-tooltip.cm-tooltip-above:has(.cm-name-offer)': { border: 'none', background: 'transparent' },
  '.cm-name-offer': {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '12px', borderRadius: '6px',
    background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', boxShadow: '0 2px 6px rgb(0 0 0 / 0.2)',
  },
  '.cm-name-offer button': { padding: '1px 6px', borderRadius: '4px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))', cursor: 'pointer' },
}
