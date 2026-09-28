import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Compartment, EditorState, Prec, RangeSetBuilder } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { joinWithNext, splitScene } from '@/db/hooks/useSceneStructure'
import { useRedoAction, useUndoAction } from '@/features/history'
import { HEADING_PREFIX, proseStart, lineEndAt, draftBook, type DraftChapter } from '@/lib/draftDocument'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse,
  type Refusal, type Join, type TypedHeading,
} from '@/lib/draftEditor'
import {
  storedValues, shownValues, planSync, bookToShow, pendingWrites, afterWrite, sameText, type Held,
} from '@/lib/draftSync'
import { splitProse } from '@/lib/sceneStructure'

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
  (`splitScene`, `joinWithNext`), one step of undo. While it is written the page
  is read-only, and it waits for the store to show the result before it
  rebuilds — a rebuild from a store half-way through the act would show the new
  scene without its prose. Ctrl+Z straight after one takes it back: the act is
  the last thing the writer did, and the editor's own history is new with the
  rebuild, so it has nothing earlier to offer.
*/

/** Same as a scene's own draft box, so the two save on the same beat. */
const AUTOSAVE_MS = 1000

const REFUSALS: Record<Refusal, string> = {
  'heading': 'A heading goes whole: to join a scene to the one before it, delete its entire line.',
  'chapter-heading': 'Chapters are not joined or removed from the page yet — use Cards for that.',
  'first-scene': 'This is the first scene of its chapter, so there is no scene before it to join.',
  'two-headings': 'Join one scene at a time.',
  'title-break': 'A title is one line. Enter at the end of a title goes to its prose.',
  'chapter-text': 'Prose belongs to a scene. Write it under a scene heading.',
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
  const readOnly = useRef(new Compartment())
  /** A split or join being written: saving and syncing wait until `done` says the store shows it. */
  const busy = useRef<{ done: (book: DraftChapter[]) => boolean; finish: () => void } | null>(null)
  /** What Ctrl+Z and Ctrl+Shift+Z do on the page before anything else is typed: the journal's, after a split or join. */
  const structural = useRef<'undo' | 'redo' | null>(null)
  /** After the next rebuild, the scene whose prose the caret goes to. */
  const caretTo = useRef<string | null>(null)
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

  async function save() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const view = viewRef.current
    if (!view || busy.current) return
    await write(shownValues(draftSegments(view.state)))
  }
  const saveRef = useRef(save)
  saveRef.current = save

  /**
   * Write a split or a join. `owed` is every heading as it should be saved
   * first — the ones the act touches as they were just before it, so undo puts
   * back what the writer had. `involved` are the headings whose text the page
   * showed mid-act and the store now describes.
   */
  async function restructure(opts: {
    owed: Map<string, Held>
    involved: string[]
    act: () => Promise<string | null>
    done: (book: DraftChapter[]) => boolean
  }) {
    const view = viewRef.current
    if (!view || busy.current) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    let acted = false
    let caret: string | null = null
    const finish = () => {
      if (!busy.current) return
      busy.current = null
      // Closed while the act was written — Cards chosen straight after typing a heading, say.
      if (viewRef.current !== view) return
      const shown = shownValues(draftSegments(view.state))
      const base = new Map(baseRef.current)
      for (const id of opts.involved) { const here = shown.get(id); if (here) base.set(id, here) }
      baseRef.current = base
      view.dispatch({ effects: readOnly.current.reconfigure([]) })
      caretTo.current = caret
      structural.current = acted ? 'undo' : null
      syncRef.current()
    }
    busy.current = { done: () => false, finish }
    queueMicrotask(() => view.dispatch({ effects: readOnly.current.reconfigure(EditorState.readOnly.of(true)) }))
    try {
      await write(opts.owed)
      caret = await opts.act()
      acted = true
    } catch (err) {
      console.error('Page view: a split or join failed', err)
    }
    // The store answers on its own schedule: finish when it shows the act, or
    // stop waiting and take what it has.
    const book = bookRef.current
    if (!acted || (book && opts.done(book))) { finish(); return }
    busy.current = { done: opts.done, finish }
    setTimeout(finish, 3000)
  }

  function split(typed: TypedHeading, state: EditorState, caretAfter: boolean) {
    const owed = shownValues(draftSegments(state))
    const was = owed.get(typed.sceneId)
    if (!was) return
    owed.set(typed.sceneId, { ...was, text: typed.prose })
    const { head, tail } = splitProse(typed.prose, typed.at)
    let made: string | null = null
    void restructure({
      owed,
      involved: [typed.sceneId],
      act: async () => {
        made = (await splitScene(typed.sceneId, typed.at, typed.title))?.id ?? null
        return caretAfter ? made : null
      },
      done: (book) => {
        const stored = storedValues(book)
        const first = stored.get(typed.sceneId)
        const second = made ? stored.get(made) : undefined
        return !!first && !!second && sameText(first.text, head) && sameText(second.text, tail)
      },
    })
  }

  function join(j: Join, before: EditorState, after: EditorState, seam: number) {
    const owed = shownValues(draftSegments(after))
    const was = shownValues(draftSegments(before))
    for (const id of [j.into, j.id]) { const v = was.get(id); if (v) owed.set(id, v) }
    const prose = joinedProse(after, j.into, seam)
    void restructure({
      owed,
      involved: [j.into],
      act: async () => { await joinWithNext(j.into, { prose }); return null },
      done: (book) => {
        const stored = storedValues(book)
        const into = stored.get(j.into)
        return !stored.has(j.id) && !!into && sameText(into.text, prose)
      },
    })
  }

  function extensions() {
    const typing = (tr: { isUserEvent: (e: string) => boolean }) => tr.isUserEvent('input') || tr.isUserEvent('delete')
    const journal = (from: 'undo' | 'redo') => () => {
      if (structural.current !== from) return false
      structural.current = from === 'undo' ? 'redo' : 'undo'
      void (from === 'undo' ? undoRef.current() : redoRef.current())
      return true
    }
    return [
      history(),
      readOnly.current.of([]),
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
        if (u.transactions.some((tr) => tr.docChanged && typing(tr))) structural.current = null
        const j = effects.find((e) => e.is(joined))
        if (j) {
          const value = j.value as Join
          setNotice(null)
          join(value, u.startState, u.state, u.changes.mapPos(value.at, -1))
          return
        }
        if (u.docChanged) {
          setNotice(null)
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
        }
        // A heading typed into a scene splits it once the caret leaves its line, or the page.
        const { line, left } = u.state.field(lineTyped)
        const blurred = u.focusChanged && !u.view.hasFocus
        const from = left ?? (blurred ? line : null)
        if (from !== null && !busy.current) {
          if (left !== null) queueMicrotask(() => viewRef.current?.dispatch({ effects: settled.of(null) }))
          const typed = typedHeading(u.state, from)
          if (typed) {
            const head = u.state.selection.main.head
            const place = placeOf(u.state)
            split(typed, u.state, !blurred && head > u.state.doc.lineAt(from).to && place?.id === typed.sceneId)
            return
          }
        }
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
    const to = caretTo.current
    caretTo.current = null
    const headings = view.state.field(headingsField)
    const i = to ? headings.findIndex((h) => h.id === to) : -1
    if (i >= 0) {
      const at = proseStart(view.state.doc, headings, i) ?? lineEndAt(view.state.doc, headings[i].pos)
      view.dispatch({ selection: { anchor: at }, scrollIntoView: true })
      view.focus()
      return
    }
    const at = positionOf(view.state, place)
    if (at !== null) view.dispatch({ selection: { anchor: at }, effects: scroll })
  }
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    const pending = busy.current
    if (pending) { if (book && pending.done(book)) pending.finish(); return }
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
  const headings = state.field(headingsField)
  const head = state.selection.main.head
  let found: { id: string; offset: number } | null = null
  for (const h of headings) if (h.pos <= head) found = { id: h.id, offset: head - h.pos }
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
