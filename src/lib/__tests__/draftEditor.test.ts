import { describe, it, expect } from 'vitest'
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { history, undo, redo } from '@codemirror/commands'
import { draftState, draftSegments, enterOnHeading, headingsField, refused, type Refusal } from '@/lib/draftEditor'
import type { DraftChapter } from '@/lib/draftDocument'

const book: DraftChapter[] = [
  { id: 'c1', title: 'Arrival', scenes: [
    { id: 's1', title: 'The quay', text: 'The ship came in.' },
    { id: 's2', title: 'The letter', text: 'Wait and hope.' },
  ] },
  { id: 'c2', title: 'Return', scenes: [
    { id: 's3', title: 'Last', text: 'The end.' },
  ] },
]

const fresh = () => draftState(book, [history()])
const at = (state: EditorState, s: string) => {
  const i = state.doc.toString().indexOf(s)
  if (i < 0) throw new Error(`"${s}" is not in the document`)
  return i
}
/** Apply one edit as the writer would; say whether it was refused, and why. */
function edit(state: EditorState, spec: TransactionSpec): { state: EditorState; why: Refusal | null } {
  const tr = state.update({ userEvent: 'input', ...spec })
  const why = tr.effects.find((e) => e.is(refused))?.value ?? null
  return { state: tr.state, why }
}
const texts = (state: EditorState) => Object.fromEntries(draftSegments(state).map((s) => [s.id, s.kind === 'scene' ? s.text : null]))
const titles = (state: EditorState) => Object.fromEntries(draftSegments(state).map((s) => [s.id, s.title]))
const run = (state: EditorState, command: typeof undo) => {
  let next = state
  command({ state, dispatch: (tr) => { next = tr.state } })
  return next
}

describe('writing in the Page view', () => {
  it('typing in a scene’s prose changes that scene and no other', () => {
    const s0 = fresh()
    const { state, why } = edit(s0, { changes: { from: at(s0, 'Wait') + 4, insert: ' a while' } })
    expect(why).toBeNull()
    expect(texts(state)).toEqual({ c1: null, s1: 'The ship came in.', s2: 'Wait a while and hope.', c2: null, s3: 'The end.' })
  })

  it('retyping a title renames that heading and keeps its record', () => {
    const s0 = fresh()
    const from = at(s0, 'The letter')
    const { state, why } = edit(s0, { changes: { from, to: from + 'The letter'.length, insert: 'A letter from Edmond' } })
    expect(why).toBeNull()
    expect(titles(state).s2).toBe('A letter from Edmond')
    expect(texts(state).s2).toBe('Wait and hope.')
  })

  it('a line break typed after a scene title starts its prose', () => {
    const s0 = fresh()
    const end = at(s0, 'The letter') + 'The letter'.length
    const { state, why } = edit(s0, { changes: { from: end, insert: '\nDear M.,' } })
    expect(why).toBeNull()
    expect(texts(state).s2).toBe('Dear M.,\n\nWait and hope.')
  })

  it('a line break at the very start of a scene heading pushes it down, with its record; undo puts it back', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    const { state, why } = edit(s0, { changes: { from: start, insert: '\n' } })
    expect(why).toBeNull()
    const letter = state.field(headingsField).find((h) => h.id === 's2')!
    expect(state.doc.sliceString(letter.pos, letter.pos + 13)).toBe('## The letter')
    // The line it made is the scene above's.
    expect(texts(state).s1).toBe('The ship came in.\n')
    const back = run(state, undo)
    expect(back.doc.toString()).toBe(s0.doc.toString())
    expect(back.field(headingsField)).toEqual(s0.field(headingsField))
    const again = run(back, redo)
    expect(again.field(headingsField)).toEqual(state.field(headingsField))
  })
})

describe('what the Page view refuses, whole', () => {
  // Each case is paired with its nearest allowed neighbour, so a refusal that
  // refused everything would fail the second half.
  it('Backspace at the start of a heading — it would join the scene to the one above', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    const r = edit(s0, { changes: { from: start - 1, to: start } })
    expect(r.why).toBe('heading')
    expect(r.state.doc.toString()).toBe(s0.doc.toString())
    // One line further up — the blank line above it — is the writer's to delete.
    expect(edit(s0, { changes: { from: start - 2, to: start - 1 } }).why).toBeNull()
  })

  it('a selection that spans a heading, deleted or typed over', () => {
    const s0 = fresh()
    const from = at(s0, 'came in')
    const to = at(s0, 'Wait')
    expect(edit(s0, { changes: { from, to } }).why).toBe('heading')
    expect(edit(s0, { changes: { from, to, insert: 'x' } }).why).toBe('heading')
    expect(edit(s0, { changes: { from, to: from + 4 } }).why).toBeNull()
  })

  it('the heading’s # marks', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    expect(edit(s0, { changes: { from: start + 1, insert: '#' } }).why).toBe('heading')
    expect(edit(s0, { changes: { from: start, to: start + 1 } }).why).toBe('heading')
    expect(edit(s0, { changes: { from: start + 3, insert: 'Re: ' } }).why).toBeNull()
  })

  it('a line break inside a title, typed or pasted', () => {
    const s0 = fresh()
    const mid = at(s0, 'The letter') + 3
    expect(edit(s0, { changes: { from: mid, insert: '\n' } }).why).toBe('title-break')
    expect(edit(s0, { changes: { from: mid, insert: 'a\nb' } }).why).toBe('title-break')
    expect(edit(s0, { changes: { from: mid, insert: 'a b' } }).why).toBeNull()
  })

  it('text under a chapter heading, where no scene could keep it', () => {
    const s0 = fresh()
    const end = at(s0, '# Return') + '# Return'.length
    expect(edit(s0, { changes: { from: end, insert: '\nPrologue' } }).why).toBe('chapter-text')
    expect(edit(s0, { changes: { from: end + 1, insert: 'x' } }).why).toBe('chapter-text')
    expect(edit(s0, { changes: { from: end, to: end + 1 } }).why).toBe('heading')
    expect(edit(s0, { changes: { from: end, insert: ' Home' } }).why).toBeNull()
  })

  it('anything above the first chapter, and a line break above a scene that follows its chapter', () => {
    const s0 = fresh()
    expect(edit(s0, { changes: { from: 0, insert: 'x' } }).why).toBe('before-first')
    expect(edit(s0, { changes: { from: 0, insert: '\n' } }).why).toBe('before-first')
    // "## The quay" follows "# Arrival": a line pushed above it would land under the chapter.
    expect(edit(s0, { changes: { from: at(s0, '## The quay'), insert: '\n' } }).why).toBe('heading')
    expect(edit(s0, { changes: { from: at(s0, '## The letter'), insert: '\n' } }).why).toBeNull()
  })

  it('does not get in the way of undo, which only steps back to a state the rules allowed', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    // An allowed edit, undone: the undo deletes the break before a heading,
    // which the writer could not do by hand.
    const pushed = edit(s0, { changes: { from: start, insert: '\n' } }).state
    expect(edit(pushed, { changes: { from: start, to: start + 1 } }).why).toBe('heading')
    expect(run(pushed, undo).doc.toString()).toBe(s0.doc.toString())
  })
})

describe('Enter on a heading', () => {
  const press = (state: EditorState, pos: number) => {
    let next: EditorState | null = null
    const handled = enterOnHeading({ state: state.update({ selection: EditorSelection.cursor(pos) }).state, dispatch: (tr) => { next = tr.state } })
    return { handled, state: next as EditorState | null }
  }

  it('on a scene title goes to its prose, and changes no text', () => {
    const s0 = fresh()
    const r = press(s0, at(s0, 'The letter') + 3)
    expect(r.handled).toBe(true)
    expect(r.state!.doc.toString()).toBe(s0.doc.toString())
    expect(r.state!.selection.main.head).toBe(at(s0, 'Wait and hope.'))
  })

  it('on a chapter title goes to the prose of its first scene', () => {
    const s0 = fresh()
    const r = press(s0, at(s0, 'Return'))
    expect(r.state!.selection.main.head).toBe(at(s0, 'The end.'))
  })

  it('makes the line to write on under a last scene with no prose', () => {
    const s0 = draftState([{ id: 'c', title: 'C', scenes: [{ id: 's', title: 'S', text: '' }] }], [history()])
    const r = press(s0, s0.doc.length)
    expect(r.state!.doc.toString()).toBe('# C\n\n## S\n\n')
    expect(r.state!.selection.main.head).toBe(r.state!.doc.length)
    expect(texts(r.state!).s).toBe('')
  })

  it('is left alone at the very start of a heading, and in prose', () => {
    const s0 = fresh()
    expect(press(s0, at(s0, '## The letter')).handled).toBe(false)
    expect(press(s0, at(s0, 'Wait')).handled).toBe(false)
  })
})
