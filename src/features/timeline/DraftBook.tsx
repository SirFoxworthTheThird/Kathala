import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Prec, RangeSetBuilder, type EditorState } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { compareByPosition } from '@/lib/fractionalOrder'
import { HEADING_PREFIX, proseStart, lineEndAt, type DraftChapter } from '@/lib/draftDocument'
import { draftState, draftSegments, enterOnHeading, headingsField, refused, type Refusal } from '@/lib/draftEditor'
import {
  storedValues, shownValues, planSync, bookToShow, pendingWrites, afterWrite, type Held,
} from '@/lib/draftSync'
import type { Chapter, SceneText, WorldEvent } from '@/types'

/*
  The Timeline's Page view: the whole of one timeline as a single document —
  `# Chapter`, `## Scene`, prose — written in one CodeMirror editor.

  The editor is a view of the records, not a copy of them. Prose is still one
  SceneText per scene and titles are still the chapters' and scenes' own; the
  page composes them into a document, and writes each scene's prose and each
  renamed title back to its own record. What the editor may do to the
  structure, and how it keeps each heading's record, is `src/lib/draftEditor.ts`;
  how it and the store stay in step is `src/lib/draftSync.ts`.
*/

/** Same as a scene's own draft box, so the two save on the same beat. */
const AUTOSAVE_MS = 1000

const REFUSALS: Record<Refusal, string> = {
  'heading': 'Chapters and scenes are not joined, split or removed from the page yet — use Cards for that.',
  'title-break': 'A title is one line. Enter at the end of a title goes to its prose.',
  'chapter-text': 'Prose belongs to a scene. Write it under a scene heading.',
  'before-first': 'The book starts at its first chapter heading.',
}

function buildBook(chapters: Chapter[], events: WorldEvent[], texts: SceneText[]): DraftChapter[] {
  const prose = new Map(texts.map((t) => [t.eventId, t.text]))
  const byChapter = new Map<string, WorldEvent[]>()
  for (const e of events) {
    const list = byChapter.get(e.chapterId) ?? []
    list.push(e)
    byChapter.set(e.chapterId, list)
  }
  return [...chapters]
    .sort((a, b) => a.number - b.number)
    .map((c) => ({
      id: c.id,
      title: c.title,
      scenes: [...(byChapter.get(c.id) ?? [])].sort(compareByPosition)
        .map((e) => ({ id: e.id, title: e.title, text: prose.get(e.id) ?? '' })),
    }))
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
    Its own queries rather than the Timeline's: those default to an empty list
    while they load, and a book composed before its prose had arrived would
    show every scene empty — and save the first keystroke in one over the
    prose it really has. These are `undefined` until they answer, and the
    editor waits for all three.
  */
  const chapters = useLiveQuery(() => db.chapters.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const events = useLiveQuery(() => db.events.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const texts = useLiveQuery(() => db.sceneTexts.where('worldId').equals(worldId).toArray(), [worldId])
  const book = useMemo(
    () => (chapters && events && texts ? buildBook(chapters, events, texts) : null),
    [chapters, events, texts],
  )

  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const baseRef = useRef<Map<string, Held>>(new Map())
  const inFlight = useRef(new Set<string>())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  async function save() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const view = viewRef.current
    if (!view) return
    const writes = pendingWrites(baseRef.current, shownValues(draftSegments(view.state)))
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
  const saveRef = useRef(save)
  saveRef.current = save

  function extensions() {
    return [
      history(),
      Prec.high(keymap.of([{ key: 'Enter', run: enterOnHeading }])),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'The book, as one page', spellcheck: 'true' }),
      headingStyles,
      theme,
      EditorView.updateListener.of((u) => {
        const why = u.transactions.flatMap((tr) => tr.effects).find((e) => e.is(refused))
        if (why) setNotice(REFUSALS[why.value as Refusal])
        if (u.docChanged) {
          setNotice(null)
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
        }
        if (u.focusChanged && !u.view.hasFocus) void saveRef.current()
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
  useEffect(() => {
    const view = viewRef.current
    if (!view || !book) return
    const shown = shownValues(draftSegments(view.state))
    const plan = planSync(storedValues(book), baseRef.current, shown, inFlight.current)
    baseRef.current = plan.base
    if (!plan.restructure && plan.take.length === 0) return
    const place = placeOf(view.state)
    const scroll = view.scrollSnapshot()
    view.setState(draftState(bookToShow(book, plan.base, shown, new Set(plan.take)), extensionsRef.current()))
    const at = positionOf(view.state, place)
    if (at !== null) view.dispatch({ selection: { anchor: at }, effects: scroll })
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
