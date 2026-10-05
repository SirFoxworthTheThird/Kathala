import { useState, useRef, useEffect } from 'react'
import { Trash2, ChevronDown, ChevronUp, Check, X, MapPin, ArrowUp, ArrowDown, Eye, FolderInput, ExternalLink, Merge } from 'lucide-react'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useMotifs } from '@/db/hooks/useMotifs'
import { SceneDraftSection } from './SceneDraftSection'
import { EventCardBadges } from './EventCardBadges'
import { MoveSceneDialog } from './MoveSceneDialog'
import {
  SettingField, TagsField, CastField, MentionsField, ThreadsField, MotifsField, ItemsField,
  PovField, TimeField, FlashbackField, BeatField, TensionField, StatusField,
} from './SceneFields'
import type { WorldEvent, EventStatus, WorldCalendar } from '@/types'
import { nextTension, parseInWorldDay, parseTravelDays } from '@/lib/sceneFields'
import { deleteEvent, updateEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Menu, MenuItem } from '@/components/ui/menu'
import { useGate } from '@/db/hooks/ReadingGateContext'
import type { SceneShortcut } from '@/lib/sceneStep'
import { useReadAhead } from '@/components/useReadAhead'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

interface EventCardProps {
  event: WorldEvent
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  /**
   * Said instead of "Move earlier"/"Move later" when the move leaves the
   * chapter, so a scene does not silently jump somewhere else (**F12**).
   */
  moveUpHint?: string
  moveDownHint?: string
  /** Derived in-world day (cumulative travel days along narrative order). */
  inWorldDay?: number
  /** The world's calendar, when it has one (CD-3) — the day chip becomes a date. */
  calendar?: WorldCalendar | null
  /**
   * Changes each time the binder sends the writer to this scene: the card opens
   * and scrolls to the top of its column. A counter rather than a flag, so going
   * to the same scene twice still arrives.
   */
  revealNonce?: number
  /** This scene's chapter number, for the read-ahead guard on *View from here*. */
  chapterNumber?: number
  /**
   * The whole book's bulk selection: a checkbox beside the card, and
   * shift-click selecting the run between it and the last one ticked. The
   * chapter's scene ids, in order, are what a run is taken from.
   */
  selection?: { chapterEventIds: string[] }
  /** Offered where the card is not already on its chapter's page. */
  onOpenChapter?: () => void
  /**
   * Where the caret goes when the card opens for a reveal: the Timeline asks
   * for it when the writer arrived by key, so they are straight back in prose.
   */
  revealCaret?: 'start' | 'end'
  /**
   * Go to the next or previous scene. Returns whether there was one; the card
   * closes behind the writer only if so, so the last scene of the book stays
   * open under the caret.
   */
  onStep?: (dir: 'next' | 'previous', opts?: { focus?: boolean }) => boolean
  /** Arrived from Focus mode: open the draft in Focus mode too. */
  revealFocus?: boolean
  /** From Focus mode: make a new scene after this one, or split it, titled there. */
  onMakeFromFocus?: (kind: 'new' | 'split', title: string, at: number) => void
  /** Start a new scene after this one. Absent where one cannot be made here. */
  onNewAfter?: () => void
  /** Split this scene at `at`, an offset into its prose. Absent where it cannot be split here. */
  onSplit?: (at: number) => void
  /** Join the next scene in the chapter onto this one. Absent at a chapter's last scene. */
  onJoinNext?: () => void
  /** The next scene's title, for the join's confirmation to name it. */
  nextTitle?: string
}

export function EventCard({
  event, isFirst, isLast, onMoveUp, onMoveDown, moveUpHint, moveDownHint, inWorldDay, calendar, revealNonce,
  chapterNumber, selection, onOpenChapter, revealCaret, onStep, onNewAfter, onSplit, onJoinNext, nextTitle,
  revealFocus, onMakeFromFocus,
}: EventCardProps) {
  const gate = useGate()
  const activeEventId = useAppStore((st) => st.activeEventId)
  const setActiveEventId = useAppStore((st) => st.setActiveEventId)
  const selectedEventIds = useAppStore((st) => st.selectedEventIds)
  const toggleEventSelected = useAppStore((st) => st.toggleEventSelected)
  const selectEventRange = useAppStore((st) => st.selectEventRange)
  const lastSelectedEventId = useAppStore((st) => st.lastSelectedEventId)
  const setLastSelectedEventId = useAppStore((st) => st.setLastSelectedEventId)
  const { guardJump, readAheadDialog } = useReadAhead()
  const isHere = activeEventId === event.id
  const selectable = selection !== undefined && !gate.active
  const isSelected = selectable && selectedEventIds.has(event.id)
  /** Names the card's icon buttons, which are otherwise identical across scenes. */
  const eventName = event.title ? `“${event.title}”` : 'this untitled scene'
  const [expanded, setExpanded] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [draftFocus, setDraftFocus] = useState<{ nonce: number; at: 'start' | 'end' } | null>(null)
  const [focusModeNonce, setFocusModeNonce] = useState<number | null>(null)
  useEffect(() => {
    if (!revealNonce) return
    setExpanded(true)
    if (revealCaret) setDraftFocus({ nonce: revealNonce, at: revealCaret })
    if (revealFocus) setFocusModeNonce(revealNonce)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    cardRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }, [revealNonce])  // eslint-disable-line react-hooks/exhaustive-deps

  // Spent once the card closes, so opening it again by hand does not pull the
  // caret into the draft as if the writer had arrived by key. On a close, not
  // on "is closed": a card that mounts with a reveal is closed for the one
  // render before it opens, and clearing then would drop the request it came with.
  const wasExpanded = useRef(expanded)
  useEffect(() => {
    if (wasExpanded.current && !expanded) setDraftFocus(null)
    wasExpanded.current = expanded
  }, [expanded])

  const onShortcut = onStep || onNewAfter || onSplit
    ? (shortcut: SceneShortcut, at: number): boolean => {
        if (shortcut === 'new') {
          if (!onNewAfter) return false
          onNewAfter()
          return true
        }
        if (shortcut === 'split') {
          if (!onSplit) return false
          onSplit(at)
          return true
        }
        if (!onStep || !onStep(shortcut)) return false
        // One open card is where the writer is; the one they left folds away.
        setExpanded(false)
        return true
      }
    : undefined
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  /*
    **The cast is read from the event, not copied from it.**

    These were plain `useState` seeded from the prop and re-synced only when
    the edit form opened, closed or saved — which was safe for exactly as long
    as this card was the *only* thing that wrote them. It stopped being true
    the moment `@@` in the scene prose began writing presence through
    `updateEvent`: the card went on showing the cast it had mounted with, and
    its own **+ Add character** then wrote that stale array back, silently
    destroying every assertion the writer had typed since opening the card.

    A writer's run lost two characters that way in four scenes, and could only
    tell because they read IndexedDB — on screen, nothing happened but a name
    appearing. The same staleness let somebody be present *and* mentioned at
    once, which the guide says outright cannot happen.

    So the draft copies exist only while the edit form is open, and everywhere
    else the live record is the answer. A second writer cannot desynchronise
    something that was never duplicated.
  */
  const [draftInvolvedIds, setDraftInvolvedIds] = useState<string[]>(event.involvedCharacterIds)
  const involvedIds = editing ? draftInvolvedIds : event.involvedCharacterIds
  /*
    Always live, with no draft twin: `saveEdit` has never written
    `mentionedCharacterIds`, because the mention chips write straight through
    whether the edit form is open or not. Giving this one a draft copy would
    have made the edit form the one place mentions are silently discarded.
  */
  const mentionedIds = event.mentionedCharacterIds ?? []
  const [threadIds, setThreadIds] = useState<string[]>(event.threadIds ?? [])
  const [motifIds, setMotifIds] = useState<string[]>(event.motifIds ?? [])
  const [involvedItemIds, setInvolvedItemIds] = useState<string[]>(event.involvedItemIds)
  const [locationMarkerId, setLocationMarkerId] = useState<string | null>(event.locationMarkerId)
  const [tags, setTags] = useState<string[]>(event.tags)
  const [status, setStatus] = useState<EventStatus>(event.status ?? 'draft')
  const [povCharacterId, setPovCharacterId] = useState<string | null>(event.povCharacterId ?? null)
  const [isFlashback, setIsFlashback] = useState(event.isFlashback ?? false)
  const [travelDays, setTravelDays] = useState<number | null>(event.travelDays ?? null)
  const [inWorldTime, setInWorldTime] = useState<number | null>(event.inWorldTime ?? null)
  const [tension, setTension] = useState<number | null>(event.tension ?? null)
  const [structureBeat, setStructureBeat] = useState<string | null>(event.structureBeat ?? null)
  /*
    Follow the record while not editing.

    This is an edit buffer seeded once at mount, and the scene's setting is not
    only set from this card: typing `@somewhere` in the draft and choosing "new
    place" creates the marker and writes `locationMarkerId` straight to the
    database, from a child component. The card never heard, so it went on
    offering `+ Setting` and showing no setting section for a place the writer
    had just made — and the obvious conclusion is that it did not work, so they
    make it again. Nothing was lost (`startEdit` re-syncs before a save can
    commit the stale value), but the card denied the record until a reload.

    Only while not editing: mid-edit the buffer is the writer's, not the
    record's.
  */
  useEffect(() => {
    if (!editing) setLocationMarkerId(event.locationMarkerId)
  }, [event.locationMarkerId, editing])

  // Live scene word count, reported up by SceneDraftSection so the header chip
  // reflects unsaved edits without this card owning the prose state.
  const [sceneWords, setSceneWords] = useState(0)
  const [moveOpen, setMoveOpen] = useState(false)

  const characters = useCharacters(event.worldId)
  const items = useItems(event.worldId)
  const locationMarkers = useAllLocationMarkers(event.worldId)
  const plotThreads = usePlotThreads(event.worldId)
  const motifs = useMotifs(event.worldId)

  const assignedThreads = plotThreads.filter((t) => threadIds.includes(t.id))
  const availableThreads = plotThreads.filter((t) => !threadIds.includes(t.id))
  const assignedMotifs = motifs.filter((m) => motifIds.includes(m.id))
  const availableMotifs = motifs.filter((m) => !motifIds.includes(m.id))

  const involvedChars = characters.filter((c) => involvedIds.includes(c.id))
  const availableChars = characters.filter((c) => !involvedIds.includes(c.id))
  const involvedItems = items.filter((it) => involvedItemIds.includes(it.id))
  const availableItems = items.filter((it) => !involvedItemIds.includes(it.id))
  const currentLocation = locationMarkers.find((m) => m.id === locationMarkerId) ?? null
  const povChar = characters.find((c) => c.id === povCharacterId) ?? null
  const nonInvolvedChars = characters.filter((c) => !involvedIds.includes(c.id))

  const mentionedChars = characters.filter((c) => mentionedIds.includes(c.id))
  const availableForMention = characters.filter((c) => !mentionedIds.includes(c.id) && !involvedIds.includes(c.id))

  /**
   * A scene has a dozen things it *can* carry and most scenes carry two or
   * three. Opening every one of them at once meant a card created a minute ago,
   * with a title and nothing else, presented the whole ontology before the
   * writer had written a sentence.
   *
   * So: a section that holds something is shown, and the rest collapse into one
   * row of named chips at the bottom. Nothing is hidden behind a menu or a mode
   * — every one is still there, named, one click away — and the data decides
   * rather than a ranking someone had to invent.
   *
   * `available` is the section's own precondition, unchanged: a world with no
   * maps has no Location section to offer, so it is not offered as a chip either.
   */
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const optionalSections = [
    /*
      W23-5: one field, three names. The chip and its section said *Location*,
      the Writer's Brief said **Setting:**, and the continuity checker said
      *"change the scene's place"* — the same `locationMarkerId` under three
      words, on three screens, all shipped within days of each other.

      **Setting** is the one that survives, because it is the only one that says
      what the field is *about*: a scene's setting is where it happens, as
      distinct from where each character is recorded as being, which the panel
      below calls their location and which can legitimately differ.
    */
    { id: 'location',   label: 'Setting',    available: locationMarkers.length > 0, filled: locationMarkerId !== null },
    { id: 'tags',       label: 'Tags',       available: true,  filled: tags.length > 0 },
    { id: 'characters', label: 'Characters', available: true,  filled: involvedIds.length > 0 },
    { id: 'mentions',   label: 'Mentioned',  available: true,  filled: mentionedIds.length > 0 },
    { id: 'threads',    label: 'Plot Threads', available: plotThreads.length > 0, filled: threadIds.length > 0 },
    { id: 'motifs',     label: 'Motifs',     available: motifs.length > 0, filled: motifIds.length > 0 },
    { id: 'items',      label: 'Items',      available: involvedItems.length > 0 || availableItems.length > 0, filled: involvedItemIds.length > 0 },
    { id: 'pov',        label: 'Point of View', available: characters.length > 0, filled: povCharacterId !== null },
    { id: 'time',       label: 'Elapsed Time', available: true, filled: travelDays !== null || inWorldTime !== null },
    { id: 'flashback',  label: 'Flashback',  available: true,  filled: isFlashback },
    { id: 'beat',       label: 'Story Beat', available: true,  filled: structureBeat !== null },
    { id: 'tension',    label: 'Dramatic Tension', available: true, filled: tension !== null },
  ]
  const sectionById = new Map(optionalSections.map((s) => [s.id, s]))
  /** Editing opens everything: the writer has asked to work on the whole scene. */
  function shows(id: string): boolean {
    const section = sectionById.get(id)!
    if (!section.available) return false
    return editing || section.filled || revealed.has(id)
  }
  const offerable = optionalSections.filter((s) => s.available && !s.filled && !revealed.has(s.id))

  async function saveEdit() {
    await updateEvent(event.id, {
      title: title.trim(),
      description: description.trim(),
      involvedCharacterIds: involvedIds,
      involvedItemIds,
      locationMarkerId,
      tags,
    })
    setEditing(false)
  }

  function cancelEdit() {
    setTitle(event.title)
    setDescription(event.description)
    setDraftInvolvedIds(event.involvedCharacterIds)
    setInvolvedItemIds(event.involvedItemIds)
    setLocationMarkerId(event.locationMarkerId)
    setTags(event.tags)
    setStatus(event.status ?? 'draft')
    setPovCharacterId(event.povCharacterId ?? null)
    setEditing(false)
  }

  async function changeStatus(s: EventStatus) {
    setStatus(s)
    await updateEvent(event.id, { status: s })
  }

  async function changePov(id: string | null) {
    setPovCharacterId(id)
    await updateEvent(event.id, { povCharacterId: id })
  }

  async function toggleFlashback() {
    const next = !isFlashback
    setIsFlashback(next)
    await updateEvent(event.id, { isFlashback: next })
  }

  async function changeTension(level: number | null) {
    // Clicking the active level clears it back to unrated.
    const next = nextTension(tension, level)
    setTension(next)
    await updateEvent(event.id, { tension: next })
  }

  async function changeBeat(id: string | null) {
    setStructureBeat(id)
    await updateEvent(event.id, { structureBeat: id })
  }

  function handleTravelDaysChange(raw: string) {
    const val = parseTravelDays(raw)
    setTravelDays(val)
    updateEvent(event.id, { travelDays: val })
  }

  function handleInWorldTimeChange(raw: string) {
    const val = parseInWorldDay(raw)
    setInWorldTime(val)
    updateEvent(event.id, { inWorldTime: val })
  }

  function startEdit() {
    setTitle(event.title)
    setDescription(event.description)
    setDraftInvolvedIds(event.involvedCharacterIds)
    setInvolvedItemIds(event.involvedItemIds)
    setLocationMarkerId(event.locationMarkerId)
    setTags(event.tags)
    setEditing(true)
    setExpanded(true)
  }

  // ── Character helpers ──────────────────────────────────────────────────────
  async function addCharacter(characterId: string) {
    if (involvedIds.includes(characterId)) return
    const newIds = [...involvedIds, characterId]
    if (editing) { setDraftInvolvedIds(newIds); return }
    await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  async function removeCharacter(characterId: string) {
    const newIds = involvedIds.filter((id) => id !== characterId)
    if (editing) { setDraftInvolvedIds(newIds); return }
    await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  // ── Mention helpers (referenced but not present) ─────────────────────────────
  async function addMention(characterId: string) {
    /*
      Present characters are on-stage, not merely mentioned — and this guard is
      only as good as what it reads. Against a stale copy it let a character
      typed as present with `@@` be added to *mentioned* by one friendly click
      on the "Named in the text" chip, putting them in both lists at once.
    */
    if (involvedIds.includes(characterId) || mentionedIds.includes(characterId)) return
    const newIds = [...mentionedIds, characterId]
    await updateEvent(event.id, { mentionedCharacterIds: newIds })
  }

  async function removeMention(characterId: string) {
    const newIds = mentionedIds.filter((id) => id !== characterId)
    await updateEvent(event.id, { mentionedCharacterIds: newIds })
  }

  // ── Plot-thread helpers ──────────────────────────────────────────────────────
  async function addThread(threadId: string) {
    if (threadIds.includes(threadId)) return
    const newIds = [...threadIds, threadId]
    setThreadIds(newIds)
    await updateEvent(event.id, { threadIds: newIds })
  }

  async function removeThread(threadId: string) {
    const newIds = threadIds.filter((id) => id !== threadId)
    setThreadIds(newIds)
    await updateEvent(event.id, { threadIds: newIds })
  }

  // ── Motif helpers ────────────────────────────────────────────────────────────
  async function addMotif(motifId: string) {
    if (motifIds.includes(motifId)) return
    const newIds = [...motifIds, motifId]
    setMotifIds(newIds)
    await updateEvent(event.id, { motifIds: newIds })
  }

  async function removeMotif(motifId: string) {
    const newIds = motifIds.filter((id) => id !== motifId)
    setMotifIds(newIds)
    await updateEvent(event.id, { motifIds: newIds })
  }

  // ── Item helpers ───────────────────────────────────────────────────────────
  async function addItem(itemId: string) {
    if (involvedItemIds.includes(itemId)) return
    const newIds = [...involvedItemIds, itemId]
    setInvolvedItemIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedItemIds: newIds })
  }

  async function removeItem(itemId: string) {
    const newIds = involvedItemIds.filter((id) => id !== itemId)
    setInvolvedItemIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedItemIds: newIds })
  }

  // ── Location helpers ───────────────────────────────────────────────────────
  async function changeLocation(val: string | null) {
    setLocationMarkerId(val)
    if (!editing) await updateEvent(event.id, { locationMarkerId: val })
  }

  // ── Tag helpers ────────────────────────────────────────────────────────────
  // Typing, Enter, Backspace and removing a chip are the field's own; see `TagsField`.
  function changeTags(newTags: string[]) {
    setTags(newTags)
    if (!editing) updateEvent(event.id, { tags: newTags })
  }

  // ── Summary line visibility ────────────────────────────────────────────────
  const hasSummary = involvedChars.length > 0 || currentLocation !== null || tags.length > 0

  function handleSelectClick(e: React.MouseEvent) {
    e.stopPropagation()
    const ids = selection?.chapterEventIds ?? []
    if (e.shiftKey && lastSelectedEventId && lastSelectedEventId !== event.id) {
      const fromIdx = ids.indexOf(lastSelectedEventId)
      const toIdx = ids.indexOf(event.id)
      if (fromIdx !== -1 && toIdx !== -1) {
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        selectEventRange(ids.slice(lo, hi + 1))
        setLastSelectedEventId(event.id)
        return
      }
    }
    toggleEventSelected(event.id)
    setLastSelectedEventId(event.id)
  }

  const card = (
    <div ref={cardRef} className={cn(
      '@container scroll-mt-3 rounded-lg border bg-[hsl(var(--card))] transition-colors',
      isSelected ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.3)]' : 'border-[hsl(var(--border))]',
    )}>
      {/*
        Header row. Wraps where the card is narrow — a phone, or a list with the
        binder and the chapter's panel both beside it — with the title given
        the first line to itself. On one line the badges and the icons, none of
        which shrink, took the whole width: the title went to nothing and the
        row ran out past the card's edge.
      */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2">
        {/*
          The disclosure and the title field are alternatives, not one nested in
          the other. While editing, the button wrapped the `Input` — inert,
          because its own handler checked `!editing`, and nameless, because a
          button takes its name from its content and the content was now a
          field. Interactive content inside a button is not valid either.
        */}
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            /*
              Enter commits, Escape backs out — the two keys the chapter rename
              one screen up has always honoured (`TimelineView`), and which this
              field ignored. Retitling a run of scenes was 34 interactions that
              saved nothing and said nothing: Enter did not commit, and moving on
              discarded what had been typed.

              Blur is deliberately *not* a third way in. This is not an inline
              rename — the whole card is in an edit session, and the same Save
              writes the description, cast, items, location and tags — so
              committing when focus leaves the title would end the session the
              moment you tabbed to the field below it. `Escape` cancels the
              session for the same reason: it is the counterpart of Enter, not
              of blur.
            */
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                // Mirrors the Save button's own `disabled={!title.trim()}`: a
                // scene may be untitled, but it may not be blanked by accident.
                if (title.trim()) void saveEdit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
            aria-label="Scene title"
            className="h-7 flex-1 min-w-0 text-sm @max-md:basis-full"
            autoFocus
          />
        ) : (
          <button
            className="flex-1 min-w-0 text-left @max-md:basis-full"
            // An untitled scene renders an empty span, which leaves this button
            // with no accessible name at all — the one card on the page a screen
            // reader could say nothing about.
            aria-label={event.title ? undefined : 'Untitled scene'}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate block">
              {event.title || <span className="italic text-[hsl(var(--muted-foreground))]">Untitled scene</span>}
            </span>
          </button>
        )}

        <EventCardBadges
          sceneWords={sceneWords}
          inWorldDay={inWorldDay}
          calendar={calendar}
          isFlashback={isFlashback}
          status={status}
          structureBeat={structureBeat}
          tension={tension}
          povChar={povChar}
          onChangeStatus={changeStatus}
          onToggleFlashback={toggleFlashback}
          onExpand={() => setExpanded(true)}
        />

        {editing ? (
          <>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-green-400"
              aria-label={`Save ${eventName}`} title="Save" onClick={saveEdit} disabled={!title.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              aria-label={`Stop editing ${eventName}`} title="Cancel" onClick={cancelEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            {/* Every scene on the page has this same row of icons, so each name
                has to say which scene it acts on — "Move up" four times over is
                no more use to a screen reader than no name at all. */}
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-[hsl(var(--foreground))]"
              aria-label={moveUpHint ? `${moveUpHint}: ${eventName}` : `Move ${eventName} earlier`}
              title={moveUpHint ?? 'Move earlier'}
              disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-[hsl(var(--foreground))]"
              aria-label={moveDownHint ? `${moveDownHint}: ${eventName}` : `Move ${eventName} later`}
              title={moveDownHint ?? 'Move later'}
              disabled={isLast} onClick={(e) => { e.stopPropagation(); onMoveDown() }}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${eventName}`}
              aria-expanded={expanded}
              title={expanded ? 'Collapse' : 'Expand'}
              onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            {/* EV-5: delete used to sit right here, drawn exactly like the two
                reorder arrows and the expand chevron beside it — a destructive
                action with the weight of a routine one, on every scene in the
                chapter. See `src/components/ui/menu.tsx`. */}
            {/* N13: this menu held one item and that item was Delete. Moving a
                scene to another chapter existed on the Corkboard and in the
                bulk toolbar, but not where a writer opens first. */}
            {/*
              Moving and deleting a scene are the author's. This file carried no
              reference to the gate at all, so both were offered to a reader on
              every scene of every chapter — four of them on Alice's first
              chapter. The reader run that found the same fault on the chapter
              rows never opened this screen; a grep for ungated menus did.
            */}
            {onOpenChapter && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                aria-label={`Open the chapter holding ${eventName}`}
                title="Open its chapter"
                onClick={(e) => { e.stopPropagation(); onOpenChapter() }}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            {!gate.active && (
              <Menu label={`More actions for ${eventName}`} triggerClassName="h-6 w-6">
                <MenuItem icon={FolderInput} label="Move to chapter…" onClick={() => setMoveOpen(true)} />
                {onJoinNext && (
                  <MenuItem icon={Merge} label="Join with next scene…" onClick={() => setJoinOpen(true)} />
                )}
                <MenuItem icon={Trash2} label="Delete scene" danger onClick={() => setConfirmOpen(true)} />
              </Menu>
            )}
            <MoveSceneDialog
              open={moveOpen}
              onOpenChange={setMoveOpen}
              eventId={event.id}
              timelineId={event.timelineId}
              currentChapterId={event.chapterId}
              sceneName={event.title || 'this scene'}
            />
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={`Delete "${event.title || 'this scene'}"?`}
              onConfirm={() => deleteEvent(event.id)}
            />
            {onJoinNext && (
              <ConfirmDialog
                open={joinOpen}
                onOpenChange={setJoinOpen}
                title={`Join “${nextTitle || 'the next scene'}” onto ${eventName}?`}
                description={`Its prose is added to the end of this scene, and it stops being a scene of its own. Who and what is in it joins this one. Where both scenes recorded a state for the same character, item or place, the one recorded in “${nextTitle || 'the next scene'}” is kept, since it comes later. Undo puts it all back.`}
                confirmLabel="Join"
                destructive={false}
                onConfirm={onJoinNext}
              />
            )}
          </>
        )}
      </div>

      {/* Summary chips (collapsed, non-editing) */}
      {!expanded && !editing && hasSummary && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
          {/* Character portraits */}
          {involvedChars.slice(0, 3).map((c) => (
            <div key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] pl-0.5 pr-2 py-0.5">
              <PortraitImage
                imageId={c.portraitImageId}
                className="h-4 w-4 rounded-full object-cover"
                fallbackClassName="h-4 w-4 rounded-full"
              />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{c.name}</span>
            </div>
          ))}
          {involvedChars.length > 3 && (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">+{involvedChars.length - 3} more</span>
          )}
          {/* Location */}
          {currentLocation && (
            <div className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5">
              <MapPin className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{currentLocation.name}</span>
            </div>
          )}
          {/* Tags */}
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px] text-[hsl(var(--foreground))]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-3 flex flex-col gap-4">

          {/*
            EV-3: the prose came third, under a Description that renders as a
            grey italic line. The scene is what the app is for and what is
            always editable in place, so it leads; the description is a summary
            that lives behind Edit, and follows.
          */}

          {/* Scene draft (manuscript prose) */}
          <SceneDraftSection
            event={event}
            characters={characters}
            involvedIds={involvedIds}
            mentionedIds={mentionedIds}
            onAddMention={addMention}
            onWordsChange={setSceneWords}
            onShortcut={onShortcut}
            focusRequest={draftFocus}
            canAddAfter={!!onNewAfter}
            openFocusNonce={focusModeNonce}
            focusKeys={onStep ? {
              step: (dir) => {
                if (!onStep(dir, { focus: true })) return false
                setExpanded(false)
                return true
              },
              make: onMakeFromFocus,
            } : undefined}
          />

          {/* Description */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Description</span>
            {editing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                aria-label="Scene description"
                placeholder="What happened..."
                rows={3}
                className="text-sm"
              />
            ) : (
              /*
                EV-3, second half: this read as a note rather than a field,
                because it *was* one — the text only becomes editable through
                the card's Edit button somewhere else entirely. It is the
                control that opens that mode now, so the thing you want to
                change is the thing you click.
              */
              <button
                type="button"
                onClick={startEdit}
                aria-label={event.description ? 'Edit the description' : 'Add a description'}
                className="rounded text-left transition-colors hover:bg-[hsl(var(--accent)/0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                {event.description
                  ? <span className="block whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">{event.description}</span>
                  : <span className="block text-xs italic text-[hsl(var(--muted-foreground))]">No description — click to add one.</span>}
              </button>
            )}
          </div>

          {/* Location */}
          {shows('location') && (
            <SettingField markers={locationMarkers} value={locationMarkerId} onChange={changeLocation} />
          )}

          {/* Tags */}
          {shows('tags') && <TagsField tags={tags} onChange={changeTags} />}

          {/* Involved Characters */}
          {shows('characters') && (
            <CastField present={involvedChars} available={availableChars} onAdd={addCharacter} onRemove={removeCharacter} />
          )}

          {/* Mentioned (referenced but not present) */}
          {shows('mentions') && (
            <MentionsField mentioned={mentionedChars} available={availableForMention} worldHasCharacters={characters.length > 0} onAdd={addMention} onRemove={removeMention} />
          )}

          {/* Plot threads (created on the dashboard; tagged here) */}
          {shows('threads') && (
            <ThreadsField assigned={assignedThreads} available={availableThreads} onAdd={addThread} onRemove={removeThread} />
          )}

          {/* Motifs / themes (created on the dashboard; tagged here) */}
          {shows('motifs') && (
            <MotifsField assigned={assignedMotifs} available={availableMotifs} onAdd={addMotif} onRemove={removeMotif} />
          )}

          {/* Involved Items — offered only where there are items, involved or to pick. */}
          {shows('items') && (
            <ItemsField involved={involvedItems} available={availableItems} onAdd={addItem} onRemove={removeItem} />
          )}

          {/* POV picker */}
          {shows('pov') && (
            <PovField value={povCharacterId} present={involvedChars} others={nonInvolvedChars} onChange={changePov} />
          )}

          {/* Elapsed time before this event */}
          {shows('time') && (
            <TimeField
              travelDays={travelDays}
              inWorldTime={inWorldTime}
              onTravelDays={handleTravelDaysChange}
              onInWorldTime={handleInWorldTimeChange}
            />
          )}

          {/* Flashback toggle */}
          {shows('flashback') && <FlashbackField value={isFlashback} onToggle={toggleFlashback} />}

          {/* Story-structure beat */}
          {shows('beat') && <BeatField value={structureBeat} onChange={changeBeat} />}

          {/* Tension picker */}
          {shows('tension') && <TensionField value={tension} onPick={changeTension} />}

          {/* Everything this scene is not yet tracking, named and one click away. */}
          {!editing && offerable.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Add</span>
              {offerable.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setRevealed((prev) => new Set(prev).add(s.id))}
                  className="rounded-full border border-dashed border-[hsl(var(--border))] px-2 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring)/0.6)] hover:text-[hsl(var(--foreground))]"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Status picker */}
          <StatusField value={status} onChange={changeStatus} />

          {/* Edit / save */}
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!title.trim()}>Save</Button>
              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {/*
                W-4: the explicit way to put the time cursor on a scene. Opening
                the card does not move it, deliberately — browsing must not
                drag a global cursor around — so this is the act, named, with
                the read-ahead guard a reader's jump always carries. It was the
                whole book's alone while the two screens had two kinds of scene.
              */}
              <Button
                size="sm"
                variant={isHere ? 'secondary' : 'outline'}
                className="gap-1.5 text-xs"
                disabled={isHere}
                onClick={() => guardJump(chapterNumber, () => setActiveEventId(event.id))}
                title={isHere
                  ? 'The time cursor is on this scene'
                  : gate.active
                    ? `Mark ${eventName} as where you have read up to`
                    : `Move the time cursor to ${eventName}`}
              >
                <Eye className="h-3 w-3" />
                {isHere
                  ? (gate.active ? 'Reading here' : 'Viewing')
                  : (gate.active ? 'Read to here' : 'View from here')}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={startEdit}>
                Edit title &amp; description
              </Button>
            </div>
          )}
          {readAheadDialog}
        </div>
      )}
    </div>
  )

  if (!selection) return card
  return (
    <div className="group flex">
      {/* The whole book's gutter: the selection box, and the line joining a chapter's scenes. */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        {selectable && (
          <div
            className={cn(
              'pw-tap-row mt-2.5 flex shrink-0 cursor-pointer items-center justify-center transition-opacity',
              selectedEventIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            onClick={handleSelectClick}
          >
            {/* Named but not pointer-gated — see the note in `ChapterRow`.
                `pw-tap-row` (HB-2c) gives it a 24x36 hit area on touch. */}
            <input
              type="checkbox"
              aria-label={`Select scene ${event.title || 'Untitled'}`}
              checked={isSelected}
              onChange={() => {}} // controlled via onClick
              className="h-3 w-3 cursor-pointer accent-[hsl(var(--ring))]"
            />
          </div>
        )}
        <div className="w-px flex-1 bg-[hsl(var(--border))]" />
      </div>
      <div className="min-w-0 flex-1">{card}</div>
    </div>
  )
}
