import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Compartment, Prec, RangeSetBuilder, type ChangeDesc, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, undoDepth, redoDepth } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { createEventAt, updateChapter, updateEvent } from '@/db/hooks/useTimeline'
import { joinChapterToPrevious, joinWithNext, splitScene, startChapter } from '@/db/hooks/useSceneStructure'
import { useRedoAction, useUndoAction } from '@/features/history'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { recordMention } from '@/db/hooks/useMentions'
import { mentionKey, mentionSuggestions, type MentionCandidate, type MentionSuggestion } from '@/lib/mentionPicker'
import { formatSceneHeader, planHeader, planIsClean } from '@/lib/sceneHeader'
import { Button } from '@/components/ui/button'
import { FocusMode } from './FocusMode'
import { MentionMenu } from './MentionMenu'
import { HEADING_PREFIX, lineEndAt, draftBook, sceneRegion, type DraftChapter } from '@/lib/draftDocument'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse,
  lineToHeading, clearLine, joinSpec, stepScene, openSceneLine, abandonedLine, focusScene, sceneBeside, mentionAt, placeInBook,
  proseStart, headerLineOf, firstLineOf, headerScenes, showHeader, hideHeader, headerSyncSpec, joinedHeaderSpec,
  type Refusal, type Join, type Typed,
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

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'
const ALT = IS_MAC ? '⌥' : 'Alt+'
const SHIFT = IS_MAC ? '⇧' : 'Shift+'

const REFUSALS: Record<Refusal, string> = {
  'heading': 'A heading goes whole: to join it to what is before it, delete its entire line.',
  'first-chapter': 'This is the first chapter, so there is no chapter before it to join.',
  'first-scene': 'This is the first scene of its chapter, so there is no scene before it to join.',
  'two-headings': 'Join one at a time.',
  'title-break': 'A title is one line. Enter at the end of a title goes to its prose.',
  'chapter-text': 'Under a chapter heading only a heading can go: ## and a title starts its first scene, # and a title a new chapter.',
  'before-first': 'The book starts at its first chapter heading.',
  'above-header': 'The line under a scene’s title says where it is and who is there, and stays first: write the scene below it.',
}

/** Heading lines, sized; their `#` marks drawn quieter than the title. Visible part only. */
const headingStyles = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) { this.decorations = this.build(view) }
  update(u: ViewUpdate) {
    const headers = u.transactions.some((tr) => tr.effects.some((e) => e.is(showHeader) || e.is(hideHeader)))
    if (u.docChanged || u.viewportChanged || headers) this.decorations = this.build(u.view)
  }
  build(view: EditorView) {
    const b = new RangeSetBuilder<Decoration>()
    const headings = view.state.field(headingsField)
    for (const { from, to } of view.visibleRanges) {
      headings.forEach((h, i) => {
        if (h.pos < from || h.pos > to) return
        b.add(h.pos, h.pos, Decoration.line({ class: h.kind === 'chapter' ? 'cm-draft-chapter' : 'cm-draft-scene' }))
        b.add(h.pos, h.pos + HEADING_PREFIX[h.kind].length, Decoration.mark({ class: 'cm-draft-marks' }))
        // The header line, tinted as in a card's draft: which part is the book is not a guess.
        const header = headerLineOf(view.state, i)
        if (header) b.add(header.from, header.from, Decoration.line({ class: 'cm-draft-header' }))
      })
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
  '.cm-draft-header': { backgroundColor: 'hsl(var(--primary) / 0.14)', borderRadius: '4px', fontFamily: 'var(--font-body)', fontSize: '0.85em' },
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

/** Where the writer is in the book: the chapter the caret is in, and the scene, if it is in one. */
export interface PagePlace { chapterId: string; sceneId: string | null }

export default function DraftBook({ worldId, timelineId, target, open = null, onPlace }: {
  worldId: string
  timelineId: string
  target: PageTarget | null
  /** The chapter open around the page, if one is. */
  open?: string | null
  /** The writer's caret has gone into a chapter other than `open`, or into another scene: the page around it follows. */
  onPlace?: (place: PagePlace) => void
}) {
  const onPlaceRef = useRef(onPlace)
  onPlaceRef.current = onPlace
  const openRef = useRef(open)
  openRef.current = open
  /** The scene the caret last went into, so going into another is reported once. */
  const enteredScene = useRef<string | null>(null)
  /*
    Its own queries rather than the Timeline's, which default to an empty list
    while they load: these are `undefined` until they answer, and `draftBook`
    waits for all three.
  */
  const chapters = useLiveQuery(() => db.chapters.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const events = useLiveQuery(() => db.events.where('timelineId').equals(timelineId).toArray(), [timelineId])
  const texts = useLiveQuery(() => db.sceneTexts.where('worldId').equals(worldId).toArray(), [worldId])
  const characters = useCharacters(worldId)
  const markers = useAllLocationMarkers(worldId)
  /*
    Each scene's header line, drawn from its records as a scene card draws it:
    never stored, so a change made anywhere — the cast panel, the setting, `@@`
    — reaches the page, and the page's line is only ever a view of the records.
  */
  const rendered = useMemo(() => new Map((events ?? []).map((e) => [e.id, formatSceneHeader({
    place: markers.find((m) => m.id === e.locationMarkerId)?.name ?? null,
    characters: e.involvedCharacterIds
      .map((id) => characters.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n),
  })])), [events, characters, markers])
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const book = useMemo(
    () => draftBook(chapters, events, texts, (e) => rendered.get(e.id) ?? ''),
    [chapters, events, texts, rendered],
  )

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

  /*
    Focus mode, as a scene card opens it: on the scene the caret is in, or a
    chapter's first from its heading. It writes the scene's prose itself, and
    the page takes what it wrote from the store like any other change made
    elsewhere.
  */
  const [caretScene, setCaretScene] = useState<string | null>(null)
  const caretSceneRef = useRef<string | null>(null)
  const [focus, setFocus] = useState<{ id: string; text: string } | null>(null)

  /*
    "@" names a character, an item or a place, as in a scene card's draft: the
    same rows, the same keys, the same records written (`recordMention`). The
    name is put in the prose and the record against the scene it is typed in.
  */
  const items = useItems(worldId)
  const mapLayers = useMapLayers(worldId)
  const candidates = useMemo<MentionCandidate[]>(() => [
    ...characters.map((c) => ({ id: c.id, kind: 'character' as const, name: c.name, aliases: c.aliases })),
    ...items.map((i) => ({ id: i.id, kind: 'item' as const, name: i.name })),
    ...markers.map((m) => ({ id: m.id, kind: 'location' as const, name: m.name })),
  ], [characters, items, markers])
  // Read from the editor's keys and updates, which are made once.
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates
  const placesRef = useRef({ markers, mapLayers })
  placesRef.current = { markers, mapLayers }
  const castRef = useRef(characters)
  castRef.current = characters
  /** Scenes whose header line names somebody this world has not got: kept as typed, so the spelling can be fixed. */
  const keptHeaders = useRef(new Set<string>())
  /**
   * Scenes whose header line has just been applied, with each one's line as the
   * records drew it then: until the records change, the page's line is newer
   * than theirs, and bringing it into step would take back what was typed.
   */
  const settling = useRef(new Map<string, { was: string; at: number }>())
  const [headerWarning, setHeaderWarning] = useState<string | null>(null)
  type PageMention = NonNullable<ReturnType<typeof mentionAt>>
  const [mention, setMention] = useState<PageMention | null>(null)
  const mentionRef = useRef<PageMention | null>(null)
  const [highlight, setHighlight] = useState(0)
  const highlightRef = useRef(0)

  /** Every write started and not yet landed, as one promise. */
  const landing = useRef<Promise<unknown>>(Promise.resolve())

  /** Write every heading whose `shown` value differs from what the page knows the records to say. */
  async function write(shown: Map<string, Held>) {
    const writes = pendingWrites(baseRef.current, shown)
    // The base moves before the writes start, and the ids stay in flight until
    // each lands: see `planSync` for what reading the store in between would do.
    const before = new Map(baseRef.current)
    for (const w of writes) { inFlight.current.add(w.id); baseRef.current = afterWrite(baseRef.current, w) }
    const landed = Promise.all(writes.map(async (w) => {
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
    landing.current = Promise.all([landing.current, landed])
    await landed
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
    const pos = proseStart(view.state, i) ?? lineEndAt(view.state.doc, headings[i].pos)
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

  function join(j: Join, before: EditorState, seam: number, changes: ChangeDesc) {
    const view = viewRef.current
    if (!view) return
    // The joined scene's header line first: left where it was, it would be read as the prose it joined.
    const header = j.kind === 'scene' ? joinedHeaderSpec(before, changes, j.id) : null
    if (header) {
      const tr = view.state.update(header)
      view.dispatch(tr)
      seam = tr.changes.mapPos(seam, -1)
    }
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

  /**
   * Bring the header lines into step with the records — except the one the
   * caret is on, which the writer may be typing, and any kept as typed.
   */
  function syncHeaders() {
    const view = viewRef.current
    if (!view || busy.current) return
    const skip = new Set(keptHeaders.current)
    for (const [id, { was, at }] of settling.current) {
      if ((renderedRef.current.get(id) ?? '') === was && Date.now() - at < 3000) skip.add(id)
      else settling.current.delete(id)
    }
    const here = firstLineOf(view.state, view.state.doc.lineAt(view.state.selection.main.head).from)
    if (here) skip.add(here.id)
    const spec = headerSyncSpec(view.state, renderedRef.current, skip)
    if (spec) view.dispatch(spec)
  }

  /**
   * Scene `id`'s first line has been left: make the records say what its
   * header line says, as a scene card does when its box is left. A line that
   * does not read as a header changes nothing — deleting it clears the screen,
   * not the cast — and the records' own line comes back. One that names
   * somebody this world has not got is kept as typed, and said.
   */
  async function applyHeader(id: string) {
    const view = viewRef.current
    if (!view || busy.current) return
    const headings = view.state.field(headingsField)
    const i = headings.findIndex((h) => h.id === id)
    if (i < 0) return
    const { header } = sceneRegion(view.state.doc, headings, i, new Set([id]))
    if (!header) { forgetKept(id); syncHeaders(); return }
    if (!view.state.field(headerScenes).has(id)) view.dispatch({ effects: showHeader.of(id) })
    // Before anything is awaited: the page catches up with the records straight after this starts.
    settling.current.set(id, { was: renderedRef.current.get(id) ?? '', at: Date.now() })
    const event = await db.events.get(id)
    if (!event) { settling.current.delete(id); return }
    const plan = planHeader(header, { characters: castRef.current, places: placesRef.current.markers }, {
      involved: event.involvedCharacterIds, mentioned: event.mentionedCharacterIds ?? [], place: event.locationMarkerId,
    })
    if (planIsClean(plan)) forgetKept(id)
    else {
      keptHeaders.current.add(id)
      const names = [...plan.unknown.names, ...(plan.unknown.place ? [plan.unknown.place] : [])].map((n) => `“${n}”`).join(' or ')
      const left = plan.unknown.names.length > 0 && plan.unknown.place !== null ? 'the scene was left as it was'
        : plan.unknown.names.length > 0 ? 'the cast was left as it was' : 'the setting was left as it was'
      setHeaderWarning(`Nothing in this world is called ${names} — ${left}, so the spelling can be fixed on the line.`)
    }
    // A change reaches the line through the records; with none, the line is put as the records draw it.
    if (plan.update) await updateEvent(id, plan.update)
    else { settling.current.delete(id); syncHeaders() }
  }
  function forgetKept(id: string) {
    if (keptHeaders.current.delete(id) && keptHeaders.current.size === 0) setHeaderWarning(null)
  }

  function showMention(next: PageMention | null) {
    const was = mentionRef.current
    const same = was === next || (!!was && !!next && was.start === next.start && was.end === next.end
      && was.query === next.query && was.intent === next.intent && was.sceneId === next.sceneId && was.inHeader === next.inHeader)
    if (same) return
    mentionRef.current = next
    setMention(next)
    moveHighlight(0)
  }
  function moveHighlight(index: number) { highlightRef.current = index; setHighlight(index) }

  /**
   * The rows for `m`: presence is about people, and out in the prose `@@` may
   * not invent one — see `MentionPickerOptions`. In the header line naming
   * somebody is saying they are present, and a new one may be made there.
   */
  function mentionRows(m: PageMention): MentionSuggestion[] {
    return mentionSuggestions(m.query, candidatesRef.current, {
      canCreateLocation: true,
      ...(m.intent === 'present' || m.inHeader ? { kinds: ['character'] as const, allowCreate: m.inHeader } : {}),
    })
  }

  /** The plain name into the prose, and the record against the scene. */
  function chooseMention(suggestion: MentionSuggestion) {
    const view = viewRef.current
    const m = mentionRef.current
    if (!view || !m) return
    const name = suggestion.type === 'existing' ? suggestion.insert : suggestion.name
    // In the header line the sigil is its syntax, not a trigger to be consumed.
    const insert = m.inHeader ? `@@${name} ` : `${name} `
    view.dispatch({ changes: { from: m.start, to: m.end, insert }, selection: { anchor: m.start + insert.length }, userEvent: 'input.complete' })
    showMention(null)
    void recordMention(m.sceneId, suggestion, m.inHeader ? 'present' : m.intent, placesRef.current)
  }

  /** A key while the picker is open: see `mentionKey`. False leaves it to the page. */
  function mentionKeyRun(key: string): boolean {
    const m = mentionRef.current
    if (!m) return false
    const action = mentionKey(key, mentionRows(m), highlightRef.current)
    if (!action) return false
    if (action.kind === 'highlight') moveHighlight(action.index)
    else if (action.kind === 'select') chooseMention(action.suggestion)
    else { showMention(null); return !action.passThrough }
    return true
  }

  /** Which scene the Focus button would open. */
  function noteCaret(state: EditorState) {
    const id = focusScene(state, state.selection.main.head)
    if (id !== caretSceneRef.current) { caretSceneRef.current = id; setCaretScene(id) }
  }

  /**
   * Focus mode on scene `id`, once what the page owes is written: Focus mode
   * starts from the stored prose and writes the whole of it back, so it must
   * start from the page's.
   */
  async function openFocus(id: string) {
    const pending = busy.current
    if (pending?.acting) await pending.acted
    await saveRef.current()
    /*
      And every write already on its way. A save counts words as written when
      it starts, so one begun a moment ago — the autosave — leaves this save
      nothing to do, and the store without them until it lands.
    */
    await landing.current
    const text = (await db.sceneTexts.where('eventId').equals(id).first())?.text ?? ''
    setFocus({ id, text })
  }

  /** A new scene after `id`, or `id` split at `at`, from Focus mode — which goes on in the scene made. */
  async function makeFromFocus(id: string, kind: 'new' | 'split', title: string, at: number) {
    const scene = events?.find((e) => e.id === id)
    if (!scene) return
    const siblings = (events ?? []).filter((e) => e.chapterId === scene.chapterId).sort((a, b) => a.sortOrder - b.sortOrder)
    const created = kind === 'split'
      ? await splitScene(id, at, title)
      : await createEventAt(scene.chapterId, siblings.findIndex((e) => e.id === id) + 1, title)
    if (created) await openFocus(created.id)
  }

  /** Out of Focus mode: the page, with the caret in the scene the writer was last in. */
  function closeFocus(id: string) {
    setFocus(null)
    const view = viewRef.current
    if (!view) return
    caretUnder(view, id)
    view.focus()
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
        ...['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].map((key) => ({ key, run: () => mentionKeyRun(key) })),
        { key: 'Mod-z', run: journal('undo') },
        { key: 'Mod-Shift-z', run: journal('redo') },
        { key: 'Mod-y', run: journal('redo') },
      ])),
      Prec.high(keymap.of([
        { key: 'Enter', run: enterOnHeading },
        // The scene keys, as in a scene card's draft: see `sceneShortcut`.
        { key: 'Mod-Alt-ArrowDown', run: stepScene('next') },
        { key: 'Mod-Alt-ArrowUp', run: stepScene('previous') },
        { key: 'Mod-Enter', run: openSceneLine('new') },
        { key: 'Mod-Shift-Enter', run: openSceneLine('split') },
      ])),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      search({ top: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'The book, as one page', spellcheck: 'true' }),
      headingStyles,
      theme,
      EditorView.updateListener.of((u) => {
        if (u.selectionSet || u.docChanged) {
          noteCaret(u.state)
          showMention(mentionAt(u.state, candidatesRef.current))
          /*
            The writer's own moves only — typing, a click, the arrows, the scene
            keys. The caret starts at the top of the book and is put where the
            binder sends it; neither is the writer going somewhere.
          */
          const own = u.transactions.some((tr) => tr.isUserEvent('select') || tr.isUserEvent('input') || tr.isUserEvent('delete'))
          const place = own ? placeInBook(u.state, u.state.selection.main.head) : null
          /*
            Another chapter — against the chapter open now, not the last one
            reported: "Whole book" closes it, and going back in opens it again.
            Or another scene: reported once, on the way in, so a time cursor the
            writer has since moved elsewhere is not pulled back by every
            keystroke in the scene they are still in.
          */
          const newScene = !!place?.sceneId && place.sceneId !== enteredScene.current
          if (place && (place.chapterId !== openRef.current || newScene)) {
            if (place.sceneId) enteredScene.current = place.sceneId
            onPlaceRef.current?.(place)
          }
        }
        if (u.focusChanged && !u.view.hasFocus) showMention(null)
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
          const changes = u.changes
          queueMicrotask(() => join(value, before, seam, changes))
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
        // A line a scene key opened and the writer left untitled goes, before anything is saved.
        if (from !== null && abandonedLine(u.state, from)) {
          queueMicrotask(() => {
            const view = viewRef.current
            const spec = view && abandonedLine(view.state, from)
            if (spec) view.dispatch(spec)
            if (blurred) void saveRef.current()
          })
          return
        }
        // A scene's first line, left: its header line, applied — or one just typed there, made one.
        const first = from !== null ? firstLineOf(u.state, from) : null
        if (first) queueMicrotask(() => { void applyHeader(first.id) })
        if (left !== null) queueMicrotask(() => {
          viewRef.current?.dispatch({ effects: settled.of(null) })
          // The page catches up with the records once the writer is off a line: a header line deleted comes back.
          syncHeaders()
        })
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
    noteCaret(viewRef.current.state)
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
    if (plan.restructure || plan.take.length > 0) {
      const place = placeOf(view.state)
      const scroll = view.scrollSnapshot()
      view.setState(draftState(bookToShow(current, plan.base, shown, new Set(plan.take)), extensionsRef.current()))
      const at = positionOf(view.state, place)
      if (at !== null) view.dispatch({ selection: { anchor: at }, effects: scroll })
    }
    syncHeaders()
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
      ? (proseStart(view.state, i) ?? lineEndAt(view.state.doc, headings[i].pos))
      : headings[i].pos
    view.dispatch({
      selection: { anchor: at },
      effects: EditorView.scrollIntoView(headings[i].pos, { y: 'start', yMargin: 16 }),
    })
    if (target.focus) view.focus()
  }, [target, ready])

  const titleOf = (id: string | null) => (id ? events?.find((e) => e.id === id)?.title ?? '' : '')
  const focusEvent = focus ? events?.find((e) => e.id === focus.id) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 py-1">
        <p role="status" className="min-h-[1.5rem] flex-1 text-xs text-[hsl(var(--muted-foreground))]">
          {notice ?? headerWarning ?? (book && book.length === 0 ? 'No chapters yet — add one to write in.' : '')}
        </p>
        {/* The keys a scene card shows under its draft, for the same reason: keys nobody can see are keys nobody uses. */}
        <span className="hidden text-[10px] text-[hsl(var(--muted-foreground))] lg:inline">
          @ names someone · @@ says who is here
          {' · '}<kbd className="font-sans">{MOD}{ALT}↓ ↑</kbd> next or previous scene
          {' · '}<kbd className="font-sans">{MOD}Enter</kbd> new scene after
          {' · '}<kbd className="font-sans">{MOD}{SHIFT}Enter</kbd> split here
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[11px]"
          disabled={!caretScene}
          onClick={() => { if (caretScene) void openFocus(caretScene) }}
          title={caretScene ? `Write “${titleOf(caretScene)}” distraction-free` : 'Put the caret in a scene to write it distraction-free'}
        >
          <Maximize2 className="h-3 w-3" aria-hidden="true" /> Focus
        </Button>
      </div>
      <div ref={hostRef} className="min-h-0 flex-1" />
      {mention && (() => {
        const rows = mentionRows(mention)
        return (
          <MentionMenu
            matches={rows}
            highlight={highlight}
            onHighlight={moveHighlight}
            onSelect={chooseMention}
            nobody={rows.length === 0 && mention.query.trim() !== '' ? mention.query.trim() : null}
            caret={() => {
              const at = viewRef.current?.coordsAtPos(mention.end)
              return at ? { top: at.top, left: at.left, lineHeight: at.bottom - at.top } : null
            }}
            placeKey={`${mention.start}:${mention.end}`}
          />
        )
      })()}
      {focus && (
        <FocusMode
          key={focus.id}
          worldId={worldId}
          eventId={focus.id}
          title={focusEvent?.title ?? ''}
          header={focusEvent ? formatSceneHeader({
            place: markers.find((m) => m.id === focusEvent.locationMarkerId)?.name ?? null,
            characters: focusEvent.involvedCharacterIds
              .map((id) => characters.find((c) => c.id === id)?.name)
              .filter((n): n is string => !!n),
          }) : ''}
          initialText={focus.text}
          onExit={() => closeFocus(focus.id)}
          keys={{
            step: (dir) => {
              const view = viewRef.current
              const next = view ? sceneBeside(view.state, focus.id, dir) : null
              if (!next) return false
              void openFocus(next)
              return true
            },
            make: (kind, title, at) => { void makeFromFocus(focus.id, kind, title, at) },
          }}
        />
      )}
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
