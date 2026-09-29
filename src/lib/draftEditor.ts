import { EditorSelection, EditorState, StateEffect, StateField, Transaction, type ChangeDesc, type Extension, type TransactionSpec, type StateCommand } from '@codemirror/state'
import {
  composeDraft, readDraft, proseStart as proseStartIn, sceneRegion, sceneHeaderLine, lineEndAt, oneLine, HEADING_PREFIX,
  type DraftChapter, type DraftHeading, type DraftSegment, type HeadingKind, type SceneRegion,
} from '@/lib/draftDocument'
import { splitSceneHeader } from '@/lib/sceneHeader'
import { findMentionToken, type MentionCandidate, type MentionToken } from '@/lib/mentionPicker'

/*
  The Page view's editor state, without the view: which lines are headings,
  and which edits the text is allowed to make.

  A heading is a record — a chapter or a scene, with an id that snapshots,
  goals and History point at — so the document carries each heading's id and
  position beside the text, never in it.

  Structure is made by typing, and each change is one act on the records:

  - **A line typed as a heading** — `## Title` or `# Title` on a line of its
    own — becomes one once the caret leaves the line: not on every keystroke,
    or `## T` would make a scene called "T". `lineTyped` follows the line being
    typed on and `typedHeading` says what the line just left makes:
    - `## Title` in a scene's prose splits the scene there;
    - `# Title` anywhere starts a chapter there, taking the scenes after it;
    - `## Title` under a chapter heading is that chapter's new first scene.
    Only a line the writer typed on counts: a line of prose that already
    started with `#`, in a book imported that way, stays prose until it is
    edited. `lineToHeading` then makes the line a heading, under the id its
    record is about to be written with.
  - **Deleting a heading's whole line** joins it to what is before it: a scene
    to the scene before, a chapter to the chapter before. The heading goes from
    the document at once, with a `joined` effect naming both, and `joinSpec`
    closes up the seam.

  Either way the document already shows the book the records are about to
  hold, so the page writes them and carries on: nothing is rebuilt, and nothing
  typed meanwhile is lost. The blank lines around a heading are set to what the
  records will hold, so the page and the store agree to the character.

  Under a chapter heading, above its first scene, there is no scene to keep
  prose, so only headings and blank lines can be typed there. Everything else
  that would change the structure is refused whole, with a reason the page
  shows: part of a heading, the first chapter or the first scene of a chapter
  (nothing before either to join), two headings at once, and a line break in a
  title.

  Apart from those, the only thing that moves a heading is text typed before
  it, and one rule covers that: a heading's start maps *after* anything
  inserted exactly there — a line break typed at the start of a heading, which
  pushes it down and leaves the new line to what is above.
*/

export type Refusal = 'heading' | 'first-chapter' | 'first-scene' | 'two-headings' | 'title-break' | 'chapter-text' | 'before-first' | 'above-header'

/** Carried by the empty transaction that replaces a refused one. */
export const refused = StateEffect.define<Refusal>()

/**
 * A heading deleted whole: `id` is joined onto `into` — for a scene the scene
 * before it, for a chapter the chapter before it. `at` is where the deletion
 * started, in the document before it.
 */
export interface Join { id: string; kind: HeadingKind; into: string; at: number }
export const joined = StateEffect.define<Join>()

/** A heading the document gains. `pos` is in the document after the transaction. */
export const addHeading = StateEffect.define<DraftHeading>()

export const headingsField = StateField.define<DraftHeading[]>({
  create: () => [],
  update(headings, tr) {
    const added = tr.effects.filter((e) => e.is(addHeading)).map((e) => e.value as DraftHeading)
    if (!tr.docChanged && added.length === 0) return headings
    const gone = new Set(tr.effects.filter((e) => e.is(joined)).map((e) => (e.value as Join).id))
    const kept = headings.filter((h) => !gone.has(h.id)).map((h) => ({ ...h, pos: tr.changes.mapPos(h.pos, 1) }))
    return added.length === 0 ? kept : [...kept, ...added].sort((a, b) => a.pos - b.pos)
  },
})

/*
  ── The header line ────────────────────────────────────────────────────────

  A scene may show `[#Place @@Name]` as the first line under its title, drawn
  from its records and never part of its prose (`draftDocument`). Which scenes
  show one is carried here, beside the headings, rather than read off the text:
  a scene whose stored prose happens to begin with a bracketed line keeps it as
  prose. The page shows one where the records say something, and one the
  writer types as a scene's first line becomes one when they leave it.
*/
export const showHeader = StateEffect.define<string>()
export const hideHeader = StateEffect.define<string>()

export const headerScenes = StateField.define<ReadonlySet<string>>({
  create: () => new Set(),
  update(set, tr) {
    let next: Set<string> | null = null
    for (const e of tr.effects) {
      if (e.is(showHeader) && !(next ?? set).has(e.value)) (next ??= new Set(set)).add(e.value)
      if (e.is(hideHeader) && (next ?? set).has(e.value)) (next ??= new Set(set)).delete(e.value)
    }
    return next ?? set
  },
})

/** Scene `i`'s header line and prose, as the page reads them now. */
export function regionOf(state: EditorState, i: number): SceneRegion {
  return sceneRegion(state.doc, state.field(headingsField), i, headersNow(state))
}

/** Scene `i`'s header line, where it shows one that still reads as one: read no further than the line. */
export function headerLineOf(state: EditorState, i: number): { header: string; from: number } | null {
  return sceneHeaderLine(state.doc, state.field(headingsField), i, headersNow(state))
}

/** Where heading `index`'s prose starts, for the caret: under its header line, where it shows one. */
export function proseStart(state: EditorState, index: number): number | null {
  return proseStartIn(state.doc, state.field(headingsField), index, headersNow(state))
}

/** The last heading at or before `pos`, or -1 before the first. */
function headingAt(headings: readonly DraftHeading[], pos: number): number {
  let lo = 0
  let hi = headings.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (headings[mid].pos <= pos) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found
}

/** The chapter heading heading `i` is in: itself, or the nearest before it. */
function chapterOf(headings: readonly DraftHeading[], i: number): number {
  let k = i
  while (k >= 0 && headings[k].kind !== 'chapter') k--
  return k
}

/** A line that may stand under a chapter heading: blank, or on its way to being a heading. */
const HEADING_OR_BLANK = /^(#.*)?$/

function judge(tr: Transaction): { why: Refusal | null; join: Join | null } {
  // Undo and redo never reach here: CodeMirror's history dispatches them with
  // `filter: false`, and they only step back to states these rules allowed.
  if (!tr.docChanged) return { why: null, join: null }
  const doc = tr.startState.doc
  const headings = tr.startState.field(headingsField)
  if (headings.length === 0) return { why: 'before-first', join: null }
  let why: Refusal | null = null
  let join: Join | null = null
  /** Chapters whose space above their first scene this edit types into. */
  const underChapter = new Set<number>()
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (why) return
    // Deleting: a heading goes whole or not at all. Nothing may touch part of
    // one — its line break before, its `#` marks, its line break after.
    if (toA > fromA) {
      for (let i = Math.max(0, headingAt(headings, fromA)); i < headings.length && headings[i].pos - 1 < toA; i++) {
        const h = headings[i]
        const lineEnd = lineEndAt(doc, h.pos)
        if (fromA <= h.pos && toA >= lineEnd) {
          const into = h.kind === 'chapter' ? chapterOf(headings, i - 1) : i - 1
          if (into < 0) { why = h.kind === 'chapter' ? 'first-chapter' : 'first-scene'; return }
          if (h.kind === 'scene' && headings[into].kind === 'chapter') { why = 'first-scene'; return }
          if (join) { why = 'two-headings'; return }
          join = { id: h.id, kind: h.kind, into: headings[into].id, at: fromA }
          continue
        }
        const guarded: Array<[number, number]> = [
          [Math.max(0, h.pos - 1), h.pos + HEADING_PREFIX[h.kind].length],
          [lineEnd, Math.min(doc.length, lineEnd + 1)],
        ]
        if (guarded.some(([from, to]) => to > from && fromA < to && toA > from)) { why = 'heading'; return }
      }
    }

    // Inserting, where the change lands.
    if (inserted.length === 0) return
    const text = inserted.toString()
    const i = headingAt(headings, fromA)
    const h = headings[i]
    // Replacing a heading deleted whole: what is typed lands in what was before it.
    if (join && h.id === (join as Join).id) return
    const titleFrom = h.pos + HEADING_PREFIX[h.kind].length
    const lineEnd = lineEndAt(doc, h.pos)
    /*
      Nothing but blank lines above a scene's header line. A line typed there
      would push the header off the first line, where it stops being one and
      becomes prose — which is how a card's draft once exported a header as a
      paragraph of the book.
    */
    if (h.kind === 'scene' && fromA > lineEnd && tr.startState.field(headerScenes, false)?.has(h.id)) {
      const headerFrom = sceneHeaderLine(doc, headings, i, tr.startState.field(headerScenes))?.from ?? null
      const above = headerFrom === null ? '' : fromA < headerFrom ? text : fromA === headerFrom ? text.slice(0, text.lastIndexOf('\n') + 1) : ''
      if (/\S/.test(above)) { why = 'above-header'; return }
    }
    if (fromA === h.pos) {
      // Above a heading: a line break typed at its start, the new line going to what is above.
      if (i === 0) why = 'before-first'
      else if (!text.endsWith('\n')) why = 'heading'
      else if (headings[i - 1].kind === 'chapter') underChapter.add(i - 1)
    } else if (fromA < titleFrom) {
      why = 'heading'
    } else if (fromA < lineEnd) {
      if (text.includes('\n')) why = 'title-break'
    } else if (h.kind === 'chapter' && (fromA > lineEnd || text.includes('\n'))) {
      underChapter.add(i)
    }
  })
  if (!why && underChapter.size > 0) {
    const after = tr.newDoc
    for (const i of underChapter) {
      const from = lineEndAt(after, tr.changes.mapPos(headings[i].pos, 1))
      const to = headings[i + 1] ? tr.changes.mapPos(headings[i + 1].pos, 1) : after.length
      if (after.sliceString(from, to).split('\n').some((line) => !HEADING_OR_BLANK.test(line))) { why = 'chapter-text'; break }
    }
  }
  return why ? { why, join: null } : { why: null, join }
}

/** Refuse, whole, any edit that would change the book's structure other than a join. */
export const keepHeadings: Extension = EditorState.transactionFilter.of((tr) => {
  const { why, join } = judge(tr)
  if (why) return { effects: refused.of(why) }
  return join ? [tr, { effects: joined.of(join) }] : tr
})

/**
 * The line the writer is typing on, if it is below a heading's line, and the
 * one they have just left. Positions are line starts, mapped through later edits.
 */
interface Typing { line: number | null; left: number | null }

/** Clears `left` once the page has looked at it. */
export const settled = StateEffect.define<null>()

export const lineTyped = StateField.define<Typing>({
  create: () => ({ line: null, left: null }),
  update(value, tr) {
    let { line, left } = value
    if (tr.effects.some((e) => e.is(settled))) left = null
    if (tr.docChanged) {
      line = line === null ? null : tr.changes.mapPos(line, -1)
      left = left === null ? null : tr.changes.mapPos(left, -1)
    }
    const doc = tr.state.doc
    const caretLine = doc.lineAt(tr.state.selection.main.head).from
    if (line !== null && caretLine !== line) { left = line; line = null }
    if (tr.docChanged && (tr.isUserEvent('input') || tr.isUserEvent('delete'))) {
      line = underHeading(tr.state, caretLine) >= 0 ? caretLine : null
    }
    return line === value.line && left === value.left ? value : { line, left }
  },
})

/** The heading whose space the line starting at `pos` is in — below the heading's own line — or -1. */
function underHeading(state: EditorState, pos: number): number {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  return i >= 0 && pos > lineEndAt(state.doc, headings[i].pos) ? i : -1
}

/** A scene heading, as typed: `## ` and a title. */
const TYPED_SCENE = /^## (.*\S.*)$/
/** A chapter heading, as typed: `# ` and a title. */
const TYPED_CHAPTER = /^# (.*\S.*)$/

/** A scene's prose either side of a line typed into it: the rest of it, and where the line was. */
export interface Cut {
  sceneId: string
  /** The scene's title, for a new scene that goes on with its prose. */
  sceneTitle: string
  /** The prose with the line taken out, and where the line was in it. */
  prose: string
  at: number
  /** Whether there is prose after the line. */
  tail: boolean
}

/** What a heading typed and left makes. */
export type Typed =
  /** `## Title` in a scene's prose: split the scene there. */
  | { kind: 'split'; cut: Cut; title: string }
  /** `# Title`: a chapter after `chapterId`, from `cut`'s scene on — or all its scenes, under its heading. */
  | { kind: 'chapter'; chapterId: string; cut: Cut | null; title: string }
  /** `## Title` under a chapter heading: the chapter's new first scene. */
  | { kind: 'first-scene'; chapterId: string; title: string }
  /** Anything else left under a chapter heading, which has nowhere to go. */
  | { kind: 'stray' }

/** The line starting at `pos`, if it is a heading typed below one — or, under a chapter, anything typed there. */
export function typedHeading(state: EditorState, pos: number): Typed | null {
  const i = underHeading(state, pos)
  if (i < 0) return null
  const line = state.doc.lineAt(pos)
  const headings = state.field(headingsField)
  const scene = TYPED_SCENE.exec(line.text)
  const chapter = TYPED_CHAPTER.exec(line.text)
  if (headings[i].kind === 'chapter') {
    if (scene) return { kind: 'first-scene', chapterId: headings[i].id, title: scene[1].trim() }
    if (chapter) return { kind: 'chapter', chapterId: headings[i].id, cut: null, title: chapter[1].trim() }
    return line.text === '' ? null : { kind: 'stray' }
  }
  if (!scene && !chapter) return null
  const segment = draftSegments(state)[i]
  const from = line.from - proseFromOf(state, i)
  const head = segment.text.slice(0, from).replace(/\s+$/, '')
  const tail = segment.text.slice(from + line.length).replace(/^\s+/, '')
  const cut: Cut = {
    sceneId: segment.id, sceneTitle: segment.title,
    prose: [head, tail].filter(Boolean).join('\n\n'), at: head.length, tail: tail !== '',
  }
  if (scene) return { kind: 'split', cut, title: scene[1].trim() }
  return { kind: 'chapter', chapterId: headings[chapterOf(headings, i)].id, cut, title: chapter![1].trim() }
}

/**
 * The prose of scene `into` after a join, as the page shows it once `joinSpec`
 * has closed up the seam — and so as the records should hold it.
 */
export function joinedProse(state: EditorState, into: string, seam: number): string {
  const spec = joinSpec(state, seam)
  const closed = spec ? state.update(spec).state : state
  return draftSegments(closed)[closed.field(headingsField).findIndex((h) => h.id === into)].text
}

/** Where the prose of scene `i` starts in the document, as `readDraft` reads it: under the header line, where there is one. */
function proseFromOf(state: EditorState, i: number): number {
  return sceneRegion(state.doc, state.field(headingsField), i, headersNow(state)).bodyFrom
}

/** The run of whitespace around `pos` in `[from, to)`: where it starts and ends. */
function whitespaceAround(state: EditorState, pos: number, from: number, to: number): [number, number] {
  const before = state.doc.sliceString(from, pos)
  const after = state.doc.sliceString(pos, to)
  return [pos - (before.length - before.replace(/\s+$/, '').length), pos + (after.length - after.replace(/^\s+/, '').length)]
}

/**
 * Make the typed line at `pos` the heading `heading`, with one blank line
 * either side of it — how the page composes a heading, so what is either side
 * reads back as the act writes it. `continued`, for a chapter started inside a
 * scene's prose, is the scene heading put under it for the rest of that prose.
 */
export function lineToHeading(
  state: EditorState,
  pos: number,
  heading: { id: string; kind: HeadingKind },
  continued?: { id: string; title: string },
): TransactionSpec {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  const line = state.doc.lineAt(pos)
  const afterTitle = lineEndAt(state.doc, headings[i].pos)
  const end = headings[i + 1]?.pos ?? state.doc.length
  const [lo] = whitespaceAround(state, line.from, afterTitle, line.from)
  const [, hi] = whitespaceAround(state, line.to, line.to, end)
  const under = continued ? `\n\n${HEADING_PREFIX.scene}${oneLine(continued.title)}\n\n` : '\n\n'
  const changes = state.changes([
    { from: lo, to: line.from, insert: '\n\n' },
    // A blank line under it even at the end of the book, to write on.
    { from: line.to, to: hi, insert: under },
  ])
  const effects = [addHeading.of({ ...heading, pos: changes.mapPos(line.from, 1) })]
  if (continued) effects.push(addHeading.of({ id: continued.id, kind: 'scene', pos: changes.mapPos(line.to, -1) + 2 }))
  return {
    changes,
    effects: [...effects, settled.of(null)],
    // The page's own change, not the writer's: `keepHeadings` judges what the writer types.
    filter: false,
  }
}

/** Take away a line left under a chapter heading that is not a heading, with the line break before it. */
export function clearLine(state: EditorState, pos: number): TransactionSpec {
  const line = state.doc.lineAt(pos)
  return { changes: { from: Math.max(0, line.from - 1), to: line.to }, effects: settled.of(null), filter: false }
}

/**
 * Close up the seam a join left at `seam`. Blank lines there become one
 * paragraph break, the seam `joinWithNext` makes; at the start or end of what
 * is under a heading, the one blank line that parts it from a heading. A
 * deletion that ended mid-line joined the words into one line, and that is
 * left as it is. `null` when there is nothing to change.
 */
export function joinSpec(state: EditorState, seam: number): TransactionSpec | null {
  const headings = state.field(headingsField)
  const i = headingAt(headings, seam)
  const afterTitle = lineEndAt(state.doc, headings[i].pos)
  const next = headings[i + 1]
  const end = next?.pos ?? state.doc.length
  const [lo, hi] = whitespaceAround(state, Math.max(afterTitle, Math.min(seam, end)), afterTitle, end)
  const gap = state.doc.sliceString(lo, hi)
  const atEnd = hi === end
  let insert: string
  if (lo === afterTitle || atEnd) insert = atEnd && !next ? '' : '\n\n'
  else if (gap.includes('\n')) insert = '\n\n'
  else return null
  return gap === insert ? null : { changes: { from: lo, to: hi, insert }, filter: false }
}

/**
 * Enter on a heading goes to the prose under it rather than breaking the title
 * in two — the way out of a title a writer reaches for. On a scene with no
 * prose at the end of the book, it makes the line to write on. On a chapter,
 * it goes to the chapter's first scene, or, in a chapter with none yet, makes
 * the line to type one's heading on. At the very start of a heading's line it
 * is left to the default, which pushes the heading down.
 */
export const enterOnHeading: StateCommand = ({ state, dispatch }) => {
  const sel = state.selection.main
  if (!sel.empty) return false
  const headings = state.field(headingsField)
  const i = headingAt(headings, sel.head)
  if (i < 0) return false
  const h = headings[i]
  const lineEnd = lineEndAt(state.doc, h.pos)
  if (sel.head === h.pos || sel.head > lineEnd) return false
  const target = h.kind === 'scene' ? i : (headings[i + 1]?.kind === 'scene' ? i + 1 : -1)
  if (target < 0) {
    dispatch(state.update({ changes: { from: lineEnd, insert: '\n\n' }, selection: EditorSelection.cursor(lineEnd + 2), scrollIntoView: true, userEvent: 'input' }))
    return true
  }
  const at = proseStart(state, target)
  if (at !== null) {
    dispatch(state.update({ selection: EditorSelection.cursor(at), scrollIntoView: true, userEvent: 'select' }))
  } else {
    const end = lineEndAt(state.doc, headings[target].pos)
    dispatch(state.update({ changes: { from: end, insert: '\n\n' }, selection: EditorSelection.cursor(end + 2), scrollIntoView: true, userEvent: 'input' }))
  }
  return true
}

/*
  ── The scene keys ─────────────────────────────────────────────────────────

  The same keys as a scene card's draft (`sceneShortcut`), answered in the
  page's own terms. Stepping moves the caret. Making a scene opens the line to
  type its heading on, `## `, and the writer names it there — the page already
  makes a scene from a heading typed and left, so the keys only save typing
  the marks. A line a key opened and the writer left without a title was never
  theirs, and goes.
*/

/** The line a scene key opened: its text as the key put it in, and where. */
interface Opened { from: number; to: number; text: string }

const openLine = StateEffect.define<Opened>()

export const openedLine = StateField.define<Opened | null>({
  create: () => null,
  update(value, tr) {
    const set = tr.effects.find((e) => e.is(openLine))
    if (set) return set.value as Opened
    // Made a heading. Not on `settled`: the key's own keystroke leaves the line before, and that settles.
    if (!value || tr.effects.some((e) => e.is(addHeading))) return null
    if (!tr.docChanged) return value
    const from = tr.changes.mapPos(value.from, 1)
    const to = tr.changes.mapPos(value.to, -1)
    return to > from ? { ...value, from, to } : null
  },
})

/** Where `pos` is in the book: the chapter it is in, and the scene, if it is in one — or null before the first chapter. */
export function placeInBook(state: EditorState, pos: number): { chapterId: string; sceneId: string | null } | null {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  if (i < 0) return null
  const c = chapterOf(headings, i)
  if (c < 0) return null
  return { chapterId: headings[c].id, sceneId: headings[i].kind === 'scene' ? headings[i].id : null }
}

/** The scene Focus mode opens from `pos`: the one it is in, or, in a chapter's heading or space, that chapter's first. */
export function focusScene(state: EditorState, pos: number): string | null {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  if (i < 0) return null
  const k = headings[i].kind === 'scene' ? i : i + 1
  return headings[k]?.kind === 'scene' ? headings[k].id : null
}

/** The scene heading after or before heading `i`, across chapters, or -1 at either end of the book. */
function sceneFrom(headings: readonly DraftHeading[], i: number, dir: 'next' | 'previous'): number {
  let k = i
  do k += dir === 'next' ? 1 : -1
  while (k >= 0 && k < headings.length && headings[k].kind !== 'scene')
  return k >= 0 && k < headings.length ? k : -1
}

/** The scene after or before scene `id` on the page, or null. */
export function sceneBeside(state: EditorState, id: string, dir: 'next' | 'previous'): string | null {
  const headings = state.field(headingsField)
  const i = headings.findIndex((h) => h.id === id)
  const k = i < 0 ? -1 : sceneFrom(headings, i, dir)
  return k < 0 ? null : headings[k].id
}

/** Ctrl+Alt+↓ / ↑: the caret to the next or previous scene's prose, across chapters. */
export function stepScene(dir: 'next' | 'previous'): StateCommand {
  return ({ state, dispatch }) => {
    const headings = state.field(headingsField)
    const k = sceneFrom(headings, headingAt(headings, state.selection.main.head), dir)
    if (k < 0) return false
    const at = proseStart(state, k) ?? lineEndAt(state.doc, headings[k].pos)
    dispatch(state.update({ selection: EditorSelection.cursor(at), scrollIntoView: true, userEvent: 'select' }))
    return true
  }
}

/**
 * Ctrl+Enter: a line for a new scene's heading after the scene the caret is in
 * — or, in a chapter's space, for its first scene. Ctrl+Shift+Enter: the same
 * line at the caret, so the prose after it goes to the new scene.
 */
export function openSceneLine(kind: 'new' | 'split'): StateCommand {
  return ({ state, dispatch }) => {
    const sel = state.selection.main
    const headings = state.field(headingsField)
    const i = headingAt(headings, sel.head)
    if (i < 0) return false
    const lineEnd = lineEndAt(state.doc, headings[i].pos)
    let at: number
    let text: string
    if (kind === 'split') {
      // In a scene's prose only: not on its heading's line, nor in its header line.
      if (headings[i].kind !== 'scene' || sel.head <= lineEnd || sel.head < regionOf(state, i).bodyFrom) return false
      at = sel.head
      text = `\n\n${HEADING_PREFIX.scene}\n\n`
    } else {
      const end = headings[i].kind === 'chapter' ? lineEnd : (headings[i + 1] ? headings[i + 1].pos - 1 : state.doc.length)
      const body = state.doc.sliceString(lineEnd, end)
      at = lineEnd + body.replace(/\s+$/, '').length
      text = `\n\n${HEADING_PREFIX.scene}`
    }
    const caret = at + 2 + HEADING_PREFIX.scene.length
    dispatch(state.update({
      changes: { from: at, insert: text },
      selection: EditorSelection.cursor(caret),
      effects: openLine.of({ from: at, to: at + text.length, text }),
      scrollIntoView: true,
      userEvent: 'input',
    }))
    return true
  }
}

/** Take away the line a key opened, if it was left as the key made it. */
export function abandonedLine(state: EditorState, pos: number): TransactionSpec | null {
  const o = state.field(openedLine, false)
  if (!o) return null
  const line = state.doc.lineAt(o.from + 2)
  // A title typed on the line goes after what the key put in, so the line is what says it is still untitled.
  if (state.doc.lineAt(pos).from !== line.from || line.text.trim() !== HEADING_PREFIX.scene.trim()) return null
  if (state.doc.sliceString(o.from, o.to) !== o.text) return null
  return { changes: { from: o.from, to: o.to }, effects: settled.of(null), filter: false }
}

/**
 * An "@" name being typed at the caret in a scene's prose, in document
 * positions, and the scene it names someone in — or null: on a heading's line,
 * under a chapter heading, with a selection, or with no token (`findMentionToken`).
 */
export function mentionAt(
  state: EditorState,
  candidates: readonly MentionCandidate[],
): (MentionToken & { sceneId: string; inHeader: boolean }) | null {
  const sel = state.selection.main
  if (!sel.empty) return null
  const headings = state.field(headingsField)
  const i = headingAt(headings, sel.head)
  if (i < 0 || headings[i].kind !== 'scene' || sel.head <= lineEndAt(state.doc, headings[i].pos)) return null
  const line = state.doc.lineAt(sel.head)
  const token = findMentionToken(line.text, sel.head - line.from, candidates)
  if (!token) return null
  // In the header line a name is somebody present, and the sigil is its syntax: see the card's `headerRange`.
  const { headerFrom } = regionOf(state, i)
  const inHeader = headerFrom !== null && state.doc.lineAt(headerFrom).from === line.from
  return { ...token, start: token.start + line.from, end: token.end + line.from, sceneId: headings[i].id, inHeader }
}

/**
 * Bring every scene's header line into step with its records: `rendered` is
 * each scene's line drawn from them, empty where they say nothing. A line is
 * put in where the records say something and the page shows nothing, taken out
 * where they now say nothing, and rewritten where it says something else.
 * `skip` is the scenes left as they are — the one the writer is on, and any
 * whose line names somebody this world has not got, kept as typed.
 *
 * Not the writer's edit, and nothing to undo: it is the page catching up with
 * the records. `null` when every line already agrees.
 */
export function headerSyncSpec(state: EditorState, rendered: ReadonlyMap<string, string>, skip: ReadonlySet<string>): TransactionSpec | null {
  const headings = state.field(headingsField)
  const shown = state.field(headerScenes)
  const changes: Array<{ from: number; to?: number; insert?: string }> = []
  const effects: StateEffect<string>[] = []
  headings.forEach((h, i) => {
    if (h.kind !== 'scene' || skip.has(h.id)) return
    const want = rendered.get(h.id) ?? ''
    // Most scenes agree, and are known to by reading one line of each.
    const current = sceneHeaderLine(state.doc, headings, i, shown)
    if (current && want === current.header) return
    if (!current && !want) {
      if (shown.has(h.id)) effects.push(hideHeader.of(h.id))
      return
    }
    if (current && want) {
      const line = state.doc.lineAt(current.from)
      changes.push({ from: line.from, to: line.to, insert: want })
      return
    }
    const region = regionOf(state, i)
    const lineEnd = lineEndAt(state.doc, h.pos)
    const end = headings[i + 1]?.pos ?? state.doc.length
    if (current) {
      // Nothing to say any more: the line goes, with the blank line it stood on.
      const from = region.text === '' ? Math.max(lineEnd, region.headerFrom! - 2) : region.headerFrom!
      changes.push({ from, to: region.text === '' ? state.doc.lineAt(region.headerFrom!).to : region.bodyFrom })
      effects.push(hideHeader.of(h.id))
      return
    }
    // A line to put in, first under the title: above the prose, or on its own.
    const bodyFrom = region.bodyFrom
    if (bodyFrom < end && region.text !== '') changes.push({ from: lineEnd, to: bodyFrom, insert: `\n\n${want}\n\n` })
    else if (headings[i + 1]) changes.push({ from: lineEnd, insert: `\n\n${want}` })
    else changes.push({ from: lineEnd, to: state.doc.length, insert: `\n\n${want}` })
    if (!shown.has(h.id)) effects.push(showHeader.of(h.id))
  })
  if (changes.length === 0 && effects.length === 0) return null
  return { changes, effects, filter: false, annotations: Transaction.addToHistory.of(false) }
}

/**
 * The header line of scene `id`, joined into the scene before it, taken out:
 * after a join it would be the middle of the prose it joined. `before` is the
 * page as it was before the join, and `changes` the join itself.
 */
export function joinedHeaderSpec(before: EditorState, changes: ChangeDesc, id: string): TransactionSpec | null {
  if (!before.field(headerScenes).has(id)) return null
  const i = before.field(headingsField).findIndex((h) => h.id === id)
  if (i < 0) return null
  const { headerFrom } = regionOf(before, i)
  if (headerFrom === null) return { effects: hideHeader.of(id) }
  const line = before.doc.lineAt(headerFrom)
  const from = changes.mapPos(line.from, 1)
  const to = changes.mapPos(line.to, -1)
  return { changes: to > from ? { from, to } : [], effects: hideHeader.of(id), filter: false }
}

/** The book, as a starting state: the text, the headings, and the rules. */
export function draftState(chapters: DraftChapter[], extensions: Extension[] = []): EditorState {
  const { text, headings, headers } = composeDraft(chapters)
  return EditorState.create({
    doc: text,
    extensions: [headingsField.init(() => headings), headerScenes.init(() => new Set(headers)), keepHeadings, lineTyped, openedLine, ...extensions],
  })
}

/**
 * Every heading's title and every scene's prose, as the document has them now.
 * A header line being typed as a scene's first line is read as one already,
 * so the save a second later does not write it into the prose.
 */
export function draftSegments(state: EditorState): DraftSegment[] {
  return readDraft(state.doc, state.field(headingsField), headersNow(state))
}

/** The scenes whose first line reads as a header now: those that show one, and one being typed. */
function headersNow(state: EditorState): ReadonlySet<string> {
  const shown = state.field(headerScenes, false) ?? new Set<string>()
  const typing = typedHeaderScene(state)
  return typing && !shown.has(typing) ? new Set([...shown, typing]) : shown
}

/** The scene whose first line under its title is the line starting at `pos`, and its index — or null. */
export function firstLineOf(state: EditorState, pos: number): { id: string; index: number } | null {
  const headings = state.field(headingsField)
  const i = headingAt(headings, pos)
  if (i < 0 || headings[i].kind !== 'scene') return null
  const lineEnd = lineEndAt(state.doc, headings[i].pos)
  const end = headings[i + 1]?.pos ?? state.doc.length
  const lead = state.doc.sliceString(lineEnd, Math.min(end, lineEnd + 256))
  const first = lineEnd + (lead.length - lead.replace(/^\n+/, '').length)
  if (first >= end || state.doc.lineAt(pos).from !== first) return null
  return { id: headings[i].id, index: i }
}

/** A scene whose first line is being typed and reads as a header line. */
function typedHeaderScene(state: EditorState): string | null {
  const { line } = state.field(lineTyped, false) ?? { line: null }
  if (line === null) return null
  const scene = firstLineOf(state, line)
  return scene && splitSceneHeader(state.doc.lineAt(line).text).header ? scene.id : null
}
