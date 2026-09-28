import { EditorState, StateField, StateEffect, RangeSetBuilder } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, keymap } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, invertedEffects } from '@codemirror/commands'
import { compose, sceneBodies, HEADING } from './compose.js'

/*
  CodeMirror 6. The text is the document, `# ` and `## ` included, so the ids
  cannot live in it: they live beside it, in a field of { pos, id } markers, one
  at the start of each heading line. The rules the markers follow are the point
  of the spike, so they are written out here and checked by `measure.mjs`:

  - A line break typed at the start of a heading line pushes the heading down,
    and its id goes with it.
  - Anything else typed there leaves the id where it is, at the start of its
    line — so selecting the whole line and retyping it keeps the id.
  - If the heading's line is merged into a line above that has text on it, the
    id is dropped: that is a join.
  - If the whole line and its break are deleted, the id is dropped.
  - Undo puts a dropped id back (`invertedEffects`), redo drops it again.

  Whether a line is still a heading is not decided here. A marker on a line that
  has stopped being a heading is kept, so that finishing an edit — clearing a
  title and typing a new one — lands back on the same id. Deciding what a line
  that is no longer a heading means is step 5's, on leaving the line.
*/

/**
 * Where the start of a heading line goes through `changes`: after a line break
 * inserted exactly there, since that pushes the heading down; otherwise it
 * stays before anything inserted there.
 */
function mapLineStart(changes, pos) {
  let pushed = null
  changes.iterChanges((fromA, toA, _fromB, toB, inserted) => {
    if (fromA === pos && toA === pos && inserted.length > 0
      && inserted.sliceString(inserted.length - 1) === '\n') pushed = toB
  })
  return pushed ?? changes.mapPos(pos, -1)
}

/*
  The same rule maps a restore that is waiting in the history. When two edits
  are grouped into one undo step, CodeMirror maps the later edit's effects back
  through the earlier edit's inverse; with a plain mapPos, Backspace-Backspace
  (blank line, then the join) restored the id onto the blank line.
*/
const restoreIds = StateEffect.define({
  map: (marks, changes) => marks.map((m) => ({ pos: mapLineStart(changes, m.pos), id: m.id })),
})

const outcomes = new WeakMap()

/** The markers after `tr`, and the ones it dropped (at their old positions, for undo). */
function mapMarks(tr, marks) {
  let cached = outcomes.get(tr)
  if (cached) return cached
  const oldDoc = tr.startState.doc
  const newDoc = tr.newDoc
  const kept = []
  const dropped = []
  for (const mark of marks) {
    const line = oldDoc.lineAt(mark.pos)
    let whole = false
    tr.changes.iterChanges((fromA, toA) => { if (fromA <= mark.pos && toA > line.to) whole = true })
    const pos = mapLineStart(tr.changes, mark.pos)
    if (whole || newDoc.lineAt(pos).from !== pos) dropped.push(mark)
    else kept.push({ pos, id: mark.id })
  }
  cached = { kept, dropped }
  outcomes.set(tr, cached)
  return cached
}

function normalise(marks) {
  const sorted = [...marks].sort((a, b) => a.pos - b.pos)
  const out = []
  for (const m of sorted) {
    if (out.length && out[out.length - 1].pos === m.pos) {
      window.__collisions = (window.__collisions ?? 0) + 1
      continue
    }
    out.push(m)
  }
  return out
}

function headingIds(initial) {
  return StateField.define({
    create: () => initial,
    update(marks, tr) {
      if (tr.docChanged) marks = mapMarks(tr, marks).kept
      for (const e of tr.effects) if (e.is(restoreIds)) marks = normalise([...marks, ...e.value])
      return marks
    },
  })
}

/** Size the heading lines, for the visible part of the document only. */
const headingLines = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view) }
  update(u) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view) }
  build(view) {
    const b = new RangeSetBuilder()
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        const m = HEADING.exec(line.text)
        if (m) b.add(line.from, line.from, Decoration.line({ class: m[1] === '#' ? 'h1' : 'h2' }))
        pos = line.to + 1
      }
    }
    return b.finish()
  }
}, { decorations: (v) => v.decorations })

export function create(root, book) {
  const text = compose(book)
  // Markers for the composed book, in the order compose wrote the headings.
  const ids = book.chapters.flatMap((c) => [c.id, ...c.scenes.map((s) => s.id)])
  const initial = [...text.matchAll(/^#{1,2} .*$/gm)].map((m, i) => ({ pos: m.index, id: ids[i] }))
  const field = headingIds(initial)

  const view = new EditorView({
    parent: root,
    state: EditorState.create({
      doc: text,
      extensions: [
        field,
        invertedEffects.of((tr) => {
          if (!tr.docChanged) return []
          const { dropped } = mapMarks(tr, tr.startState.field(field))
          return dropped.length ? [restoreIds.of(dropped)] : []
        }),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true' }),
        headingLines,
      ],
    }),
  })

  const doc = () => view.state.doc
  const headingLinesList = () => {
    const out = []
    for (let n = 1; n <= doc().lines; n++) {
      const line = doc().line(n)
      if (line.text.startsWith('#') && HEADING.test(line.text)) out.push(line)
    }
    return out
  }
  const place = (anchor, head = anchor) => {
    view.dispatch({ selection: { anchor, head }, scrollIntoView: true })
    view.focus()
  }

  return {
    ids: true,
    headings() {
      const at = new Map(view.state.field(field).map((m) => [m.pos, m.id]))
      return headingLinesList().map((line) => {
        const m = HEADING.exec(line.text)
        return { level: m[1].length, title: m[2], id: at.get(line.from) ?? null }
      })
    },
    /** Markers sitting on a line that is not (or no longer) a heading. */
    dormant() {
      return view.state.field(field).filter((m) => !HEADING.test(doc().lineAt(m.pos).text)).map((m) => m.id)
    },
    sceneTexts: () => sceneBodies(doc().toString()),
    proseCaret(fraction) {
      let line = doc().lineAt(Math.floor(doc().length * fraction))
      while (!line.text || line.text.startsWith('#')) line = doc().line(line.number + 1)
      place(line.to)
    },
    headingCaret(i, where) {
      const line = headingLinesList()[i]
      const prefix = HEADING.exec(line.text)[1].length + 1
      place(where === 'lineStart' ? line.from : where === 'end' ? line.to : line.from + prefix)
    },
    select(kind, i) {
      const line = headingLinesList()[i]
      const prefix = HEADING.exec(line.text)[1].length + 1
      if (kind === 'title') place(line.from + prefix, line.to)
      else if (kind === 'line') place(line.from, line.to)
      else if (kind === 'block') place(line.from, line.to + 1)
    },
    caretVisible() {
      const c = view.coordsAtPos(view.state.selection.main.head)
      const r = this.scroller().getBoundingClientRect()
      return !!c && c.top >= r.top && c.bottom <= r.bottom
    },
    scroller: () => view.scrollDOM,
  }
}
