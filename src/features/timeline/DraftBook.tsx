import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Compartment, Prec, RangeSetBuilder, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, undoDepth, redoDepth } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { createEventAt, updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { joinChapterToPrevious, joinWithNext, splitScene, startChapter } from '@/db/hooks/useSceneStructure'
import { useRedoAction, useUndoAction } from '@/features/history'
import { HEADING_PREFIX, proseStart, lineEndAt, draftBook, type DraftChapter } from '@/lib/draftDocument'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse,
  lineToHeading, clearLine, joinSpec, type Refusal, type Join, type Typed,
} from '@/lib/draftEditor'
import {
  storedValues, shownValues, planSync, bookToShow, pendingWrites, afterWrite, sameText, sameShape, type Held,
} from '@/lib/draftSync'
import { splitProse } from '@/lib/sceneStructure'
import { generateId } from '@/lib/id'

/*
  The Timeline's Page view: the whole of one timeline as a single document —
  `# Chapter`, `## Scene`, prose — written in one CodeMirror editor.

  The editor is a view of the records, not a copy of them. Prose is still one
  SceneText per scene and titles are still the chapters' and scenes' own; the
  page composes them into a document, and writes each scene's prose and each
  renamed title back to its own record. What the editor may do to the
  structure, and how it keeps each heading's record, is `src/lib/draftEditor.ts`;
  how it and the store stay in step is `src/lib/draftSync.ts`.

  A split or a join made on the page is the same act as on a scene card
  (`splitScene`, `joinWithNext`), one step of undo. The page shows its result
  at once — the typed line becomes the new scene's heading, under the id the
  record is then written with — so the writer goes on typing while the records
  are written, and nothing is rebuilt. Until the store shows the act, the page
  does not read the store, which half-way through would say the new scene has
  no prose.

  The editor's own undo history starts again at each one, because stepping
  back through it would undo the text of a heading whose record has been
  written. So Ctrl+Z takes back typing since the split or join, and then the
  split or join itself, from the journal.
*/

/** Same as a scene's own draft box, so the two save on the same beat. */
const AUTOSAVE_MS = 1000

const REFUSALS: Record<Refusal, string> = {
  'heading': 'A heading goes whole: to join it to what is before it, delete its entire line.',
  'first-chapter': 'This is the first chapter, so there is no chapter before it to join.',
  'first-scene': 'This is the first scene of its chapter, so there is no scene before it to join.',
  'two-headings': 'Join one at a time.',
  'title-break': 'A title is one line. Enter at the end of a title goes to its prose.',
  'chapter-text': 'Under a chapter heading only a heading can go: ## and a title starts its first scene, # and a title a new chapter.',
  'before-first': 'The book starts at its first chapter heading.',
}

/** Heading lines, sized; their `#` marks drawn quieter than the title. Visible part only. */
const headingStyles = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) { this.decorations = this.build(view) }
  update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view) }
  build(view: EditorView) {
    const b = new RangeSetBuilder<Decoration>()
    const headings = view.state.field(headingsField)
    for (const { from, to } of view.visibleRanges) {
      for (const h of headings) {
        if (h.pos < from || h.pos > to) continue
        b.add(h.pos, h.pos, Decoration.line({ class: h.kind === 'chapter' ? 'cm-draft-chapter' : 'cm-draft-scene' }))
        b.add(h.pos, h.pos + HEADING_PREFIX[h.kind].length, Decoration.mark({ class: 'cm-draft-marks' }))
      }
    }
    return b.finish()
  }
}, { decorations: (v) => v.decorations })

const theme = EditorView.theme({
  '&': { height: '100%', color: 'hsl(var(--foreground))', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-prose)', fontSize: '1.125rem', lineHeight: '1.8', overflow: 'auto' },
  '.cm-content': { maxWidth: '42rem', margin: '0 auto', padding: '1.5rem 1.5rem 40vh', caretColor: 'hsl(var(--foreground))' },
  '.cm-draft-chapter': { fontSize: '1.45em', fontWeight: '600', paddingTop: '1.2em' },
  '.cm-draft-scene': { fontSize: '1.15em', fontWeight: '600', paddingTop: '0.6em' },
  '.cm-draft-marks': { color: 'hsl(var(--muted-foreground))', fontWeight: '400' },
  '.cm-panels': { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid hsl(var(--border))' },
  '.cm-panel.cm-search': { fontFamily: 'var(--font-body)', fontSize: '0.875rem' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    color: 'hsl(var(--foreground))', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '4px',
  },
  '.cm-searchMatch': { backgroundColor: 'hsl(var(--accent))' },
  '.cm-searchMatch.cm-searchMatch-selected': { outline: '2px solid hsl(var(--ring))' },
})

export interface PageTarget { id: string; nonce: number; focus?: boolean }

export default function DraftBook({ worldId, timelineId, target }: { worldId: string; timelineId: string; target: PageTarget | null }) {
  /*
    Its own queries rather than the Timeline's, which default to an empty list
    while they load: these are `undefined` until they answer, and `draftBook`
    waits for all three.
  */
  const chapters = useLiveQuery(() => db.chapters.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const events = useLiveQuery(() => db.events.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const texts = useLiveQuery(() => db.sceneTexts.where('worldId').equals(worldId).toArray(), [worldId])
  const book = useMemo(() => draftBook(chapters, events, texts), [chapters, events, texts])

  const bookRef = useRef(book)
  bookRef.current = book

  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const baseRef = useRef<Map<string, Held>>(new Map())
  const inFlight = useRef(new Set<string>())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoHistory = useRef(new Compartment())
  /**
   * A split or join being written. While `acting`, nothing is saved; until
   * `done` says the store shows it, the store is not read.
   */
  const busy = useRef<{
    acting: boolean
    /** Whether the act was written, once it has been. */
    acted: Promise<boolean>
    done: (book: DraftChapter[]) => boolean
    finish: () => void
  } | null>(null)
  /** Whether Ctrl+Z (or Ctrl+Shift+Z), once the editor has nothing to take back, goes to the journal for a split or join. */
  const structural = useRef<'undo' | 'redo' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const undo = useUndoAction(worldId)
  const redo = useRedoAction(worldId)
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo

  /** Write every heading whose `shown` value differs from what the page knows the records to say. */
  async function write(shown: Map<string, Held>) {
    const writes = pendingWrites(baseRef.current, shown)
    // The base moves before the writes start, and the ids stay in flight until
    // each lands: see `planSync` for what reading the store in between would do.
    const before = new Map(baseRef.current)
    for (const w of writes) { inFlight.current.add(w.id); baseRef.current = afterWrite(baseRef.current, w) }
    await Promise.all(writes.map(async (w) => {
      try {
        if (w.kind === 'chapter') await updateChapter(w.id, { title: w.title ?? '' })
        else {
          if (w.title !== undefined) await updateEvent(w.id, { title: w.title })
          if (w.text !== undefined) await setSceneText(worldId, w.id, w.text)
        }
      } catch (err) {
        // Not written, so not known to the store: back to owing it, and the next save tries again.
        const was = before.get(w.id)
        if (was) baseRef.current = new Map(baseRef.current).set(w.id, was)
        console.error('Page view: a write failed', err)
      } finally {
        inFlight.current.delete(w.id)
      }
    }))
  }

  /** What a save asked for while a split or join was being written, for when it has been. */
  const owedAfterAct = useRef<Map<string, Held> | null>(null)

  async function save() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const view = viewRef.current
    if (!view) return
    // Read now: this may be the page closing, and the editor is gone once it has.
    const shown = shownValues(draftSegments(view.state))
    if (busy.current?.acting) { owedAfterAct.current = shown; return }
    await write(shown)
  }
  const saveRef = useRef(save)
  saveRef.current = save

  /** Start the editor's own history again: see the note at the top. */
  function forgetHistory(view: EditorView) {
    view.dispatch({ effects: undoHistory.current.reconfigure([]) })
    view.dispatch({ effects: undoHistory.current.reconfigure(history()) })
  }

  /**
   * Write a split or a join the page already shows. `owed` is every heading as
   * it is to be saved first — the ones the act touches as they were just
   * before it, so undo puts back what the writer had. `settle` is what the act
   * leaves each of them holding (`null`: gone).
   */
  async function restructure(opts: {
    owed: Map<string, Held>
    settle: Map<string, Held | null>
    act: () => Promise<boolean>
  }) {
    const view = viewRef.current
    if (!view || busy.current) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    // The store shows the act once it holds what the act leaves, in the shape the page has.
    const done = (book: DraftChapter[]) => {
      const stored = storedValues(book)
      for (const [id, held] of opts.settle) {
        const now = stored.get(id)
        if (held ? !now || !sameText(now.text, held.text) : now) return false
      }
      return sameShape(stored, shownValues(draftSegments(view.state)))
    }
    let settle: (acted: boolean) => void = () => {}
    const mine = { acting: true, acted: new Promise<boolean>((resolve) => { settle = resolve }), done, finish: () => {} }
    busy.current = mine
    // The act is the last thing the writer did from the moment they did it: a
    // Ctrl+Z pressed while it is still being written waits for it, then takes it back.
    structural.current = 'undo'
    let acted = false
    try {
      await write(opts.owed)
      acted = await opts.act()
    } catch (err) {
      console.error('Page view: a split or join failed', err)
    }
    settle(acted)
    const base = new Map(baseRef.current)
    if (acted) {
      for (const [id, held] of opts.settle) { if (held) base.set(id, held); else base.delete(id) }
    } else {
      // Not written: the page is showing something the store does not hold, and the store's is kept.
      const shown = shownValues(draftSegments(view.state))
      for (const id of opts.settle.keys()) { const here = shown.get(id); if (here) base.set(id, here); else base.delete(id) }
    }
    baseRef.current = base
    mine.acting = false
    if (!acted && structural.current === 'undo') structural.current = null
    // Anything typed while the act was written is owed now — from the page, or
    // from the save that asked while the page was closing.
    const later = owedAfterAct.current
    owedAfterAct.current = null
    const open = viewRef.current
    if (open) void saveRef.current()
    else if (later) void write(later)
    mine.finish = () => {
      if (busy.current !== mine) return
      busy.current = null
      syncRef.current()
    }
    // The store has shown the act by the time it returns in every split and join
    // the page spec made when this was written (14 of 14, measured); this waits
    // in case it has not, and stops waiting in the end.
    const current = bookRef.current
    if (!acted || (current && done(current))) { mine.finish(); return }
    setTimeout(mine.finish, 3000)
  }

  /** Put the caret where the writer goes on under heading `id`. */
  function caretUnder(view: EditorView, id: string) {
    const headings = view.state.field(headingsField)
    const i = headings.findIndex((h) => h.id === id)
    if (i < 0) return
    const pos = proseStart(view.state.doc, headings, i) ?? lineEndAt(view.state.doc, headings[i].pos)
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true, userEvent: 'select' })
  }

  /** Make what a typed heading asks for: see `typedHeading`. */
  function make(typed: Typed, at: number, caretAfter: boolean) {
    const view = viewRef.current
    if (!view) return
    if (typed.kind === 'stray') {
      view.dispatch(clearLine(view.state, at))
      setNotice(REFUSALS['chapter-text'])
      return
    }
    const owed = shownValues(draftSegments(view.state))
    const settle = new Map<string, Held | null>()
    let spec: TransactionSpec
    let act: () => Promise<boolean>
    let goTo: string
    if (typed.kind === 'first-scene') {
      const id = generateId()
      spec = lineToHeading(view.state, at, { id, kind: 'scene' })
      settle.set(id, { kind: 'scene', title: typed.title, text: '' })
      act = async () => !!(await createEventAt(typed.chapterId, 0, typed.title, { id }))
      goTo = id
    } else {
      // The scene the line was typed in is saved without it first, so undo puts back the prose it had.
      const cut = typed.cut
      const { head, tail } = cut ? splitProse(cut.prose, cut.at) : { head: '', tail: '' }
      const was = cut ? owed.get(cut.sceneId) : undefined
      if (cut && was) {
        owed.set(cut.sceneId, { ...was, text: cut.prose })
        settle.set(cut.sceneId, { ...was, text: head })
      }
      const id = generateId()
      if (typed.kind === 'split') {
        spec = lineToHeading(view.state, at, { id, kind: 'scene' })
        settle.set(id, { kind: 'scene', title: typed.title, text: tail })
        act = async () => !!(await splitScene(typed.cut.sceneId, typed.cut.at, typed.title, { id }))
        goTo = id
      } else {
        const rest = cut?.tail ? { id: generateId(), title: cut.sceneTitle } : undefined
        spec = lineToHeading(view.state, at, { id, kind: 'chapter' }, rest)
        settle.set(id, { kind: 'chapter', title: typed.title, text: '' })
        if (rest) settle.set(rest.id, { kind: 'scene', title: rest.title, text: tail })
        act = async () => !!(await startChapter({
          chapterId: typed.chapterId, afterSceneId: cut?.sceneId ?? null, title: typed.title, id,
          split: rest && cut ? { at: cut.at, id: rest.id } : undefined,
        }))
        goTo = rest?.id ?? id
      }
    }
    view.dispatch(spec)
    forgetHistory(view)
    if (caretAfter) caretUnder(view, goTo)
    void restructure({ owed, settle, act })
  }

  function join(j: Join, before: EditorState, seam: number) {
    const view = viewRef.current
    if (!view) return
    const spec = joinSpec(view.state, seam)
    const owed = shownValues(draftSegments(view.state))
    const into = owed.get(j.into)
    if (!into) return
    const was = shownValues(draftSegments(before))
    for (const id of [j.into, j.id]) { const v = was.get(id); if (v) owed.set(id, v) }
    const settle = new Map<string, Held | null>([[j.id, null]])
    let act: () => Promise<boolean>
    if (j.kind === 'scene') {
      const prose = joinedProse(view.state, j.into, seam)
      settle.set(j.into, { ...into, text: prose })
      act = () => joinWithNext(j.into, { prose })
    } else {
      act = () => joinChapterToPrevious(j.id)
    }
    if (spec) view.dispatch(spec)
    forgetHistory(view)
    void restructure({ owed, settle, act })
  }

  function extensions() {
    const typing = (tr: { isUserEvent: (e: string) => boolean }) => tr.isUserEvent('input') || tr.isUserEvent('delete')
    const journal = (from: 'undo' | 'redo') => (view: EditorView) => {
      const depth = from === 'undo' ? undoDepth(view.state) : redoDepth(view.state)
      if (depth > 0 || structural.current !== from) return false
      structural.current = from === 'undo' ? 'redo' : 'undo'
      const take = () => (from === 'undo' ? undoRef.current() : redoRef.current())
      const pending = busy.current
      void (pending?.acting ? pending.acted.then((acted) => (acted ? take() : undefined)) : take())
      return true
    }
    return [
      undoHistory.current.of(history()),
      Prec.highest(keymap.of([
        { key: 'Mod-z', run: journal('undo') },
        { key: 'Mod-Shift-z', run: journal('redo') },
        { key: 'Mod-y', run: journal('redo') },
      ])),
      Prec.high(keymap.of([{ key: 'Enter', run: enterOnHeading }])),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'The book, as one page', spellcheck: 'true' }),
      headingStyles,
      theme,
      EditorView.updateListener.of((u) => {
        const effects = u.transactions.flatMap((tr) => tr.effects)
        const why = effects.find((e) => e.is(refused))
        if (why) setNotice(REFUSALS[why.value as Refusal])
        // Typing after a structural undo: there is no redo to go back to.
        if (structural.current === 'redo' && u.transactions.some((tr) => tr.docChanged && typing(tr))) structural.current = null
        if (u.docChanged) {
          setNotice(null)
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
        }
        // The page cannot be changed from inside its own update: what follows runs straight after it.
        const j = effects.find((e) => e.is(joined))
        if (j) {
          const value = j.value as Join
          const seam = u.changes.mapPos(value.at, -1)
          const before = u.startState
          queueMicrotask(() => join(value, before, seam))
          return
        }
        // A heading typed below one is made once the caret leaves its line, or the page.
        const { line, left } = u.state.field(lineTyped)
        const blurred = u.focusChanged && !u.view.hasFocus
        const from = left ?? (blurred ? line : null)
        const typed = from !== null && !busy.current ? typedHeading(u.state, from) : null
        if (from !== null && typed) {
          // Left by going on below it, under the same heading: the writer goes on under the new one.
          const head = u.state.selection.main.head
          const after = !blurred && head > u.state.doc.lineAt(from).to && placeAt(u.state, head)?.id === placeAt(u.state, from)?.id
          queueMicrotask(() => make(typed, from, after))
          return
        }
        if (left !== null) queueMicrotask(() => viewRef.current?.dispatch({ effects: settled.of(null) }))
        if (blurred) void saveRef.current()
      }),
    ]
  }
  const extensionsRef = useRef(extensions)
  extensionsRef.current = extensions

  // The editor is made once, when the book first arrives whole.
  useEffect(() => {
    if (!book || viewRef.current || !hostRef.current) return
    baseRef.current = storedValues(book)
    viewRef.current = new EditorView({ parent: hostRef.current, state: draftState(book, extensionsRef.current()) })
    setReady(true)
  }, [book])

  // Leaving the page writes what is owed.
  useEffect(() => () => {
    void saveRef.current()
    viewRef.current?.destroy()
    viewRef.current = null
  }, [])

  // The store moved: take what only it changed, and rebuild if the book's shape did.
  function sync() {
    const view = viewRef.current
    const current = bookRef.current
    if (!view || !current || busy.current) return
    const shown = shownValues(draftSegments(view.state))
    const plan = planSync(storedValues(current), baseRef.current, shown, inFlight.current)
    baseRef.current = plan.base
    if (!plan.restructure && plan.take.length === 0) return
    const place = placeOf(view.state)
    const scroll = view.scrollSnapshot()
    view.setState(draftState(bookToShow(current, plan.base, shown, new Set(plan.take)), extensionsRef.current()))
    const at = positionOf(view.state, place)
    if (at !== null) view.dispatch({ selection: { anchor: at }, effects: scroll })
  }
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    const pending = busy.current
    if (pending) { if (!pending.acting && book && pending.done(book)) pending.finish(); return }
    syncRef.current()
  }, [book])

  // Going to a chapter or a scene: from the binder, or arriving at a chapter.
  useEffect(() => {
    const view = viewRef.current
    if (!view || !target) return
    const headings = view.state.field(headingsField)
    const i = headings.findIndex((h) => h.id === target.id)
    if (i < 0) return
    const at = headings[i].kind === 'scene'
      ? (proseStart(view.state.doc, headings, i) ?? lineEndAt(view.state.doc, headings[i].pos))
      : headings[i].pos
    view.dispatch({
      selection: { anchor: at },
      effects: EditorView.scrollIntoView(headings[i].pos, { y: 'start', yMargin: 16 }),
    })
    if (target.focus) view.focus()
  }, [target, ready])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p role="status" className="min-h-[1.5rem] px-4 py-1 text-xs text-[hsl(var(--muted-foreground))]">
        {notice ?? (book && book.length === 0 ? 'No chapters yet — add one to write in.' : '')}
      </p>
      <div ref={hostRef} className="min-h-0 flex-1" />
    </div>
  )
}

/** Where the caret is, as a heading and an offset from it — positions do not survive a rebuild. */
function placeOf(state: EditorState): { id: string; offset: number } | null {
  return placeAt(state, state.selection.main.head)
}

function placeAt(state: EditorState, pos: number): { id: string; offset: number } | null {
  let found: { id: string; offset: number } | null = null
  for (const h of state.field(headingsField)) if (h.pos <= pos) found = { id: h.id, offset: pos - h.pos }
  return found
}

function positionOf(state: EditorState, place: { id: string; offset: number } | null): number | null {
  if (!place) return null
  const headings = state.field(headingsField)
  const i = headings.findIndex((h) => h.id === place.id)
  if (i < 0) return null
  // Before the next heading's line break, or anywhere up to the end of the book.
  const end = headings[i + 1] ? headings[i + 1].pos - 1 : state.doc.length
  return Math.min(headings[i].pos + place.offset, Math.max(headings[i].pos, end))
}
