import { compose, sceneBodies } from './compose.js'

/** The baseline: the whole book in the kind of box the app drafts in today. No ids — a textarea cannot carry them. */
export function create(root, book) {
  const ta = document.createElement('textarea')
  ta.value = compose(book)
  root.append(ta)
  const heads = () => [...ta.value.matchAll(/^(#{1,2}) (.*)$/gm)]
  const place = (from, to = from) => { ta.focus(); ta.setSelectionRange(from, to); ta.blur(); ta.focus() }
  return {
    ids: false,
    headings: () => heads().map((m) => ({ level: m[1].length, title: m[2], id: null })),
    sceneTexts: () => sceneBodies(ta.value),
    proseCaret(fraction) {
      const v = ta.value
      let at = v.indexOf('\n\n', Math.floor(v.length * fraction))
      while (v[at - 1] === '\n' || /^#/.test(v.slice(v.lastIndexOf('\n', at - 1) + 1, at))) at = v.indexOf('\n\n', at + 2)
      place(at)
    },
    headingCaret(i, where) {
      const m = heads()[i]
      const prefix = m[1].length + 1
      place(where === 'lineStart' ? m.index : where === 'end' ? m.index + m[0].length : m.index + prefix)
    },
    select(kind, i) {
      const m = heads()[i]
      if (kind === 'title') place(m.index + m[1].length + 1, m.index + m[0].length)
      else if (kind === 'line') place(m.index, m.index + m[0].length)
    },
    caretVisible: () => null,
    scroller: () => ta,
  }
}
