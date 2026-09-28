import { describe, it, expect } from 'vitest'
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { history, undo, redo } from '@codemirror/commands'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse,
  type Refusal, type Join,
} from '@/lib/draftEditor'
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

  it('a selection that ends part-way into a heading, deleted or typed over', () => {
    const s0 = fresh()
    const from = at(s0, 'came in')
    const to = at(s0, 'letter')
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

/** Apply one edit; the join it makes, if any. */
function joinOf(state: EditorState, spec: TransactionSpec): { state: EditorState; why: Refusal | null; join: Join | null } {
  const tr = state.update({ userEvent: 'delete', ...spec })
  return {
    state: tr.state,
    why: tr.effects.find((e) => e.is(refused))?.value ?? null,
    join: (tr.effects.find((e) => e.is(joined))?.value as Join | undefined) ?? null,
  }
}
const ids = (state: EditorState) => state.field(headingsField).map((h) => h.id)

describe('joining a scene to the one before it, from the page', () => {
  it('deleting a scene heading’s whole line takes the heading out and joins it', () => {
    const s0 = fresh()
    const from = at(s0, '## The letter')
    const r = joinOf(s0, { changes: { from, to: from + '## The letter'.length } })
    expect(r.why).toBeNull()
    expect(r.join).toEqual({ id: 's2', into: 's1', at: from })
    expect(ids(r.state)).toEqual(['c1', 's1', 'c2', 's3'])
    // The seam of blank lines closes up to one paragraph break.
    expect(joinedProse(r.state, 's1', from)).toBe('The ship came in.\n\nWait and hope.')
    // Paired: one character less, and it is part of a heading, refused.
    expect(joinOf(s0, { changes: { from, to: from + '## The lette'.length } }).why).toBe('heading')
  })

  it('the line with its line break, as delete-line takes it', () => {
    const s0 = fresh()
    const from = at(s0, '## The letter')
    const r = joinOf(s0, { changes: { from, to: from + '## The letter'.length + 1 } })
    expect(r.join?.id).toBe('s2')
    expect(joinedProse(r.state, 's1', from)).toBe('The ship came in.\n\nWait and hope.')
  })

  it('a selection from one scene’s prose into the next’s: the words join where the writer joined them', () => {
    const s0 = fresh()
    const from = at(s0, 'came in')
    const to = at(s0, 'Wait')
    const r = joinOf(s0, { changes: { from, to } })
    expect(r.join).toEqual({ id: 's2', into: 's1', at: from })
    expect(joinedProse(r.state, 's1', from)).toBe('The ship Wait and hope.')
    // Typed over, the typing lands where the selection was.
    const typed = joinOf(s0, { changes: { from, to, insert: 'sailed. ' } })
    expect(typed.why).toBeNull()
    expect(joinedProse(typed.state, 's1', from + 'sailed. '.length)).toBe('The ship sailed. Wait and hope.')
  })

  it('refuses the first scene of a chapter, a chapter heading, and two headings at once', () => {
    const s0 = fresh()
    const quay = at(s0, '## The quay')
    expect(joinOf(s0, { changes: { from: quay, to: quay + '## The quay'.length } }).why).toBe('first-scene')
    const ch = at(s0, '# Return')
    expect(joinOf(s0, { changes: { from: ch, to: ch + '# Return'.length } }).why).toBe('chapter-heading')
    const twoBook: DraftChapter[] = [{ id: 'c1', title: 'A', scenes: [
      { id: 'a', title: 'One', text: 'x' }, { id: 'b', title: 'Two', text: 'y' }, { id: 'c', title: 'Three', text: 'z' },
    ] }]
    const t0 = draftState(twoBook)
    const from = at(t0, '## Two')
    const to = at(t0, '## Three') + '## Three'.length
    expect(joinOf(t0, { changes: { from, to } }).why).toBe('two-headings')
    // Paired: the same selection stopping before the third heading joins one.
    expect(joinOf(t0, { changes: { from, to: at(t0, 'y') } }).join?.id).toBe('b')
  })

})

/** Type `text` at `from` as the writer would, then put the caret at `caret`. */
function type(state: EditorState, from: number, text: string, caret = from + text.length): EditorState {
  return state.update({ changes: { from, insert: text }, selection: EditorSelection.cursor(caret), userEvent: 'input' }).state
}
const moveTo = (state: EditorState, pos: number) => state.update({ selection: EditorSelection.cursor(pos), userEvent: 'select' }).state

describe('a scene heading typed into a scene', () => {
  it('is noticed once the caret leaves its line, not while it is being typed', () => {
    const s0 = fresh()
    const end = at(s0, 'came in.') + 'came in.'.length
    // A new line, and the heading typed on it.
    const typed = type(s0, end, '\n## The harbour')
    const line = typed.doc.lineAt(typed.selection.main.head).from
    expect(typed.field(lineTyped)).toEqual({ line, left: null })
    // Still on it: nothing to act on yet.
    expect(typed.field(lineTyped).left).toBeNull()
    // Enter: the caret is on a new line, and the heading's line is the one left.
    const entered = type(typed, typed.selection.main.head, '\n')
    expect(entered.field(lineTyped).left).toBe(line)
    expect(typedHeading(entered, line)).toEqual({
      sceneId: 's1', title: 'The harbour', prose: 'The ship came in.', at: 'The ship came in.'.length,
    })
    // And once looked at, it is settled.
    expect(entered.update({ effects: settled.of(null) }).state.field(lineTyped).left).toBeNull()
  })

  it('cuts the scene where the line is, and the line is not prose', () => {
    const book2: DraftChapter[] = [{ id: 'c1', title: 'A', scenes: [{ id: 's', title: 'Night', text: 'First.\n\nSecond.' }] }]
    const s0 = draftState(book2)
    const pos = at(s0, 'Second.')
    const typed = type(s0, pos, '## Morning\n\n', pos)
    expect(typedHeading(typed, pos)).toEqual({ sceneId: 's', title: 'Morning', prose: 'First.\n\nSecond.', at: 'First.'.length })
  })

  it('is only a heading with two marks, a space and a title', () => {
    const s0 = fresh()
    const end = at(s0, 'came in.') + 'came in.'.length
    for (const [line, isHeading] of [['## Dawn', true], ['##Dawn', false], ['### Dawn', false], ['## ', false], ['# Dawn', false]] as const) {
      const typed = type(s0, end, '\n' + line)
      const pos = typed.doc.lineAt(typed.selection.main.head).from
      expect(typedHeading(typed, pos) !== null, line).toBe(isHeading)
    }
  })

  it('under a scene heading, not in its title and not where no scene is', () => {
    const s0 = fresh()
    // A title that reads like one is still a title.
    const title = at(s0, '## The letter')
    expect(typedHeading(s0, title)).toBeNull()
    // Prose of a scene: yes.
    const end = at(s0, 'Wait and hope.') + 'Wait and hope.'.length
    const typed = type(s0, end, '\n## Evening')
    expect(typedHeading(typed, typed.doc.lineAt(typed.selection.main.head).from)?.sceneId).toBe('s2')
  })

  it('a line of prose that already read `## ` is prose until the writer types on it', () => {
    const imported: DraftChapter[] = [{ id: 'c1', title: 'A', scenes: [{ id: 's', title: 'Night', text: 'First.\n\n## Not a heading\n\nSecond.' }] }]
    const s0 = draftState(imported)
    // Walking the caret through it types nothing, so leaves nothing to act on.
    const passed = moveTo(moveTo(s0, at(s0, '## Not')), at(s0, 'Second.'))
    expect(passed.field(lineTyped)).toEqual({ line: null, left: null })
    // Paired: typing on it makes it the writer's line.
    const typedOn = type(s0, at(s0, 'heading'), 'real ')
    const edited = moveTo(typedOn, at(typedOn, 'Second.'))
    expect(edited.field(lineTyped).left).toBe(at(s0, '## Not'))
  })
})
