import { describe, it, expect } from 'vitest'
import { EditorSelection, type EditorState, type StateCommand, type TransactionSpec } from '@codemirror/state'
import { history, undo, redo } from '@codemirror/commands'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse,
  lineToHeading, joinSpec, clearLine, stepScene, openSceneLine, abandonedLine, focusScene, openedLine, sceneBeside, mentionAt, placeInBook, headerSyncSpec, joinedHeaderSpec, headerScenes, proseStart as proseStartAt, type Refusal, type Join,
} from '@/lib/draftEditor'
import type { DraftChapter } from '@/lib/draftDocument'
import { splitProse } from '@/lib/sceneStructure'
import { proseStart } from '@/lib/draftDocument'

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

  it('typing into the heading’s # marks, and a chapter’s # taken away', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    expect(edit(s0, { changes: { from: start + 1, insert: '#' } }).why).toBe('heading')
    // Typed over: what is typed is not the marks, and not prose either.
    expect(edit(s0, { changes: { from: start, to: start + 2, insert: 'x' } }).why).toBe('heading')
    // A chapter's mark is part of its heading — see "taking a scene heading's ## away".
    const ch = at(s0, '# Return')
    expect(edit(s0, { changes: { from: ch, to: ch + 1 } }).why).toBe('heading')
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

  it('anything above the first chapter, and text above a heading that is not a line break', () => {
    const s0 = fresh()
    expect(edit(s0, { changes: { from: 0, insert: 'x' } }).why).toBe('before-first')
    expect(edit(s0, { changes: { from: 0, insert: '\n' } }).why).toBe('before-first')
    expect(edit(s0, { changes: { from: at(s0, '## The letter'), insert: 'x' } }).why).toBe('heading')
    expect(edit(s0, { changes: { from: at(s0, '## The letter'), insert: '\n' } }).why).toBeNull()
    // "## The quay" follows "# Arrival": the line pushed above it is a blank line under the chapter, which may be.
    expect(edit(s0, { changes: { from: at(s0, '## The quay'), insert: '\n' } }).why).toBeNull()
    expect(edit(s0, { changes: { from: at(s0, '## The quay'), insert: 'Once\n' } }).why).toBe('chapter-text')
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
    expect(r.join).toEqual({ id: 's2', kind: 'scene', into: 's1', at: from })
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
    expect(r.join).toEqual({ id: 's2', kind: 'scene', into: 's1', at: from })
    expect(joinedProse(r.state, 's1', from)).toBe('The ship Wait and hope.')
    // Typed over, the typing lands where the selection was.
    const typed = joinOf(s0, { changes: { from, to, insert: 'sailed. ' } })
    expect(typed.why).toBeNull()
    expect(joinedProse(typed.state, 's1', from + 'sailed. '.length)).toBe('The ship sailed. Wait and hope.')
  })

  it('refuses the first scene of a chapter, the first chapter, and two headings at once', () => {
    const s0 = fresh()
    const quay = at(s0, '## The quay')
    expect(joinOf(s0, { changes: { from: quay, to: quay + '## The quay'.length } }).why).toBe('first-scene')
    expect(joinOf(s0, { changes: { from: 0, to: '# Arrival'.length } }).why).toBe('first-chapter')
    // Paired: a later chapter heading, deleted whole, joins its chapter to the one before.
    const ch = at(s0, '# Return')
    expect(joinOf(s0, { changes: { from: ch, to: ch + '# Return'.length } }).join).toEqual({ id: 'c2', kind: 'chapter', into: 'c1', at: ch })
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

describe('taking a scene heading’s ## away', () => {
  it('Backspace at the start of its title joins it to the scene before, the title kept as a line', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    // The caret after the marks, Backspace takes the space: and with it, the whole of the marks.
    const r = joinOf(s0, { changes: { from: start + 2, to: start + 3 } })
    expect(r.why).toBeNull()
    expect(r.join).toEqual({ id: 's2', kind: 'scene', into: 's1', at: start, title: true })
    expect(ids(r.state)).toEqual(['c1', 's1', 'c2', 's3'])
    expect(r.state.doc.toString()).toContain('The ship came in.\n\nThe letter\n\nWait and hope.')
    expect(r.state.doc.toString()).not.toContain('#The letter')
    expect(r.state.selection.main.head).toBe(start)
    expect(joinedProse(r.state, 's1', start)).toBe('The ship came in.\n\nThe letter\n\nWait and hope.')
  })

  it('so does deleting the marks themselves, selected or one at a time', () => {
    const s0 = fresh()
    const start = at(s0, '## The letter')
    for (const [from, to] of [[start, start + 2], [start, start + 1], [start + 1, start + 3], [start, start + 3]]) {
      const r = joinOf(s0, { changes: { from, to } })
      expect(r.join?.id, `${from - start}–${to - start}`).toBe('s2')
      expect(r.state.doc.toString()).toContain('\n\nThe letter\n\n')
    }
  })

  it('refuses the first scene of a chapter, which has no scene before it', () => {
    const s0 = fresh()
    const quay = at(s0, '## The quay')
    expect(joinOf(s0, { changes: { from: quay + 2, to: quay + 3 } }).why).toBe('first-scene')
    // Paired: the chapter's second scene is joined.
    const letter = at(s0, '## The letter')
    expect(joinOf(s0, { changes: { from: letter + 2, to: letter + 3 } }).join?.id).toBe('s2')
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
      kind: 'split', title: 'The harbour',
      cut: { sceneId: 's1', sceneTitle: 'The quay', prose: 'The ship came in.', at: 'The ship came in.'.length, tail: false },
    })
    // And once looked at, it is settled.
    expect(entered.update({ effects: settled.of(null) }).state.field(lineTyped).left).toBeNull()
  })

  it('cuts the scene where the line is, and the line is not prose', () => {
    const book2: DraftChapter[] = [{ id: 'c1', title: 'A', scenes: [{ id: 's', title: 'Night', text: 'First.\n\nSecond.' }] }]
    const s0 = draftState(book2)
    const pos = at(s0, 'Second.')
    const typed = type(s0, pos, '## Morning\n\n', pos)
    expect(typedHeading(typed, pos)).toEqual({
      kind: 'split', title: 'Morning',
      cut: { sceneId: 's', sceneTitle: 'Night', prose: 'First.\n\nSecond.', at: 'First.'.length, tail: true },
    })
  })

  it('in a scene’s prose, is a scene with two marks, a chapter with one — each with a space and a title — and otherwise prose', () => {
    const s0 = fresh()
    const end = at(s0, 'came in.') + 'came in.'.length
    for (const [line, kind] of [
      ['## Dawn', 'split'], ['# Dawn', 'chapter'],
      ['##Dawn', null], ['### Dawn', null], ['## ', null], ['#Dawn', null], ['# ', null], ['Dawn', null],
    ] as const) {
      const typed = type(s0, end, '\n' + line)
      const pos = typed.doc.lineAt(typed.selection.main.head).from
      expect(typedHeading(typed, pos)?.kind ?? null, line).toBe(kind)
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
    const made = typedHeading(typed, typed.doc.lineAt(typed.selection.main.head).from)
    expect(made?.kind === 'split' && made.cut.sceneId).toBe('s2')
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

describe('the page after a split or join shows what the records will hold', () => {
  /** Type a heading line into `text` of a one-scene book at `where`, leave it, and split. */
  function splitAt(text: string, where: string, line: string) {
    const s0 = draftState([{ id: 'c', title: 'A', scenes: [{ id: 's', title: 'Night', text }, { id: 't', title: 'Next', text: 'Later.' }] }])
    const pos = at(s0, where)
    const typed = type(s0, pos, line)
    const linePos = typed.doc.lineAt(pos).from
    const made = typedHeading(typed, linePos)
    if (made?.kind !== 'split') throw new Error('not a split')
    const done = typed.update(lineToHeading(typed, linePos, { id: 'n', kind: 'scene' })).state
    return { cut: made.cut, done }
  }

  it('the typed line is the new scene’s heading, and the two scenes read as the split writes them', () => {
    for (const [text, where, line] of [
      ['First.\n\nSecond.', 'Second.', '## Morning\n\n'],
      ['First.\n\nSecond.', 'Second.', '## Morning\n\n\n'],
      ['First.\nSecond.', 'Second.', '## Morning\n'],
      ['First.\n\nSecond.', 'First.', '## Morning\n\n'],
      ['First.', 'First.', '## Morning\n'],
    ] as const) {
      const { cut, done } = splitAt(text, where, line)
      const { head, tail } = splitProse(cut.prose, cut.at)
      expect(ids(done), `${text} / ${line}`).toEqual(['c', 's', 'n', 't'])
      expect(texts(done), `${text} / ${line}`).toMatchObject({ s: head, n: tail, t: 'Later.' })
      expect(titles(done).n).toBe('Morning')
    }
  })

  it('at the end of a scene with nothing after, the new scene is empty and the next heading keeps its place', () => {
    const s0 = draftState([{ id: 'c', title: 'A', scenes: [{ id: 's', title: 'Night', text: 'First.' }, { id: 't', title: 'Next', text: 'Later.' }] }])
    const end = at(s0, 'First.') + 'First.'.length
    const typed = type(s0, end, '\n## Dawn\n')
    const linePos = typed.doc.lineAt(end + 1).from
    const after = typed.update(lineToHeading(typed, linePos, { id: 'n', kind: 'scene' })).state
    expect(texts(after)).toMatchObject({ s: 'First.', n: '', t: 'Later.' })
    expect(after.doc.toString()).toBe('# A\n\n## Night\n\nFirst.\n\n## Dawn\n\n## Next\n\nLater.')
  })

  it('a join closes up the blank lines at its seam, and the page reads as the join writes it', () => {
    const s0 = fresh()
    const from = at(s0, '## The letter')
    for (const to of [from + '## The letter'.length, from + '## The letter'.length + 1]) {
      const r = joinOf(s0, { changes: { from, to } })
      const spec = joinSpec(r.state, from)
      const closed = spec ? r.state.update(spec).state : r.state
      expect(closed.doc.toString()).toContain('The ship came in.\n\nWait and hope.')
      expect(texts(closed).s1).toBe(joinedProse(r.state, 's1', from))
    }
    // Paired: a seam mid-line is left alone.
    const mid = joinOf(s0, { changes: { from: at(s0, 'came in'), to: at(s0, 'Wait') } })
    expect(joinSpec(mid.state, at(s0, 'came in'))).toBeNull()
  })

  it('joining onto a scene with no prose leaves one blank line under its heading', () => {
    const s0 = draftState([{ id: 'c', title: 'A', scenes: [{ id: 'a', title: 'One', text: '' }, { id: 'b', title: 'Two', text: 'Words.' }] }])
    const from = at(s0, '## Two')
    const r = joinOf(s0, { changes: { from, to: from + '## Two'.length } })
    const closed = r.state.update(joinSpec(r.state, from)!).state
    expect(closed.doc.toString()).toBe('# A\n\n## One\n\nWords.')
    expect(joinedProse(r.state, 'a', from)).toBe('Words.')
  })
})

it('a split at the very end of the book leaves a line to write the new scene on', () => {
  const s0 = draftState([{ id: 'c', title: 'A', scenes: [{ id: 's', title: 'Night', text: 'First.' }] }])
  const end = s0.doc.length
  const typed = type(s0, end, '\n## Dawn')
  const linePos = typed.doc.lineAt(end + 1).from
  const after = typed.update(lineToHeading(typed, linePos, { id: 'n', kind: 'scene' })).state
  expect(after.doc.toString()).toBe('# A\n\n## Night\n\nFirst.\n\n## Dawn\n\n')
  expect(texts(after)).toMatchObject({ s: 'First.', n: '' })
  expect(proseStart(after.doc, after.field(headingsField), 2)).toBe(after.doc.length)
})

describe('chapters on the page', () => {
  const twoChapters = (): EditorState => draftState([
    { id: 'c1', title: 'Arrival', scenes: [{ id: 's1', title: 'Night', text: 'First.\n\nSecond.' }, { id: 's2', title: 'Day', text: 'Later.' }] },
    { id: 'c2', title: 'Return', scenes: [{ id: 's3', title: 'Last', text: 'The end.' }] },
  ])
  const emptyChapter = (): EditorState => draftState([
    { id: 'c1', title: 'Arrival', scenes: [{ id: 's1', title: 'Night', text: 'First.' }] },
    { id: 'c2', title: 'Blank', scenes: [] },
  ])

  it('under a chapter heading, only headings and blank lines may be typed', () => {
    const s0 = emptyChapter()
    const end = s0.doc.length
    expect(edit(s0, { changes: { from: end, insert: '\n\n## Dawn' } }).why).toBeNull()
    expect(edit(s0, { changes: { from: end, insert: '\n\n# Part two' } }).why).toBeNull()
    expect(edit(s0, { changes: { from: end, insert: '\n\n#' } }).why).toBeNull()
    expect(edit(s0, { changes: { from: end, insert: '\n\n' } }).why).toBeNull()
    expect(edit(s0, { changes: { from: end, insert: '\n\nDawn' } }).why).toBe('chapter-text')
  })

  it('what a line left under a chapter heading makes', () => {
    const s0 = emptyChapter()
    const end = s0.doc.length
    const left = (line: string) => {
      const typed = type(s0, end, '\n\n' + line)
      return typedHeading(typed, typed.doc.lineAt(typed.doc.length).from)
    }
    expect(left('## Dawn')).toEqual({ kind: 'first-scene', chapterId: 'c2', title: 'Dawn' })
    expect(left('# Part two')).toEqual({ kind: 'chapter', chapterId: 'c2', cut: null, title: 'Part two' })
    expect(left('##')).toEqual({ kind: 'stray' })
    expect(left('')).toBeNull()
  })

  it('# and a title in a scene’s prose starts a chapter in that scene’s chapter, cutting the scene there', () => {
    const s0 = twoChapters()
    const pos = at(s0, 'Second.')
    const typed = type(s0, pos, '# Part two\n\n', pos)
    expect(typedHeading(typed, pos)).toEqual({
      kind: 'chapter', chapterId: 'c1', title: 'Part two',
      cut: { sceneId: 's1', sceneTitle: 'Night', prose: 'First.\n\nSecond.', at: 'First.'.length, tail: true },
    })
  })

  it('the new chapter’s heading, and the rest of the scene going on under its title, read as the records will', () => {
    const s0 = twoChapters()
    const pos = at(s0, 'Second.')
    const typed = type(s0, pos, '# Part two\n', pos)
    const after = typed.update(lineToHeading(typed, pos, { id: 'x', kind: 'chapter' }, { id: 'r', title: 'Night' })).state
    expect(ids(after)).toEqual(['c1', 's1', 'x', 'r', 's2', 'c2', 's3'])
    expect(titles(after)).toMatchObject({ x: 'Part two', r: 'Night' })
    expect(texts(after)).toMatchObject({ s1: 'First.', x: null, r: 'Second.', s2: 'Later.' })
    expect(after.doc.toString()).toContain('First.\n\n# Part two\n\n## Night\n\nSecond.\n\n## Day')
  })

  it('a line under a chapter that is not a heading is taken away, with its line break', () => {
    const s0 = emptyChapter()
    const typed = type(s0, s0.doc.length, '\n\n##')
    const line = typed.doc.lineAt(typed.doc.length).from
    const cleared = typed.update(clearLine(typed, line)).state
    expect(cleared.doc.toString()).toBe(s0.doc.toString() + '\n')
    expect(texts(cleared)).toEqual(texts(s0))
  })

  it('Enter on the title of a chapter with no scenes makes the line to type one on', () => {
    const s0 = emptyChapter()
    const end = s0.doc.length
    const moved = s0.update({ selection: EditorSelection.cursor(end) }).state
    const next = run(moved, enterOnHeading)
    expect(next.doc.toString()).toBe(s0.doc.toString() + '\n\n')
    expect(next.selection.main.head).toBe(next.doc.length)
  })

  it('deleting a chapter heading closes up the seam, and every scene keeps its prose', () => {
    const s0 = twoChapters()
    const from = at(s0, '# Return')
    const r = joinOf(s0, { changes: { from, to: from + '# Return'.length } })
    expect(ids(r.state)).toEqual(['c1', 's1', 's2', 's3'])
    const closed = r.state.update(joinSpec(r.state, from)!).state
    expect(closed.doc.toString()).toContain('Later.\n\n## Last')
    expect(texts(closed)).toMatchObject({ s1: 'First.\n\nSecond.', s2: 'Later.', s3: 'The end.' })
  })
})

describe('the scene keys on the page', () => {
  const caretAt = (state: EditorState, pos: number) => state.update({ selection: EditorSelection.cursor(pos) }).state
  const press = (state: EditorState, command: StateCommand) => {
    let next: EditorState | null = null
    const handled = command({ state, dispatch: (tr) => { next = tr.state } })
    return { handled, state: next ?? state }
  }

  it('Ctrl+Alt+↓ and ↑ go to the next and previous scene’s prose, across a chapter, and stop at the ends', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'Wait') + 2)
    const down = press(s0, stepScene('next'))
    expect(down.handled).toBe(true)
    expect(down.state.selection.main.head).toBe(at(s0, 'The end.'))
    expect(press(down.state, stepScene('next')).handled).toBe(false)
    const up = press(s0, stepScene('previous'))
    expect(up.state.selection.main.head).toBe(at(s0, 'The ship'))
    expect(press(up.state, stepScene('previous')).handled).toBe(false)
  })

  it('from a chapter heading, ↓ goes to its first scene', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'Return'))
    expect(press(s0, stepScene('next')).state.selection.main.head).toBe(at(s0, 'The end.'))
  })

  it('Ctrl+Enter opens a heading line after the scene, and the heading typed there is a new scene after it', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'ship'))
    const opened = press(s0, openSceneLine('new'))
    expect(opened.handled).toBe(true)
    const doc = opened.state.doc.toString()
    expect(doc).toContain('The ship came in.\n\n## \n\n## The letter')
    // The caret is after the marks, to type the title.
    expect(doc.slice(0, opened.state.selection.main.head)).toMatch(/The ship came in\.\n\n## $/)
    const typed = edit(opened.state, { changes: { from: opened.state.selection.main.head, insert: 'The customs house' } }).state
    const line = typed.doc.lineAt(typed.selection.main.head).from
    const made = typedHeading(typed, line)
    expect(made).toMatchObject({ kind: 'split', title: 'The customs house', cut: { sceneId: 's1', prose: 'The ship came in.', tail: false } })
  })

  it('in a chapter’s heading, Ctrl+Enter opens the line for its first scene', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'Return'))
    const opened = press(s0, openSceneLine('new'))
    const typed = edit(opened.state, { changes: { from: opened.state.selection.main.head, insert: 'Before' } }).state
    expect(typedHeading(typed, typed.doc.lineAt(typed.selection.main.head).from)).toEqual({ kind: 'first-scene', chapterId: 'c2', title: 'Before' })
  })

  it('Ctrl+Shift+Enter opens the line at the caret, and the prose after it goes with the new scene', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'and hope'))
    const opened = press(s0, openSceneLine('split'))
    expect(opened.handled).toBe(true)
    const typed = edit(opened.state, { changes: { from: opened.state.selection.main.head, insert: 'Hope' } }).state
    const made = typedHeading(typed, typed.doc.lineAt(typed.selection.main.head).from)
    expect(made).toMatchObject({ kind: 'split', title: 'Hope', cut: { sceneId: 's2', tail: true } })
    if (made?.kind !== 'split') throw new Error('not a split')
    expect(splitProse(made.cut.prose, made.cut.at)).toEqual({ head: 'Wait', tail: 'and hope.' })
  })

  it('Ctrl+Shift+Enter does nothing on a heading or under a chapter heading', () => {
    expect(press(caretAt(fresh(), at(fresh(), 'The letter') + 2), openSceneLine('split')).handled).toBe(false)
    expect(press(caretAt(fresh(), at(fresh(), 'Return')), openSceneLine('split')).handled).toBe(false)
  })

  it('a line a key opened and the writer left untitled goes, and the scene is as it was', () => {
    for (const kind of ['new', 'split'] as const) {
      const s0 = caretAt(fresh(), at(fresh(), 'and hope'))
      const opened = press(s0, openSceneLine(kind)).state
      const spec = abandonedLine(opened, opened.doc.lineAt(opened.selection.main.head).from)
      expect(spec, kind).not.toBeNull()
      const back = opened.update(spec!).state
      expect(back.doc.toString(), kind).toBe(s0.doc.toString())
    }
  })

  it('but a title typed on it, or a line the writer typed themselves, is not taken away', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'ship'))
    const opened = press(s0, openSceneLine('new')).state
    const typed = edit(opened, { changes: { from: opened.selection.main.head, insert: 'X' } }).state
    expect(abandonedLine(typed, typed.doc.lineAt(typed.selection.main.head).from)).toBeNull()
    // Typed by hand: `## ` with no title, never opened by a key.
    const end = at(s0, 'came in.') + 'came in.'.length
    const own = edit(s0, { changes: { from: end, insert: '\n\n## ' } }).state
    expect(abandonedLine(own, own.doc.lineAt(end + 2).from)).toBeNull()
  })

  it('nor is anything typed inside what the key put in', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'and hope'))
    const opened = press(s0, openSceneLine('split')).state
    const lineFrom = opened.doc.lineAt(opened.selection.main.head).from
    // On the blank line the split left under the heading line, still untitled above it.
    const below = opened.doc.lineAt(opened.selection.main.head).to + 1
    const typed = edit(opened, { changes: { from: below, insert: 'Later.' } }).state
    expect(typed.doc.lineAt(lineFrom).text).toBe('## ')
    expect(abandonedLine(typed, lineFrom)).toBeNull()
  })

  it('the line outlives the page settling the line the key left, and is forgotten once it is a heading', () => {
    const s0 = caretAt(fresh(), at(fresh(), 'ship'))
    const opened = press(s0, openSceneLine('new')).state
    const lineFrom = opened.doc.lineAt(opened.selection.main.head).from
    // The keystroke left the line the caret was on, and the page settles that one.
    const afterSettle = opened.update({ effects: settled.of(null) }).state
    expect(abandonedLine(afterSettle, lineFrom)).not.toBeNull()
    const typed = edit(afterSettle, { changes: { from: afterSettle.selection.main.head, insert: 'X' } }).state
    const made = typed.update(lineToHeading(typed, lineFrom, { id: 'n1', kind: 'scene' })).state
    expect(made.field(openedLine)).toBeNull()
  })

  it('Focus mode steps to the scene beside its own, across a chapter, and not past either end', () => {
    const s0 = fresh()
    expect(sceneBeside(s0, 's2', 'next')).toBe('s3')
    expect(sceneBeside(s0, 's2', 'previous')).toBe('s1')
    expect(sceneBeside(s0, 's3', 'next')).toBeNull()
    expect(sceneBeside(s0, 's1', 'previous')).toBeNull()
    expect(sceneBeside(s0, 'gone', 'next')).toBeNull()
  })

  it('Focus mode opens on the scene the caret is in, or from a chapter heading on its first scene', () => {
    const s0 = fresh()
    expect(focusScene(s0, at(s0, 'Wait'))).toBe('s2')
    expect(focusScene(s0, at(s0, 'The letter'))).toBe('s2')
    expect(focusScene(s0, at(s0, 'Return'))).toBe('s3')
    expect(focusScene(s0, 0)).toBe('s1')
  })

  it('and not from a chapter that has no scenes', () => {
    const bare = draftState([{ id: 'c1', title: 'Empty', scenes: [] }])
    expect(focusScene(bare, 0)).toBeNull()
  })
})

describe('"@" on the page', () => {
  const cast = [{ id: 'm', kind: 'character' as const, name: 'Mercédès' }]
  /** The book with `typed` put in at `where`, the caret after it. */
  const typing = (where: string, typed: string) => {
    const s0 = fresh()
    const pos = at(s0, where)
    return s0.update({ changes: { from: pos, insert: typed }, selection: EditorSelection.cursor(pos + typed.length) }).state
  }

  it('finds the name being typed in a scene’s prose, in the document, and the scene it is in', () => {
    const s = typing('and hope', 'to @@Mer')
    const m = mentionAt(s, cast)
    expect(m).toMatchObject({ query: 'Mer', intent: 'present', sceneId: 's2' })
    expect(s.doc.sliceString(m!.start, m!.end)).toBe('@@Mer')
  })

  it('but not on a heading’s line, nor with text selected', () => {
    expect(mentionAt(typing('letter', '@Mer'), cast)).toBeNull()
    const s = typing('and hope', '@Mer')
    expect(mentionAt(s, cast)).not.toBeNull()
    expect(mentionAt(s.update({ selection: EditorSelection.range(at(s, '@Mer'), at(s, '@Mer') + 4) }).state, cast)).toBeNull()
  })
})

describe('the header line on the page', () => {
  const headed: DraftChapter[] = [
    { id: 'c1', title: 'Arrival', scenes: [
      { id: 's1', title: 'The quay', text: 'The ship came in.', header: '[#The Quay @@Edmond]' },
      { id: 's2', title: 'The letter', text: 'Wait and hope.', header: '[@@Mercédès]' },
      { id: 's3', title: 'Bare', text: 'Nothing said.' },
    ] },
  ]
  const page = () => draftState(headed, [history()])
  const segs = (state: EditorState) => Object.fromEntries(draftSegments(state).filter((x) => x.kind === 'scene').map((x) => [x.id, [x.header, x.text]]))

  it('is shown under each title the records give one, and is never the prose', () => {
    const s0 = page()
    expect([...s0.field(headerScenes)]).toEqual(['s1', 's2'])
    expect(segs(s0)).toEqual({
      s1: ['[#The Quay @@Edmond]', 'The ship came in.'],
      s2: ['[@@Mercédès]', 'Wait and hope.'],
      s3: [null, 'Nothing said.'],
    })
  })

  it('stays the first line: a line typed above it is refused, a blank line is not, and typing in it is the writer’s', () => {
    const s0 = page()
    const top = at(s0, '[#The Quay')
    expect(edit(s0, { changes: { from: top, insert: 'A note\n' } }).why).toBe('above-header')
    expect(edit(s0, { changes: { from: top - 1, insert: 'x' } }).why).toBe('above-header')
    const pushed = edit(s0, { changes: { from: top, insert: '\n' } })
    expect(pushed.why).toBeNull()
    expect(segs(pushed.state).s1).toEqual(['[#The Quay @@Edmond]', 'The ship came in.'])
    const inIt = edit(s0, { changes: { from: at(s0, 'Edmond'), insert: 'Old ' } })
    expect(inIt.why).toBeNull()
    expect(segs(inIt.state).s1).toEqual(['[#The Quay @@Old Edmond]', 'The ship came in.'])
  })

  it('a header typed as a scene’s first line is read as one while it is typed, so it is not saved as prose', () => {
    const s0 = page()
    const first = at(s0, 'Nothing said.')
    const typed = s0.update({ changes: { from: first, insert: '[#The Quay]\n\n' }, selection: EditorSelection.cursor(first + 5), userEvent: 'input' }).state
    expect(segs(typed).s3).toEqual(['[#The Quay]', 'Nothing said.'])
  })

  it('the caret goes under it: to a scene’s prose, and Ctrl+Shift+Enter does not split inside it', () => {
    const s0 = page()
    expect(proseStartAt(s0, 1)).toBe(at(s0, 'The ship'))
    const split = (where: string) =>
      openSceneLine('split')({ state: s0.update({ selection: EditorSelection.cursor(at(s0, where)) }).state, dispatch: () => {} })
    expect(split('Edmond')).toBe(false)
    expect(split('came in')).toBe(true)
  })

  it('"@" in it names somebody present; in the prose it does not', () => {
    const s0 = page()
    const typing = (where: string, typed: string) => {
      const pos = at(s0, where)
      return s0.update({ changes: { from: pos, insert: typed }, selection: EditorSelection.cursor(pos + typed.length) }).state
    }
    const cast = [{ id: 'e', kind: 'character' as const, name: 'Edmond' }]
    expect(mentionAt(typing(']', ' @@Ed'), cast)?.inHeader).toBe(true)
    expect(mentionAt(typing('came in.', ' @Ed'), cast)?.inHeader).toBe(false)
  })

  it('a split in a scene with a header cuts its prose, not the line', () => {
    const s0 = page()
    const pos = at(s0, 'came in.')
    const typed = s0.update({ changes: { from: pos, insert: '\n## Customs\n' }, userEvent: 'input' }).state
    const made = typedHeading(typed, typed.doc.lineAt(pos + 1).from)
    expect(made).toMatchObject({ kind: 'split', title: 'Customs', cut: { sceneId: 's1', prose: 'The ship\n\ncame in.', tail: true } })
  })

  describe('kept in step with the records', () => {
    const rendered = (over: Record<string, string>) => new Map(Object.entries({ s1: '[#The Quay @@Edmond]', s2: '[@@Mercédès]', s3: '', ...over }))
    const synced = (state: EditorState, over: Record<string, string>, skip: string[] = []) => {
      const spec = headerSyncSpec(state, rendered(over), new Set(skip))
      return spec ? state.update(spec).state : state
    }

    it('nothing to do when the lines agree', () => {
      expect(headerSyncSpec(page(), rendered({}), new Set())).toBeNull()
    })

    it('a line rewritten, put in and taken out, the prose untouched each time', () => {
      const s = synced(page(), { s1: '[#The Yard @@Edmond]', s2: '', s3: '[@@Albert]' })
      expect(segs(s)).toEqual({
        s1: ['[#The Yard @@Edmond]', 'The ship came in.'],
        s2: [null, 'Wait and hope.'],
        s3: ['[@@Albert]', 'Nothing said.'],
      })
      expect(s.doc.toString()).toBe('# Arrival\n\n## The quay\n\n[#The Yard @@Edmond]\n\nThe ship came in.\n\n## The letter\n\nWait and hope.\n\n## Bare\n\n[@@Albert]\n\nNothing said.')
    })

    it('and on scenes with no prose, between two headings and at the end of the book', () => {
      const empty: DraftChapter[] = [{ id: 'c1', title: 'A', scenes: [{ id: 'x', title: 'X', text: '' }, { id: 'y', title: 'Y', text: '' }] }]
      const s0 = draftState(empty)
      const put = s0.update(headerSyncSpec(s0, new Map([['x', '[@@P]'], ['y', '[@@Q]']]), new Set())!).state
      expect(put.doc.toString()).toBe('# A\n\n## X\n\n[@@P]\n\n## Y\n\n[@@Q]')
      const back = put.update(headerSyncSpec(put, new Map([['x', ''], ['y', '']]), new Set())!).state
      expect(back.doc.toString()).toBe('# A\n\n## X\n\n## Y')
    })

    it('leaves alone a scene it is told to, and is not something undo takes back', () => {
      const s = synced(page(), { s1: '[#The Yard]' }, ['s1'])
      expect(segs(s).s1).toEqual(['[#The Quay @@Edmond]', 'The ship came in.'])
      const moved = synced(page(), { s1: '[#The Yard]' })
      expect(run(moved, undo).doc.toString()).toBe(moved.doc.toString())
    })

    it('the blank line a deleted header leaves is not prose', () => {
      const s0 = page()
      const line = s0.doc.lineAt(at(s0, '[#The Quay'))
      const emptied = s0.update({ changes: { from: line.from, to: line.to }, userEvent: 'delete' }).state
      expect(segs(emptied).s1).toEqual([null, 'The ship came in.'])
    })

    it('puts back a line the writer deleted, once they are off it', () => {
      const s0 = page()
      const line = s0.doc.lineAt(at(s0, '[#The Quay'))
      const gone = s0.update({ changes: { from: line.from, to: line.to + 2 }, userEvent: 'delete' }).state
      expect(segs(gone).s1).toEqual([null, 'The ship came in.'])
      expect(segs(synced(gone, {})).s1).toEqual(['[#The Quay @@Edmond]', 'The ship came in.'])
    })
  })

  it('a joined scene’s header line goes with its heading, and does not become prose', () => {
    const s0 = page()
    const h = at(s0, '## The letter')
    const tr = s0.update({ changes: { from: h - 1, to: s0.doc.lineAt(h).to }, userEvent: 'delete' })
    const spec = joinedHeaderSpec(s0, tr.changes, 's2')!
    const joined = tr.state.update(spec).state
    expect(joined.field(headerScenes).has('s2')).toBe(false)
    expect(draftSegments(joined).find((x) => x.id === 's1')!.text.replace(/\n+/g, ' ')).toBe('The ship came in. Wait and hope.')
  })
})

describe('where the caret is in the book', () => {
  it('names the chapter, and the scene when it is in one', () => {
    const s0 = fresh()
    expect(placeInBook(s0, at(s0, 'Wait'))).toEqual({ chapterId: 'c1', sceneId: 's2' })
    expect(placeInBook(s0, at(s0, 'The letter'))).toEqual({ chapterId: 'c1', sceneId: 's2' })
    expect(placeInBook(s0, at(s0, 'The end.'))).toEqual({ chapterId: 'c2', sceneId: 's3' })
    // On a chapter's own heading: that chapter, and no scene.
    expect(placeInBook(s0, at(s0, 'Return'))).toEqual({ chapterId: 'c2', sceneId: null })
  })
})
