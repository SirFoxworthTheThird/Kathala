import { Schema } from 'prosemirror-model'
import { EditorState, Plugin, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { history, undo, redo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { baseKeymap } from 'prosemirror-commands'
import { inputRules, textblockTypeInputRule } from 'prosemirror-inputrules'

/*
  ProseMirror. A heading is a node and its id is an attribute of the node, so
  an edit inside the heading cannot lose it, and undo restores it with the
  node. The syntax is not text: `# ` or `## ` typed at the start of a
  paragraph turns it into a heading (an input rule) and disappears.

  Two things the model does not give for free, both handled below:
  - Splitting a heading in the middle copies its attributes to both halves.
    The plugin keeps the id on the half that sits where the heading was.
  - Stored prose is plain text. A paragraph is the text between blank lines,
    and a single line break inside one is a hard break, so the round trip is
    exact by construction — `measure.mjs` checks it.
*/

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }] },
    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      attrs: { level: { default: 2 }, id: { default: null } },
      // The id is deliberately not written to the DOM, so a copied heading
      // pastes as a new one rather than as a second holder of the same id.
      toDOM: (n) => [`h${n.attrs.level}`, 0],
      parseDOM: [{ tag: 'h1', attrs: { level: 1 } }, { tag: 'h2', attrs: { level: 2 } }],
    },
    text: { group: 'inline' },
    hard_break: { group: 'inline', inline: true, selectable: false, toDOM: () => ['br'], parseDOM: [{ tag: 'br' }] },
  },
})

function paragraph(text) {
  const content = []
  text.split('\n').forEach((line, i) => {
    if (i) content.push(schema.nodes.hard_break.create())
    if (line) content.push(schema.text(line))
  })
  return schema.nodes.paragraph.create(null, content)
}

function heading(level, id, title) {
  return schema.nodes.heading.create({ level, id }, title ? schema.text(title) : null)
}

function paragraphText(node) {
  let s = ''
  node.forEach((child) => { s += child.type === schema.nodes.hard_break ? '\n' : child.text })
  return s
}

const insertsHeading = (tr) => tr.steps.some((step) => {
  let hit = false
  step.slice?.content.descendants((n) => { if (n.type === schema.nodes.heading) hit = true; return !hit })
  return hit
})

/** After a transaction, no id is held by two headings: the one where the heading was keeps it. */
const uniqueIds = new Plugin({
  appendTransaction(trs, oldState, newState) {
    // Only a step that inserts a heading can make a second holder of an id —
    // typing into a paragraph never does, and should not pay for the scan.
    if (!trs.some(insertsHeading)) return null
    const seen = new Map()
    newState.doc.forEach((node, pos) => {
      const id = node.type === schema.nodes.heading && node.attrs.id
      if (!id) return
      if (!seen.has(id)) seen.set(id, [])
      seen.get(id).push(pos)
    })
    let tr = null
    for (const [id, positions] of seen) {
      if (positions.length < 2) continue
      let oldPos = null
      oldState.doc.forEach((node, pos) => { if (node.attrs?.id === id) oldPos = pos })
      let mapped = oldPos
      for (const t of trs) mapped = t.mapping.map(mapped, -1)
      const keep = positions.includes(mapped) ? mapped : positions[0]
      tr ??= newState.tr
      for (const pos of positions) {
        if (pos !== keep) tr.setNodeMarkup(pos, null, { ...newState.doc.nodeAt(pos).attrs, id: null })
      }
    }
    return tr
  },
})

export function create(root, book) {
  const blocks = []
  for (const ch of book.chapters) {
    blocks.push(heading(1, ch.id, ch.title))
    for (const sc of ch.scenes) {
      blocks.push(heading(2, sc.id, sc.title))
      if (sc.text) for (const p of sc.text.split('\n\n')) blocks.push(paragraph(p))
    }
  }
  const wrap = document.createElement('div')
  wrap.className = 'pm-wrap'
  root.append(wrap)

  const view = new EditorView(wrap, {
    state: EditorState.create({
      doc: schema.nodes.doc.create(null, blocks),
      plugins: [
        inputRules({ rules: [textblockTypeInputRule(/^(#{1,2})\s$/, schema.nodes.heading, (m) => ({ level: m[1].length }))] }),
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }),
        keymap(baseKeymap),
        uniqueIds,
      ],
    }),
    attributes: { spellcheck: 'true' },
  })

  const headingNodes = () => {
    const out = []
    view.state.doc.forEach((node, pos) => { if (node.type === schema.nodes.heading) out.push({ node, pos }) })
    return out
  }
  const place = (anchor, head = anchor) => {
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)).scrollIntoView())
    view.focus()
  }

  return {
    ids: true,
    headings: () => headingNodes().map(({ node }) => ({ level: node.attrs.level, title: node.textContent, id: node.attrs.id })),
    dormant: () => [],
    sceneTexts() {
      const out = []
      let current = null
      view.state.doc.forEach((node) => {
        if (node.type === schema.nodes.heading) {
          if (current) out.push(current.join('\n\n'))
          current = node.attrs.level === 2 ? [] : null
        } else if (current) current.push(paragraphText(node))
      })
      if (current) out.push(current.join('\n\n'))
      return out
    },
    proseCaret(fraction) {
      const target = Math.floor(view.state.doc.content.size * fraction)
      let found = null
      view.state.doc.forEach((node, pos) => {
        if (found === null && pos >= target && node.type === schema.nodes.paragraph && node.content.size) found = pos + node.nodeSize - 1
      })
      place(found)
    },
    headingCaret(i, where) {
      const { node, pos } = headingNodes()[i]
      place(where === 'end' ? pos + 1 + node.content.size : pos + 1)
    },
    select(kind, i) {
      const { node, pos } = headingNodes()[i]
      if (kind === 'title' || kind === 'line') place(pos + 1, pos + 1 + node.content.size)
      else if (kind === 'block') place(pos + 1, pos + node.nodeSize + 1)
    },
    caretVisible() {
      const c = view.coordsAtPos(view.state.selection.head)
      const r = this.scroller().getBoundingClientRect()
      return !!c && c.top >= r.top && c.bottom <= r.bottom
    },
    scroller: () => wrap,
  }
}
