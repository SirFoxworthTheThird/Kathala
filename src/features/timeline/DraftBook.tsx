import { proseAliases } from '@/lib/characterNames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Compartment, Prec, RangeSetBuilder, Transaction, type ChangeDesc, type EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView, Decoration, ViewPlugin, WidgetType, keymap, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, undoDepth, redoDepth } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { db } from '@/db/database'
import { setSceneText } from '@/db/hooks/useManuscript'
import { createEventAt, moveChapterToTimeline, updateChapter, updateEvent, useTimelines } from '@/db/hooks/useTimeline'
import { useWorld } from '@/db/hooks/useWorlds'
import { ALL_TIMELINES } from '@/lib/readersBook'
import { inBookChapterOrder } from '@/lib/timelineOrder'
import { joinChapterToPrevious, joinWithNext, splitScene, startChapter } from '@/db/hooks/useSceneStructure'
import { useRedoAction, useUndoAction } from '@/features/history'
import { createHeaderCharacter, recordIdentityChanges, useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { recordMention, createHeaderPlace } from '@/db/hooks/useMentions'
import { NewCharacterNames } from './NewCharacterNames'
import { usePendingNames } from '@/lib/pendingNames'
import { HeaderCheatSheet } from './HeaderCheatSheet'
import { stashUnsaved, readUnsaved } from '@/db/hooks/unsavedRescue'
import { keptLines, keepLine, forgetLine, keptLineWarning, keptByPaste, placeChoices, type KeptLine } from '@/lib/keptHeaderLines'
import { placeLabel } from '@/lib/placeNames'
import { mentionKey, mentionSuggestions, type MentionCandidate, type MentionSuggestion } from '@/lib/mentionPicker'
import { formatWhen } from '@/lib/sceneTime'
import { loadSceneTime } from '@/db/hooks/useSceneDay'
import { factPlanWrites, knownBeforeNote, formatSceneHeader, formatSceneHeaderLine, headerFacts, headerItems, headerRelations, planHeader, planIsClean, sceneFacts, sceneFates, sceneItems, scenePlaceStatus, sceneRelations, sceneNames, headerNames, recordBeforeIn } from '@/lib/sceneHeader'
import { loadStory, useStory } from '@/db/hooks/useStory'
import { recordRelationshipChanges } from '@/db/hooks/useRelationships'
import { recordPlaceStatus } from '@/db/hooks/useLocationSnapshots'
import { createHeaderFact, recordFactChanges } from '@/db/hooks/useKnowledge'
import { createHeaderItem } from '@/db/hooks/useItems'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { placeCastAtScene, recordFates } from '@/db/hooks/useSnapshots'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FocusMode } from './FocusMode'
import { MentionMenu } from './MentionMenu'
import { HEADING_PREFIX, draftBook, sceneRegion, type DraftChapter } from '@/lib/draftDocument'
import {
  draftState, draftSegments, enterOnHeading, headingsField, refused, joined, lineTyped, settled, typedHeading, joinedProse, insertedHeadingLines,
  lineToHeading, clearLine, joinSpec, stepScene, openSceneLine, abandonedLine, focusScene, sceneBeside, mentionAt, placeInBook,
  toProse, headerLineOf, firstLineOf, pastedHeaderScene, pastedAtEnd, headerOf, openBlockOf, headerScenes, showHeader, hideHeader, headerSyncSpec, joinedHeaderSpec,
  type Refusal, type Join, type Typed,
} from '@/lib/draftEditor'
import {
  storedValues, shownValues, planSync, bookToShow, pendingWrites, afterWrite, sameText, sameShape, type Held,
} from '@/lib/draftSync'
import { splitProse } from '@/lib/sceneStructure'
import { generateId } from '@/lib/id'
import { mentionInsert, punctuate } from '@/lib/mentionInsert'

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

/** Said when Tab is pressed on the page: see `keepTab`. */
const TAB_STAYS = 'Tab stays in the page: a new paragraph starts after a blank line. To leave the page from the keyboard, press Escape, then Tab.'

const REFUSALS: Record<Refusal, string> = {
  'heading': 'A heading changes whole: delete its # marks to join it to the one before, its title kept as a line, or its entire line to join it without.',
  'first-chapter': 'This is the first chapter, so there is no chapter before it to join.',
  'first-scene': 'This is the first scene of its chapter, so there is no scene before it to join.',
  'two-headings': 'Join one at a time.',
  'title-break': 'A title is one line. Enter at the end of a title goes to its prose.',
  'chapter-text': 'Under a chapter heading only a heading can go: ## and a title starts its first scene, # and a title a new chapter.',
  'before-first': 'The book starts at its first chapter heading.',
  'above-header': 'The line under a scene’s title says where it is and who is there, and stays first: write the scene below it.',
  'no-scene-before': 'The chapter before has no scene to keep this title in. Delete the heading’s entire line to join it without its title.',
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
        // The header, every line of a block, tinted as in a card's draft: which part is the book is not a guess.
        const header = headerLineOf(view.state, i)
        if (header) {
          // First and last lines marked, so a block is one tinted band rather than a stripe per line.
          const last = view.state.doc.lineAt(header.to).from
          for (let at = header.from; at <= header.to;) {
            const line = view.state.doc.lineAt(at)
            const edge = `${line.from === header.from ? ' cm-draft-header-start' : ''}${line.from === last ? ' cm-draft-header-end' : ''}`
            b.add(line.from, line.from, Decoration.line({ class: `cm-draft-header${edge}` }))
            at = line.to + 1
          }
        }
      })
    }
    return b.finish()
  }
}, { decorations: (v) => v.decorations })

/** What a chapter heading's timeline chip shows and changes, on *All timelines*. */
interface ChipInfo {
  timelines: readonly { id: string; name: string; color: string }[]
  chapters: ReadonlyMap<string, { timelineId: string; title: string }>
  onChange: (chapterId: string, timelineId: string) => void
}

/**
 * The timeline a chapter belongs to, after its heading, as a small menu: on
 * *All timelines* every timeline's chapters are on one page, and which story a
 * chapter is part of is not something the writer should have to remember.
 * Changing it gives the chapter, and its scenes, to the timeline picked.
 */
class TimelineChip extends WidgetType {
  readonly chapterId: string
  readonly info: ChipInfo
  constructor(chapterId: string, info: ChipInfo) {
    super()
    this.chapterId = chapterId
    this.info = info
  }
  private get key() {
    const c = this.info.chapters.get(this.chapterId)
    return `${this.chapterId}|${c?.timelineId}|${c?.title}|${this.info.timelines.map((t) => `${t.id}:${t.name}:${t.color}`).join(',')}`
  }
  eq(other: TimelineChip) { return other.key === this.key }
  toDOM() {
    const c = this.info.chapters.get(this.chapterId)
    const wrap = document.createElement('span')
    wrap.className = 'cm-draft-timeline'
    wrap.contentEditable = 'false'
    const dot = document.createElement('span')
    dot.className = 'cm-draft-timeline-dot'
    dot.style.backgroundColor = this.info.timelines.find((t) => t.id === c?.timelineId)?.color ?? 'transparent'
    dot.setAttribute('aria-hidden', 'true')
    const select = document.createElement('select')
    select.setAttribute('aria-label', `Timeline of “${c?.title ?? ''}”`)
    for (const t of this.info.timelines) {
      const option = document.createElement('option')
      option.value = t.id
      option.textContent = t.name
      option.selected = t.id === c?.timelineId
      select.append(option)
    }
    select.addEventListener('change', () => this.info.onChange(this.chapterId, select.value))
    wrap.append(dot, select)
    return wrap
  }
  // The menu's own clicks and keys: the editor does not take them for the text.
  ignoreEvent() { return true }
}

function timelineChips(info: ChipInfo) {
  const build = (view: EditorView) => Decoration.set(view.state.field(headingsField)
    .filter((h) => h.kind === 'chapter' && info.chapters.has(h.id))
    .map((h) => Decoration.widget({ widget: new TimelineChip(h.id, info), side: 1 }).range(view.state.doc.lineAt(h.pos).to)), true)
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = build(view) }
    update(u: ViewUpdate) { if (u.docChanged) this.decorations = build(u.view) }
  }, { decorations: (v) => v.decorations })
}

/**
 * Text typed over a selection that began on a heading's `#` came out muted and
 * light until a reload (writer run 6, F6): Chromium gives the typed text the
 * look of what it replaced, as an inline style on the line, and the editor keeps
 * a line whose text is right. Nothing in the page sets a style on a line or
 * inside one, so any there is the browser's, and goes.
 */
function dropCarriedStyles(view: EditorView) {
  for (const el of view.contentDOM.querySelectorAll<HTMLElement>('.cm-line[style], .cm-line [style]')) el.removeAttribute('style')
}

const theme = EditorView.theme({
  '&': { height: '100%', color: 'hsl(var(--foreground))', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-prose)', fontSize: '1.125rem', lineHeight: '1.8', overflow: 'auto' },
  '.cm-content': { maxWidth: '42rem', margin: '0 auto', padding: '1.5rem 1.5rem 40vh', caretColor: 'hsl(var(--foreground))' },
  '.cm-draft-chapter': { fontSize: '1.45em', fontWeight: '600', paddingTop: '1.2em' },
  '.cm-draft-scene': { fontSize: '1.15em', fontWeight: '600', paddingTop: '0.6em' },
  '.cm-draft-marks': { color: 'hsl(var(--muted-foreground))', fontWeight: '400' },
  '.cm-draft-timeline': {
    display: 'inline-flex', alignItems: 'center', gap: '0.3em', marginLeft: '0.6em', verticalAlign: 'middle',
    fontFamily: 'var(--font-body)', fontSize: '0.55em', fontWeight: '400',
  },
  '.cm-draft-timeline-dot': { width: '0.6em', height: '0.6em', borderRadius: '9999px', flexShrink: '0' },
  '.cm-draft-timeline select': {
    color: 'hsl(var(--muted-foreground))', backgroundColor: 'transparent', border: '1px solid hsl(var(--border))',
    borderRadius: '9999px', padding: '0.1em 0.5em', cursor: 'pointer',
  },
  '.cm-draft-header': { backgroundColor: 'hsl(var(--primary) / 0.14)', fontFamily: 'var(--font-body)', fontSize: '0.85em' },
  '.cm-draft-header-start': { borderTopLeftRadius: '4px', borderTopRightRadius: '4px' },
  '.cm-draft-header-end': { borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' },
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

/** A selection that only moved, to the very start of the book, from somewhere else: the browser's doing on focus, not the writer's. */
function arrivedAtStart(u: ViewUpdate, was: EditorSelection): boolean {
  return u.selectionSet && !u.docChanged && u.state.selection.main.empty && u.state.selection.main.head === 0 && !was.eq(u.state.selection)
}

export default function DraftBook({ worldId, timelineId, target, open = null, onPlace, focusSlot = null }: {
  worldId: string
  timelineId: string
  target: PageTarget | null
  /** The chapter open around the page, if one is. */
  open?: string | null
  /** The writer's caret has gone into a chapter other than `open`, or into another scene: the page around it follows. */
  onPlace?: (place: PagePlace) => void
  /**
   * Where the Focus button goes, if not in the page's own row: on a phone, the
   * header's, so the page does not spend a row of its height on one button.
   */
  focusSlot?: HTMLElement | null
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
  /*
    On *All timelines* (`whole`), every timeline's chapters, in the book's
    order: one page for a braided book, which run 10's writer reached by
    switching tabs every chapter, 21 times.
  */
  const whole = timelineId === ALL_TIMELINES
  const chapters = useLiveQuery(
    () => (whole ? db.chapters.where('worldId').equals(worldId) : db.chapters.where('timelineId').equals(timelineId)).toArray(),
    [whole, worldId, timelineId],
  )
  const events = useLiveQuery(
    () => (whole ? db.events.where('worldId').equals(worldId) : db.events.where('timelineId').equals(timelineId)).toArray(),
    [whole, worldId, timelineId],
  )
  const timelines = useTimelines(worldId)
  const texts = useLiveQuery(() => db.sceneTexts.where('worldId').equals(worldId).toArray(), [worldId])
  const characters = useCharacters(worldId)
  const markers = useAllLocationMarkers(worldId)
  const mapLayers = useMapLayers(worldId)
  /** A place as the header writes it: with its map's name where another place shares its name (`placeLabel`). */
  const labelOf = useCallback((id: string | null) => {
    const m = id ? markers.find((x) => x.id === id) : undefined
    return m ? placeLabel(m, markers, mapLayers) : null
  }, [markers, mapLayers])
  const items = useItems(worldId)
  // For what a header draws beyond place and cast: who dies or comes back at a scene, and what changes hands there.
  const snapshots = useLiveQuery(() => db.characterSnapshots.where('worldId').equals(worldId).toArray(), [worldId])
  const placements = useLiveQuery(() => db.itemPlacements.where('worldId').equals(worldId).toArray(), [worldId])
  const itemStates = useLiveQuery(() => db.itemSnapshots.where('worldId').equals(worldId).toArray(), [worldId])
  const placeStates = useLiveQuery(() => db.locationSnapshots.where('worldId').equals(worldId).toArray(), [worldId])
  const facts = useLiveQuery(() => db.knowledgeFacts.where('worldId').equals(worldId).toArray(), [worldId])
  const reveals = useLiveQuery(() => db.knowledgeReveals.where('worldId').equals(worldId).toArray(), [worldId])
  const relationships = useLiveQuery(() => db.relationships.where('worldId').equals(worldId).toArray(), [worldId])
  const relationStates = useLiveQuery(() => db.relationshipSnapshots.where('worldId').equals(worldId).toArray(), [worldId])
  // For the `When:` line: dates on the book's own calendar, and pins counted from the timeline's start.
  const calendar = useWorld(worldId)?.calendar ?? null
  // Each scene's own timeline's start: on *All timelines* they are not all the same.
  const offsetOf = useCallback((id: string) => timelines.find((t) => t.id === id)?.dayOffset ?? 0, [timelines])
  /*
    Each scene's header line, drawn from its records as a scene card draws it:
    never stored, so a change made anywhere — the cast panel, the setting, `@@`
    — reaches the page, and the page's line is only ever a view of the records.
  */
  /** Header lines kept as typed on an earlier visit, for naming something unknown: see `keptHeaderLines`. */
  const [remembered, setRemembered] = useState<Record<string, KeptLine>>(() => keptLines())
  // A change here is measured against the state before it in this scene's era (`recordBeforeIn`).
  const story = useStory(worldId)
  const before = useMemo(() => recordBeforeIn(story), [story])
  const rendered = useMemo(() => new Map((events ?? []).map((e) => {
    const nameOf = (id: string) => characters.find((c) => c.id === id)?.name
    const fates = sceneFates(e.id, e.involvedCharacterIds, snapshots ?? [], e.mentionedCharacterIds, before)
    const names = (ids: string[]) => ids.map(nameOf).filter((n): n is string => !!n)
    const drawnItems = sceneItems(e.id, e.involvedItemIds ?? [], snapshots ?? [], placements ?? [], itemStates ?? [], before)
    const placeStatus = scenePlaceStatus(e.id, e.locationMarkerId, placeStates ?? [], before)
    return [e.id, remembered[e.id]?.line ?? formatSceneHeader({
      place: labelOf(e.locationMarkerId),
      ...(placeStatus ? { placeStatus } : {}),
      // Those on the phone are on the line too, marked `:phone`.
      characters: names([...e.involvedCharacterIds, ...(e.remoteCharacterIds ?? []), ...fates.elsewhere]),
      remote: names(e.remoteCharacterIds ?? []),
      // Who dies away from the scene, which tells of it: on the line too, marked `:dead elsewhere`.
      elsewhere: names(fates.elsewhere),
      dead: names(fates.dead),
      alive: names(fates.alive),
      ...headerNames(sceneNames(e.id, characters), e.involvedCharacterIds, nameOf),
      items: headerItems(drawnItems, {
        item: (id) => items.find((i) => i.id === id)?.name,
        character: nameOf,
        place: (id) => labelOf(id) ?? undefined,
      }),
      facts: headerFacts(sceneFacts(e.id, reveals ?? [], facts ?? []), {
        fact: (id) => facts?.find((f) => f.id === id)?.title,
        character: nameOf,
      }),
      relations: headerRelations(sceneRelations(e.id, relationships ?? [], relationStates ?? []), relationships ?? [], nameOf),
      when: formatWhen({ travelDays: e.travelDays ?? null, inWorldTime: e.inWorldTime ?? null, calendar, offset: offsetOf(e.timelineId) }),
    })]
  })), [events, characters, labelOf, remembered, snapshots, placements, itemStates, placeStates, items, facts, reveals, relationships, relationStates, calendar, offsetOf, before])
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const book = useMemo(
    () => draftBook(chapters, events, texts, (e) => rendered.get(e.id) ?? '', whole ? (cs) => inBookChapterOrder(cs, timelines) : undefined),
    [chapters, events, texts, rendered, whole, timelines],
  )

  const bookRef = useRef(book)
  bookRef.current = book

  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const baseRef = useRef<Map<string, Held>>(new Map())
  const inFlight = useRef(new Set<string>())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoHistory = useRef(new Compartment())
  /** The chapter headings' timeline chips: there on *All timelines* only. */
  const chipSlot = useRef(new Compartment())
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
  const candidates = useMemo<MentionCandidate[]>(() => [
    ...characters.map((c) => ({ id: c.id, kind: 'character' as const, name: c.name, aliases: proseAliases(c) })),
    ...items.map((i) => ({ id: i.id, kind: 'item' as const, name: i.name })),
    ...markers.map((m) => ({ id: m.id, kind: 'location' as const, name: m.name })),
  ], [characters, items, markers])
  // Read from the editor's keys and updates, which are made once.
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates
  const placesRef = useRef({ markers, mapLayers })
  placesRef.current = { markers, mapLayers }
  const itemsRef = useRef(items)
  itemsRef.current = items
  const castRef = useRef(characters)
  /** Where the space after a name just picked is, while the writer has not moved on from it. */
  const autoSpaceRef = useRef<number | null>(null)
  /** The selection the page had when focus arrived other than by a pointer: see `arrivedAtStart`. */
  const arrivedRef = useRef<EditorSelection | null>(null)
  castRef.current = characters
  /** Scenes whose header line names somebody this world has not got: kept as typed, so the spelling can be fixed. */
  const keptHeaders = useRef(new Set<string>(Object.keys(remembered)))
  /**
   * Scenes whose header line has just been applied, with each one's line as the
   * records drew it then: until the records change, the page's line is newer
   * than theirs, and bringing it into step would take back what was typed.
   */
  const settling = useRef(new Map<string, { was: string; at: number }>())
  const applying = useRef(new Map<string, Promise<void>>())
  /**
   * The header block the caret is in, and the line it is on. A block's last
   * line is still the block, so going down off a line of it lands in it, and
   * the page waits; once the caret is out — however it left — the page catches
   * up with the records.
   */
  const caretIn = useRef<{ line: number; header: string | null }>({ line: -1, header: null })
  const [headerWarning, setHeaderWarning] = useState<{ sceneId: string; unknown: KeptLine['unknown'] } | null>(null)
  /** Whoever the picker has made, each asked for the other names they go by: see `NewCharacterNames`. */
  const [newCharacters, setNewCharacters] = usePendingNames(`world:${worldId}`)
  /** The place the warning is about, when it is about one: what its *Create* button makes, and for which scene. */
  const [headerPlace, setHeaderPlace] = useState<{ sceneId: string; name: string; names: string[] } | null>(null)
  type PageMention = NonNullable<ReturnType<typeof mentionAt>>
  const [mention, setMention] = useState<PageMention | null>(null)
  const mentionRef = useRef<PageMention | null>(null)
  const [highlight, setHighlight] = useState(0)
  const highlightRef = useRef(0)

  /**
   * Whether something typed has not been written yet. The page said nothing
   * about it — the word count was the only thing that moved — so a writer had no
   * way to know the last second of typing was still only on screen.
   */
  const [unsaved, setUnsaved] = useState(false)

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
    // Saved, unless more was typed while it was being written: that has its own timer.
    if (!saveTimer.current) {
      setUnsaved(false)
      // Written after all, so nothing is owed for the next start to write.
      if (readUnsaved()?.worldId === worldId) stashUnsaved({ worldId, scenes: {}, sceneTitles: {}, chapterTitles: {} })
    }
  }
  const saveRef = useRef(save)
  saveRef.current = save

  /** Something on the page is not in the store yet: saved after a pause, or when the page is left. */
  function oweSave() {
    setUnsaved(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_MS)
  }

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
      revisitLeft()
    }
    // The store has shown the act by the time it returns in every split and join
    // the page spec made when this was written (14 of 14, measured); this waits
    // in case it has not, and stops waiting in the end.
    const current = bookRef.current
    if (!acted || (current && done(current))) { mine.finish(); return }
    setTimeout(mine.finish, 3000)
  }

  /**
    Lines the writer left while a split or join was still being written. Leaving
    a line is when a heading typed on it is made, or a mark that never became
    one is taken away; while the page is busy neither can happen, and nothing
    came back for them — a `#` left under a new chapter's heading stayed there,
    and a `## Title` typed under it stayed a line of text. So they are kept,
    mapped through what is typed meanwhile, and looked at once the page is free.
  */
  const leftWhileBusy = useRef<number[]>([])
  /** What the headings of a paste have made so far, said once they all have: see the paste in the update listener. */
  const pasteMade = useRef<{ scenes: number; chapters: number; atEnd: boolean } | null>(null)
  function revisitLeft() {
    const view = viewRef.current
    if (!view || busy.current) return
    if (leftWhileBusy.current.length === 0) {
      if (pasteMade.current) void applyPastedHeaders()
      sayPasteMade()
      return
    }
    const caretLine = view.state.doc.lineAt(view.state.selection.main.head).from
    // From the bottom up, so taking a line away leaves the positions above it where they were.
    const lines = [...new Set(leftWhileBusy.current.filter((at) => at <= view.state.doc.length).map((at) => view.state.doc.lineAt(at).from))]
      .sort((a, b) => b - a)
    leftWhileBusy.current = []
    for (let k = 0; k < lines.length; k++) {
      if (lines[k] === caretLine) continue
      const typed = typedHeading(view.state, lines[k])
      if (!typed) continue
      if (typed.kind === 'stray') { make(typed, lines[k], false); continue }
      // A heading is an act of its own, and the page is busy again until it is written: the rest wait for that.
      leftWhileBusy.current = lines.slice(k + 1)
      if (pasteMade.current) pasteMade.current[typed.kind === 'chapter' ? 'chapters' : 'scenes']++
      make(typed, lines[k], false, { pasted: !!pasteMade.current, atEnd: pasteMade.current?.atEnd })
      return
    }
    if (pasteMade.current) void applyPastedHeaders()
    sayPasteMade()
  }

  /*
    A pasted scene's header — the `[ … ]` line, or the block, under its `## ` —
    is read once every heading of the paste is made, as leaving it would read
    it: one at a time, since each is its own write. Before writer run 9 it
    stayed a line of prose under a header carried from the scene the paste
    landed in, and all 27 of that book's scenes had to be put right by hand.
  */
  const pastedScenes = useRef<string[]>([])
  async function applyPastedHeaders() {
    /*
      In the order of the page, not the order they were made, which is from the
      bottom up. Each header is planned against what is recorded when it is
      read: read bottom-up, a later scene's hand-off was undone by an earlier
      one's, and the item ended in two hands (writer run 11).
    */
    const order = new Map((viewRef.current?.state.field(headingsField) ?? []).map((h, i) => [h.id, i]))
    const ids = [...pastedScenes.current].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    pastedScenes.current = []
    const waiting: string[] = []
    for (const id of ids) {
      const view = viewRef.current
      if (!view) return
      const headings = view.state.field(headingsField)
      const i = headings.findIndex((h) => h.id === id)
      if (i < 0 || !sceneRegion(view.state.doc, headings, i, new Set([id])).header) continue
      await applyHeader(id)
      if (keptHeaders.current.has(id)) waiting.push((await db.events.get(id))?.title || 'Untitled scene')
    }
    // Beside what the paste made, as the note under it is: see `keptByPaste`.
    const more = keptByPaste(waiting)
    if (more) setNotice((n) => (n ? `${n} ${more}` : more))
  }

  /*
    Each heading a paste made is a step of its own for Undo, as it would be
    typed, so a paste of ten scenes takes ten Undos to take back. Said, once
    the last is made, rather than found out.
  */
  function sayPasteMade() {
    const made = pasteMade.current
    if (!made) return
    pasteMade.current = null
    const parts = [
      ...(made.scenes ? [`${made.scenes} ${made.scenes === 1 ? 'scene' : 'scenes'}`] : []),
      ...(made.chapters ? [`${made.chapters} ${made.chapters === 1 ? 'chapter' : 'chapters'}`] : []),
    ]
    if (parts.length === 0) return
    const many = made.scenes + made.chapters > 1
    setNotice(`The pasted headings made ${parts.join(' and ')}.${many ? ' Undo takes them back one at a time.' : ''}`)
  }

  /** Put the caret where the writer goes on under heading `id`. */
  function caretUnder(view: EditorView, id: string) {
    const headings = view.state.field(headingsField)
    const i = headings.findIndex((h) => h.id === id)
    if (i < 0) return
    view.dispatch({ ...toProse(view.state, i), scrollIntoView: true, userEvent: 'select' })
  }

  /** Make what a typed heading asks for: see `typedHeading`. */
  function make(typed: Typed, at: number, caretAfter: boolean, opts: { pasted?: boolean; atEnd?: boolean } = {}) {
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
      /*
        What will be under the heading is the new scene's from the start, and
        written with it. Settled as '', the page then saved that prose as an
        ordinary edit, the store never showed the act as the page expected,
        and every scene a paste made under an empty chapter waited out the
        three seconds below. A reload in that time lost what was still above
        them: the first scene and its prose, writer run 11's W-1.
      */
      const text = shownValues(draftSegments(view.state.update(spec).state)).get(id)?.text ?? ''
      settle.set(id, { kind: 'scene', title: typed.title, text })
      act = async () => {
        if (!(await createEventAt(typed.chapterId, 0, typed.title, { id }))) return false
        if (text) await setSceneText(worldId, id, text)
        return true
      }
      goTo = id
      if (opts.pasted) pastedScenes.current.push(id)
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
        // Pasted, what follows the heading is new writing, not the rest of the scene it landed in: it carries nothing from it.
        act = async () => !!(await splitScene(typed.cut.sceneId, typed.cut.at, typed.title, { id, carry: !opts.pasted }))
        goTo = id
        if (opts.pasted) pastedScenes.current.push(id)
      } else {
        const rest = cut?.tail ? { id: generateId(), title: cut.sceneTitle } : undefined
        spec = lineToHeading(view.state, at, { id, kind: 'chapter' }, rest)
        settle.set(id, { kind: 'chapter', title: typed.title, text: '' })
        if (rest) settle.set(rest.id, { kind: 'scene', title: rest.title, text: tail })
        act = async () => !!(await startChapter({
          chapterId: typed.chapterId, afterSceneId: cut?.sceneId ?? null, title: typed.title, id,
          split: rest && cut ? { at: cut.at, id: rest.id } : undefined,
          // Pasted, the scenes after the heading are the paste's own, made first: whether it ends the timeline is the paste's to say.
          ...(opts.pasted ? { atTimelineEnd: !!opts.atEnd } : {}),
          // On All timelines it goes after the chapter it was typed in, whichever timeline comes next.
          ...(whole ? { inBook: true } : {}),
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
    // Joined by taking its ## away: its title stays, as a line — with one paragraph break under it, not the gap its header line left.
    if (j.title) {
      const tidy = joinSpec(view.state, view.state.doc.lineAt(seam).to)
      if (tidy) view.dispatch(tidy)
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
      /*
        Joined by taking its # away: its title is the last line of the chapter
        before's last scene — written by the join, so its undo takes it back,
        and owed as it was before it.
      */
      const headings = before.field(headingsField)
      const last = j.title ? headings[headings.findIndex((h) => h.id === j.id) - 1] : undefined
      const held = last && was.get(last.id)
      if (last && held) {
        const text = joinedProse(view.state, last.id, seam)
        owed.set(last.id, held)
        settle.set(last.id, { ...held, text })
        act = () => joinChapterToPrevious(j.id, { prose: { eventId: last.id, text }, inBook: whole })
      } else {
        act = () => joinChapterToPrevious(j.id, { inBook: whole })
      }
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
    /*
      Nor a scene whose header is being applied: what is on its line is what
      the apply is reading, and the records it is about may not be written yet.
      Records arriving meanwhile from something else — the person just made
      from the picker on that line — drew the line over from them, and a place
      typed on it went before it could be kept, so creating that place from the
      note set nothing — the headerPickerRun4 spec failed so under load, six
      times in eight. With `headerSyncSpec`'s own guard, it held 32 in 32.
    */
    for (const id of applying.current.keys()) skip.add(id)
    for (const [id, { was, at }] of settling.current) {
      if ((renderedRef.current.get(id) ?? '') === was && Date.now() - at < 3000) skip.add(id)
      else settling.current.delete(id)
    }
    const at = view.state.doc.lineAt(view.state.selection.main.head).from
    // The caret's own block too, while a line of it is mid-word and it does not read as a header: see `openBlockOf`.
    const here = firstLineOf(view.state, at) ?? headerOf(view.state, at) ?? openBlockOf(view.state, at)
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
  function applyHeader(id: string): Promise<void> {
    const view = viewRef.current
    if (!view || busy.current) return Promise.resolve()
    const headings = view.state.field(headingsField)
    const i = headings.findIndex((h) => h.id === id)
    if (i < 0) return Promise.resolve()
    const { header } = sceneRegion(view.state.doc, headings, i, new Set([id]))
    if (!header) { forgetKept(id); syncHeaders(); return Promise.resolve() }
    if (!view.state.field(headerScenes).has(id)) {
      view.dispatch({ effects: showHeader.of(id) })
      /*
        The block is the header now, not the scene's first lines of prose — and
        the page's text did not change, so nothing else says there is something
        to save. Owed like typing: before writer run 10, a page left a few
        seconds after a paste kept the block in the scene's stored text, and
        the header showed twice on the next visit, the copy going into the export.
      */
      oweSave()
    }
    // Before anything is awaited: the page catches up with the records straight after this starts.
    settling.current.set(id, { was: renderedRef.current.get(id) ?? '', at: Date.now() })
    /*
      One at a time for a scene, each with the line as it was when it was left:
      leaving a line can start a second apply while the first is still writing,
      and two that each found somebody unrecorded here would each record them —
      two states for one person at one scene.
    */
    const before = applying.current.get(id) ?? Promise.resolve()
    const next: Promise<void> = before.then(() => applyHeaderNow(id, header, () => applying.current.get(id) !== next))
    applying.current.set(id, next)
    // Applied: the page catches up with the records it skipped meanwhile.
    void next.finally(() => {
      if (applying.current.get(id) === next) { applying.current.delete(id); syncHeaders() }
      // After the page has caught up: redrawing a header is a change to the page, and a change clears the notice.
      if (owedNotice.current) { setNotice(owedNotice.current); owedNotice.current = null }
    })
    return next
  }
  /** A notice an apply has to give once the page has caught up with it: see `applyHeader`. */
  const owedNotice = useRef<string | null>(null)
  /** `queued`: another apply of this scene is waiting, with a newer line — this one does not hand the line back. */
  async function applyHeaderNow(id: string, header: string, queued: () => boolean) {
    const event = await db.events.get(id)
    if (!event) { if (!queued()) settling.current.delete(id); return }
    // The fates the header draws now, from the store rather than the page's copy: what taking one off is measured against.
    const states = await db.characterSnapshots.where('worldId').equals(worldId).toArray()
    const before = recordBeforeIn(await loadStory(worldId))
    const drawn = sceneFates(id, event.involvedCharacterIds, states, event.mentionedCharacterIds, before)
    const drawnItems = sceneItems(id, event.involvedItemIds ?? [], states, await db.itemPlacements.where('eventId').equals(id).toArray(), await db.itemSnapshots.where('worldId').equals(worldId).toArray(), before)
    const factList = await db.knowledgeFacts.where('worldId').equals(worldId).toArray()
    const drawnFacts = sceneFacts(id, await db.knowledgeReveals.where('eventId').equals(id).toArray(), factList)
    const relList = await db.relationships.where('worldId').equals(worldId).toArray()
    const drawnRelations = sceneRelations(id, relList, await db.relationshipSnapshots.where('eventId').equals(id).toArray())
    // The people from the store, not the page's copy: who is revealed as whom is what a reveal is checked against.
    const people = await db.characters.where('worldId').equals(worldId).toArray()
    // The items from the store, as the facts are: the page's copy may not have caught up with one just made from the note.
    const worldItems = await db.items.where('worldId').equals(worldId).toArray()
    // And the places: one just made from the note is not in the page's copy yet.
    const worldPlaces = await db.locationMarkers.where('worldId').equals(worldId).toArray()
    const worldMaps = await db.mapLayers.where('worldId').equals(worldId).toArray()
    const plan = planHeader(header, { characters: people, places: worldPlaces, maps: worldMaps, items: worldItems, facts: factList, relationships: relList }, {
      involved: event.involvedCharacterIds, mentioned: event.mentionedCharacterIds ?? [], remote: event.remoteCharacterIds ?? [], place: event.locationMarkerId, names: sceneNames(id, people),
      placeStatus: scenePlaceStatus(id, event.locationMarkerId, await db.locationSnapshots.where('worldId').equals(worldId).toArray(), before), ...drawn, items: drawnItems, facts: drawnFacts, relations: drawnRelations,
      time: await loadSceneTime(id),
    })
    if (planIsClean(plan)) forgetKept(id)
    else {
      keptHeaders.current.add(id)
      keepLine(id, { line: header, unknown: plan.unknown })
      setHeaderWarning({ sceneId: id, unknown: plan.unknown })
      setHeaderPlace(plan.unknown.place ? { sceneId: id, name: plan.unknown.place, names: plan.unknown.names } : null)
    }
    // A change reaches the line through the records; with none, the line is put as the records draw it.
    const itemList = plan.items.involvedItemIds
    if (plan.update || itemList || plan.time) await updateEvent(id, { ...plan.update, ...(itemList ? { involvedItemIds: itemList } : {}), ...plan.time })
    // The header says where and who: the cast is recorded there. Before the fates, so a death here is at the scene's place.
    await placeCastAtScene(worldId, id, plan.update?.involvedCharacterIds ?? event.involvedCharacterIds, plan.update ? plan.update.locationMarkerId : event.locationMarkerId, event.locationMarkerId)
    if (plan.fates.length) await recordFates(worldId, id, plan.fates)
    const itemWrites = plan.items.give.length + plan.items.put.length + plan.items.takeBack.length + plan.items.unput.length + plan.items.condition.length + plan.items.uncondition.length
    if (itemWrites) await recordItemChanges(worldId, id, plan.items)
    const f = plan.facts
    const factWrites = factPlanWrites(f)
    if (factWrites) {
      const { filedAt } = await recordFactChanges(worldId, id, plan.facts)
      if (filedAt) owedNotice.current = knownBeforeNote((await db.events.get(filedAt))?.title)
    }
    const r = plan.relations
    const relationWrites = r.create.length + r.relabel.length + r.state.length + r.unstate.length
    if (relationWrites) await recordRelationshipChanges(worldId, id, plan.relations)
    const statusWrites = plan.placeStatus.set || plan.placeStatus.unset
    if (statusWrites) await recordPlaceStatus(worldId, id, plan.placeStatus)
    const nameWrites = plan.identity.rename.length + plan.identity.unrename.length + plan.identity.reveal.length + plan.identity.unreveal.length
    if (nameWrites) await recordIdentityChanges(id, plan.identity)
    if (!plan.update && !itemList && !plan.time && !plan.fates.length && !itemWrites && !factWrites && !relationWrites && !statusWrites && !nameWrites && !queued()) { settling.current.delete(id); syncHeaders() }
  }
  function forgetKept(id: string) {
    if (keptHeaders.current.delete(id) && keptHeaders.current.size === 0) { setHeaderWarning(null); setHeaderPlace(null) }
    // The note about this scene goes with it, whatever other scene still has a line kept: it went on saying a place just made did not exist.
    setHeaderWarning((w) => (w?.sceneId === id ? null : w))
    setHeaderPlace((p) => (p?.sceneId === id ? null : p))
    forgetLine(id)
    setRemembered((all) => {
      if (!(id in all)) return all
      const { [id]: _gone, ...rest } = all
      return rest
    })
  }

  /*
    A line kept on an earlier visit says so again, as it did when it was typed:
    the warning, and the place it can make. Once, when the book's scenes are in.
  */
  const warnedRemembered = useRef(false)
  useEffect(() => {
    if (warnedRemembered.current || !events) return
    warnedRemembered.current = true
    // Not a line kept only because the tab closed on it: that one has nothing to say until it is left.
    const here = events.find((e) => remembered[e.id] && !planIsClean({ unknown: remembered[e.id].unknown }))
    if (!here) return
    const { unknown } = remembered[here.id]
    setHeaderWarning({ sceneId: here.id, unknown })
    setHeaderPlace(unknown.place ? { sceneId: here.id, name: unknown.place, names: unknown.names } : null)
  }, [events, remembered])

  /** The note's answer for a place name several places answer to: set the scene at the one picked, then read the header again. */
  async function pickHeaderPlace(sceneId: string, placeId: string) {
    await updateEvent(sceneId, { locationMarkerId: placeId })
    await applyHeader(sceneId)
  }
  /** The note's answer for a fact title: make the fact, then read the header again, so what it says of the fact is written. */
  async function makeHeaderFact(sceneId: string, title: string) {
    await createHeaderFact(worldId, title)
    await applyHeader(sceneId)
  }
  /** The same for an item: make it, then read the header again, so the Items line puts it in the scene. */
  async function makeHeaderItem(sceneId: string, name: string) {
    await createHeaderItem(worldId, name)
    await applyHeader(sceneId)
  }
  /** And for somebody a Relationships or Facts line names: make them, then read the header again. */
  async function makeHeaderPerson(sceneId: string, name: string) {
    await createHeaderCharacter(worldId, name)
    await applyHeader(sceneId)
  }

  /**
   * The warning's answer for a place, as on a scene card: make it without a map
   * and set the scene there, then read the header again, as for a fact or an
   * item. Whatever else the line names that the world has not got stays kept
   * and offered; the rest is written. It used to keep only unknown *people*
   * and redraw the line from the records — which dropped every item and fact
   * still waiting for its button, with no trace (writer run 5, W5-1).
   */
  async function makeHeaderPlace({ sceneId, name }: { sceneId: string; name: string }) {
    await createHeaderPlace(sceneId, name)
    setHeaderPlace(null)
    await applyHeader(sceneId)
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
    // In the header line the sigil is its syntax, not a trigger to be consumed: see `mentionInsert`.
    const { insert, caret, autoSpace } = mentionInsert(name, {
      inHeader: m.inHeader,
      before: view.state.sliceDoc(view.state.doc.lineAt(m.start).from, m.start),
      after: view.state.sliceDoc(m.end, view.state.doc.lineAt(m.end).to),
    })
    view.dispatch({ changes: { from: m.start, to: m.end, insert }, selection: { anchor: m.start + caret }, userEvent: 'input.complete' })
    autoSpaceRef.current = autoSpace === null ? null : m.start + autoSpace
    showMention(null)
    void recordMention(m.sceneId, suggestion, m.inHeader ? 'present' : m.intent, placesRef.current)
      .then((made) => { if (made) setNewCharacters((all) => [...all.filter((c) => c.id !== made.id), made]) })
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

  /*
    Tab, with no picker open, stays in the page. It left it: pressed to indent
    a paragraph, it put the caret in the chapter's title, selected, and the
    next sentence became the chapter's name; with the panel shut the sentence
    went nowhere (writer run 11). The way out by keyboard is the editor's own,
    Escape and then Tab, and it is said, since nothing else shows it.
  */
  function keepTab(): boolean {
    setNotice(TAB_STAYS)
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

  /*
    The chips follow the records: a chapter given to another timeline, here or
    anywhere, is redrawn with its new one.
  */
  useEffect(() => {
    const view = viewRef.current
    if (!view || !ready) return
    const info: ChipInfo | null = whole && chapters
      ? {
          timelines: timelines.map((t) => ({ id: t.id, name: t.name, color: t.color })),
          chapters: new Map(chapters.map((c) => [c.id, { timelineId: c.timelineId, title: c.title }])),
          onChange: (chapterId, to) => { void moveChapterToTimeline(chapterId, to) },
        }
      : null
    view.dispatch({ effects: chipSlot.current.reconfigure(info ? timelineChips(info) : []) })
  }, [ready, whole, chapters, timelines])

  /** Alt+T: the chapter the caret is in goes to the next timeline, in tab order — the chip's menu, from the keyboard. */
  const nextTimelineRef = useRef<(view: EditorView) => boolean>(() => false)
  nextTimelineRef.current = (view) => {
    if (!whole || timelines.length < 2) return false
    const place = placeInBook(view.state, view.state.selection.main.head)
    const chapter = place && chapters?.find((c) => c.id === place.chapterId)
    if (!chapter) return false
    const next = timelines[(timelines.findIndex((t) => t.id === chapter.timelineId) + 1) % timelines.length]
    void moveChapterToTimeline(chapter.id, next.id)
    setNotice(`“${chapter.title}” is now ${next.name}’s.`)
    return true
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
      chipSlot.current.of([]),
      Prec.highest(keymap.of([
        ...['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].map((key) => ({ key, run: () => mentionKeyRun(key) })),
        { key: 'Mod-z', run: journal('undo') },
        { key: 'Mod-Shift-z', run: journal('redo') },
        { key: 'Mod-y', run: journal('redo') },
      ])),
      Prec.high(keymap.of([
        { key: 'Enter', run: enterOnHeading },
        { key: 'Tab', run: keepTab, shift: keepTab },
        // The scene keys, as in a scene card's draft: see `sceneShortcut`.
        { key: 'Mod-Alt-ArrowDown', run: stepScene('next') },
        { key: 'Mod-Alt-ArrowUp', run: stepScene('previous') },
        { key: 'Mod-Enter', run: openSceneLine('new') },
        { key: 'Mod-Shift-Enter', run: openSceneLine('split') },
        { key: 'Alt-t', run: (view) => nextTimelineRef.current(view) },
      ])),
      keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      search({ top: true }),
      // A comma straight after a picked name takes the place of the space put after it: see `punctuate`.
      EditorView.inputHandler.of((view, from, to, text) => {
        const space = autoSpaceRef.current
        autoSpaceRef.current = null
        if (space === null || from !== to) return false
        const done = punctuate(view.state.sliceDoc(space, space + 1), 0, from - space, text)
        if (!done) return false
        view.dispatch({ changes: { from: space, to: space + 1, insert: text }, selection: { anchor: space + text.length }, userEvent: 'input.type' })
        return true
      }),
      /*
        S-1: the time cursor jumped to chapter 1. Focused from code — a
        script's `element.focus()`, or assistive technology — with the
        selection outside the page, Chromium puts it at the start of the book.
        CodeMirror undoes that only when the selection arrives within 200ms of
        the focus; on a page busy re-rendering it did not, and the caret went
        to the top of the book, the cursor and the chapter after it, and the
        next keystroke into chapter 1's heading. Focus arriving is not the
        writer moving: the first selection after it that lands at the very
        start, with no pointer or key behind it, is put back.
      */
      EditorView.domEventHandlers({
        focus: (_e, view) => { arrivedRef.current = view.state.selection; return false },
        mousedown: () => { arrivedRef.current = null; return false },
        touchstart: () => { arrivedRef.current = null; return false },
        keydown: () => { arrivedRef.current = null; return false },
        blur: () => { arrivedRef.current = null; return false },
      }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': 'The book, as one page', spellcheck: 'true' }),
      headingStyles,
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) dropCarriedStyles(u.view)
        const arrived = arrivedRef.current
        if (arrived && (u.selectionSet || u.docChanged)) {
          arrivedRef.current = null
          if (arrivedAtStart(u, arrived)) {
            // After this update: a view may not be dispatched to from inside one.
            setTimeout(() => { if (u.view.state.selection.eq(u.state.selection)) u.view.dispatch({ selection: arrived }) })
            return
          }
        }
        if (u.selectionSet || u.docChanged) {
          // The space after a picked name is only that while the writer goes straight on from it.
          if (!u.transactions.some((tr) => tr.isUserEvent('input.complete'))) autoSpaceRef.current = null
          noteCaret(u.state)
          /*
            A picker is opened by typing a token, never by arriving in one: a
            click at the end of `@@Silas Wren` offered it, and the Enter meant
            to start the next line completed the name instead. Moving within
            the token already open keeps it.
          */
          const token = mentionAt(u.state, candidatesRef.current)
          const open = mentionRef.current
          showMention(u.docChanged || (token && open && token.start === open.start) ? token : null)
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
        if (u.selectionSet || u.docChanged) {
          const at = u.state.doc.lineAt(u.state.selection.main.head).from
          if (at !== caretIn.current.line) {
            const header = headerOf(u.state, at)?.id ?? null
            /*
              Only when no line typed on is in play. On one, a block deleted to be
              typed again stays gone until it is left; and one just left is applied
              first, below — drawn from the records before that, what was typed on
              it would be drawn over and lost.
            */
            const typed = u.state.field(lineTyped)
            if (caretIn.current.header && caretIn.current.header !== header && typed.line === null && typed.left === null) queueMicrotask(() => syncHeaders())
            caretIn.current = { line: at, header }
          }
        }
        const effects = u.transactions.flatMap((tr) => tr.effects)
        const why = effects.find((e) => e.is(refused))
        if (why) setNotice(REFUSALS[why.value as Refusal])
        // Typing after a structural undo: there is no redo to go back to.
        if (structural.current === 'redo' && u.transactions.some((tr) => tr.docChanged && typing(tr))) structural.current = null
        // Pasted `## ` and `# ` lines: each made in turn, as if typed and left (`revisitLeft`), from the bottom up.
        const pasted = u.docChanged && u.transactions.some((tr) => tr.isUserEvent('input.paste')) ? insertedHeadingLines(u.state, u.changes) : []
        if (u.docChanged) {
          if (leftWhileBusy.current.length) leftWhileBusy.current = leftWhileBusy.current.map((at) => u.changes.mapPos(at, -1))
          /*
            The writer's edits take a notice away; a page redrawn from the
            records does not — a header line brought into step after Alt+T
            gave a chapter to another timeline took away the notice saying so.
          */
          if (u.transactions.some((tr) => tr.docChanged && tr.annotation(Transaction.addToHistory) !== false)) setNotice(null)
          oweSave()
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
        // Left while a split or join is still being written: looked at again once it is (`revisitLeft`).
        if (from !== null && (busy.current || pasted.length)) leftWhileBusy.current.push(from)
        // A header pasted as a scene's first lines: read with the rest of the paste, as one under a pasted `## ` is.
        const headed = u.docChanged && u.transactions.some((tr) => tr.isUserEvent('input.paste')) ? pastedHeaderScene(u.state, u.changes) : null
        if (headed) pastedScenes.current.push(headed)
        if (pasted.length || headed) {
          leftWhileBusy.current.push(...pasted)
          // Nothing after it on the page but blank lines: the paste ends the timeline, whatever its headings make.
          pasteMade.current ??= { scenes: 0, chapters: 0, atEnd: pastedAtEnd(u.state, u.changes) }
          queueMicrotask(() => revisitLeft())
        }
        const typed = from !== null && !busy.current && !pasted.length ? typedHeading(u.state, from) : null
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
        // A scene's first line, or a line of its header, left: the header applied — or one just typed there, made one.
        const first = from !== null ? firstLineOf(u.state, from) ?? headerOf(u.state, from) : null
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

  /*
    A line the tab was closed on, kept by `keepHeaderBeingTyped`, was left by the
    closing: it is applied now, as leaving it would have. One kept for naming
    something unknown waits for its spelling to be fixed, as it always has.
  */
  const appliedClosed = useRef(false)
  useEffect(() => {
    if (!ready || appliedClosed.current) return
    appliedClosed.current = true
    for (const [id, kept] of Object.entries(remembered)) if (planIsClean(kept)) void applyHeader(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, with the lines remembered when the page opened
  }, [ready])

  // Leaving the page writes what is owed.
  useEffect(() => () => {
    void saveRef.current()
    viewRef.current?.destroy()
    viewRef.current = null
  }, [])

  /*
    And so does leaving the *browser* page — a reload, a closed tab, a laptop
    lid. Unmounting only happens inside the app, so the last second of typing
    before a reload was never written: the save is on a one-second timer. The
    writes start here, while the page is still alive to start them; hiding the
    tab is the same, since a hidden tab is often the last thing a phone does
    before it is killed.
  */
  useEffect(() => {
    const flush = () => {
      keepHeaderBeingTyped()
      if (!saveTimer.current) return
      const view = viewRef.current
      if (view) {
        // Kept synchronously first: the save below is started, but an unloading page may not live to finish it.
        const owed = pendingWrites(baseRef.current, shownValues(draftSegments(view.state)))
        stashUnsaved({
          worldId,
          scenes: Object.fromEntries(owed.flatMap((w) => (w.kind === 'scene' && w.text !== undefined ? [[w.id, w.text]] : []))),
          sceneTitles: Object.fromEntries(owed.flatMap((w) => (w.kind === 'scene' && w.title !== undefined ? [[w.id, w.title]] : []))),
          chapterTitles: Object.fromEntries(owed.flatMap((w) => (w.kind === 'chapter' && w.title !== undefined ? [[w.id, w.title]] : []))),
        })
      }
      void saveRef.current()
    }
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [worldId])

  /*
    The header line the caret is still on, kept as typed if it says something the
    records do not yet: it is applied only on leaving it, and is not prose, so a
    tab closed on it lost it — the token a writer had just typed (writer run 5,
    S3). Kept synchronously, as unsaved prose is, it comes back on the next visit
    as a line kept as typed, and is applied when it is left.
  */
  function keepHeaderBeingTyped() {
    const view = viewRef.current
    if (!view) return
    const at = view.state.doc.lineAt(view.state.selection.main.head).from
    const here = firstLineOf(view.state, at) ?? headerOf(view.state, at)
    if (!here || keptHeaders.current.has(here.id)) return
    const { header } = sceneRegion(view.state.doc, view.state.field(headingsField), here.index, new Set([here.id]))
    if (!header || header === (renderedRef.current.get(here.id) ?? '')) return
    keepLine(here.id, { line: header, unknown: { names: [], place: null } })
  }

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
    view.dispatch({
      ...(headings[i].kind === 'scene' ? toProse(view.state, i) : { selection: { anchor: headings[i].pos } }),
      effects: EditorView.scrollIntoView(headings[i].pos, { y: 'start', yMargin: 16 }),
    })
    if (target.focus) view.focus()
  }, [target, ready])

  const titleOf = (id: string | null) => (id ? events?.find((e) => e.id === id)?.title ?? '' : '')
  const focusEvent = focus ? events?.find((e) => e.id === focus.id) : undefined

  const focusTitle = caretScene ? `Write “${titleOf(caretScene)}” distraction-free` : 'Put the caret in a scene to write it distraction-free'
  const focusButton = focusSlot ? (
    <Button
      size="icon"
      variant="outline"
      className="h-9 w-9 shrink-0 pointer-coarse:h-11 pointer-coarse:w-11"
      aria-label="Focus"
      disabled={!caretScene}
      onClick={() => { if (caretScene) void openFocus(caretScene) }}
      title={focusTitle}
    >
      <Maximize2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  ) : (
    <Button
      size="sm"
      variant="outline"
      className="h-6 gap-1 px-2 text-[11px] pointer-coarse:h-11 pointer-coarse:px-3"
      disabled={!caretScene}
      onClick={() => { if (caretScene) void openFocus(caretScene) }}
      title={focusTitle}
    >
      <Maximize2 className="h-3 w-3" aria-hidden="true" /> Focus
    </Button>
  )

  // What the kept line's scene holds now, from its records: see `keptLineWarning`.
  const warnedScene = headerWarning ? events?.find((e) => e.id === headerWarning.sceneId) : undefined
  const warningText = headerWarning ? keptLineWarning(headerWarning.unknown, {
    cast: (warnedScene?.involvedCharacterIds ?? []).flatMap((id) => characters.find((c) => c.id === id)?.name ?? []),
    place: labelOf(warnedScene?.locationMarkerId ?? null),
  }) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {focusSlot && createPortal(focusButton, focusSlot)}
      <div className={cn('flex items-center gap-3 px-4', focusSlot ? '' : 'py-1')}>
        {/* With the button elsewhere, the row is only as tall as what it has to say. */}
        {/*
          `min-w-0`, and the key hints make way while there is something to say:
          the hints keep their full width, so a notice beside them was squeezed
          to a 50px column nine lines tall at 1280–1440px, pushing the book down.
        */}
        <p role="status" className={cn('min-w-0 flex-1 text-xs text-[hsl(var(--muted-foreground))]', !focusSlot && 'min-h-[1.5rem]', focusSlot && 'py-1 empty:py-0')}>
          {/*
            The notice and the note together: a paste's notice used to stand in
            for the note, Create buttons and all, until the writer typed — so a
            pasted header naming a new place said only what the paste made
            (writer run 11).
          */}
          {[notice, warningText].filter(Boolean).join(' ') || (book && book.length === 0 ? 'No chapters yet — add one to write in.' : '')}
          {headerWarning && headerPlace && (
            <>
              {' '}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
                onClick={() => { void makeHeaderPlace(headerPlace) }}
              >
                Create “{headerPlace.name}” as a place
              </Button>
            </>
          )}
          {/* Several places answer to the Place line's name: setting the scene at one of them settles which. */}
          {(headerWarning ? placeChoices(headerWarning.unknown) : []).map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void pickHeaderPlace(headerWarning!.sceneId, c.id) }}
            >
              Set at “{c.label}”
            </Button>
          ))}
          {/* A fact title nothing answers, offered as a place is: as likely new as misspelt, and made only when asked. */}
          {headerWarning && (headerWarning.unknown.facts ?? []).map((title) => (
            <Button
              key={title}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderFact(headerWarning.sceneId, title) }}
            >
              Create “{title}” as a fact
            </Button>
          ))}
          {/* An item, likewise: the header had no way to make one, and the prose's "@" was the only door. */}
          {headerWarning && (headerWarning.unknown.items ?? []).map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderItem(headerWarning.sceneId, name) }}
            >
              Create “{name}” as an item
            </Button>
          ))}
          {headerWarning && (headerWarning.unknown.people ?? []).map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderPerson(headerWarning.sceneId, name) }}
            >
              Create “{name}” as a character
            </Button>
          ))}
        </p>
        {/* The keys a scene card shows under its draft, for the same reason: keys nobody can see are keys nobody uses. */}
        <span className={cn('hidden text-[10px] text-[hsl(var(--muted-foreground))]', !(notice ?? headerWarning) && 'lg:inline')}>
          @ names someone · @@ says who is here
          {' · '}<kbd className="font-sans">{MOD}{ALT}↓ ↑</kbd> next or previous scene
          {' · '}<kbd className="font-sans">{MOD}Enter</kbd> new scene after
          {' · '}<kbd className="font-sans">{MOD}{SHIFT}Enter</kbd> split here
        </span>
        {/* Everything the header can say, always within reach: the hints beside it give way to a notice, this does not. */}
        {/* Narrow, the row is kept to what it was: the sheet is under the phone's *Book tools* instead. */}
        {!focusSlot && <HeaderCheatSheet className="shrink-0" />}
        {/* Whether the page is written: the one thing a writer about to close the tab needs to know. */}
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]" data-save-state={unsaved ? 'saving' : 'saved'}>
          {unsaved ? 'Saving…' : 'Saved'}
        </span>
        {!focusSlot && focusButton}
      </div>
      {/* Kept across a reload, so only for somebody who still exists. */}
      {newCharacters.some((c) => characters.some((x) => x.id === c.id)) && (
        <div className="flex flex-col gap-1 px-4 pb-1">
          {newCharacters.filter((c) => characters.some((x) => x.id === c.id)).map((c) => (
            <NewCharacterNames key={c.id} character={c} onDone={() => setNewCharacters((all) => all.filter((n) => n.id !== c.id))} />
          ))}
        </div>
      )}
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
          header={focusEvent ? formatSceneHeaderLine({
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
