import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Trash2, ChevronDown, ChevronUp, Check, X, UserMinus, PackageMinus, MapPin, Tag, ArrowUp, ArrowDown, Package, Eye, History, Flame, Milestone } from 'lucide-react'
import { TENSION_LEVELS, tensionColor, tensionLabel } from '@/lib/tension'
import { STORY_BEATS, beatById, beatActColor } from '@/lib/storyBeats'
import { AtSign, Spline, Sparkle } from 'lucide-react'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useMotifs } from '@/db/hooks/useMotifs'
import { SceneDraftSection } from './SceneDraftSection'
import { EventCardBadges } from './EventCardBadges'
import type { WorldEvent, EventStatus, WorldCalendar } from '@/types'
import { EVENT_STATUSES, eventStatusConfig } from '@/lib/eventStatus'
import { charColor } from '@/lib/characterColor'
import { deleteEvent, updateEvent } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Menu, MenuItem } from '@/components/ui/menu'

interface EventCardProps {
  event: WorldEvent
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  /** Derived in-world day (cumulative travel days along narrative order). */
  inWorldDay?: number
  /** The world's calendar, when it has one (CD-3) — the day chip becomes a date. */
  calendar?: WorldCalendar | null
}

export function EventCard({ event, isFirst, isLast, onMoveUp, onMoveDown, inWorldDay, calendar }: EventCardProps) {
  /** Names the card's icon buttons, which are otherwise identical across scenes. */
  const eventName = event.title ? `“${event.title}”` : 'this untitled scene'
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [involvedIds, setInvolvedIds] = useState<string[]>(event.involvedCharacterIds)
  const [mentionedIds, setMentionedIds] = useState<string[]>(event.mentionedCharacterIds ?? [])
  const [threadIds, setThreadIds] = useState<string[]>(event.threadIds ?? [])
  const [motifIds, setMotifIds] = useState<string[]>(event.motifIds ?? [])
  const [involvedItemIds, setInvolvedItemIds] = useState<string[]>(event.involvedItemIds)
  const [locationMarkerId, setLocationMarkerId] = useState<string | null>(event.locationMarkerId)
  const [tags, setTags] = useState<string[]>(event.tags)
  const [tagInput, setTagInput] = useState('')
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
  const tagInputRef = useRef<HTMLInputElement>(null)

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
    setInvolvedIds(event.involvedCharacterIds)
    setInvolvedItemIds(event.involvedItemIds)
    setLocationMarkerId(event.locationMarkerId)
    setTags(event.tags)
    setStatus(event.status ?? 'draft')
    setPovCharacterId(event.povCharacterId ?? null)
    setTagInput('')
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
    const next = level !== null && level === tension ? null : level
    setTension(next)
    await updateEvent(event.id, { tension: next })
  }

  async function changeBeat(id: string | null) {
    setStructureBeat(id)
    await updateEvent(event.id, { structureBeat: id })
  }

  function handleTravelDaysChange(raw: string) {
    const parsed = raw.trim() === '' ? null : Math.max(0, parseFloat(raw))
    const val = parsed === null || Number.isNaN(parsed) ? null : parsed
    setTravelDays(val)
    updateEvent(event.id, { travelDays: val })
  }

  function handleInWorldTimeChange(raw: string) {
    const parsed = raw.trim() === '' ? null : parseFloat(raw)
    const val = parsed === null || Number.isNaN(parsed) ? null : parsed
    setInWorldTime(val)
    updateEvent(event.id, { inWorldTime: val })
  }

  function startEdit() {
    setTitle(event.title)
    setDescription(event.description)
    setInvolvedIds(event.involvedCharacterIds)
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
    setInvolvedIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  async function removeCharacter(characterId: string) {
    const newIds = involvedIds.filter((id) => id !== characterId)
    setInvolvedIds(newIds)
    if (!editing) await updateEvent(event.id, { involvedCharacterIds: newIds })
  }

  // ── Mention helpers (referenced but not present) ─────────────────────────────
  async function addMention(characterId: string) {
    // Present characters are on-stage, not merely mentioned.
    if (involvedIds.includes(characterId) || mentionedIds.includes(characterId)) return
    const newIds = [...mentionedIds, characterId]
    setMentionedIds(newIds)
    await updateEvent(event.id, { mentionedCharacterIds: newIds })
  }

  async function removeMention(characterId: string) {
    const newIds = mentionedIds.filter((id) => id !== characterId)
    setMentionedIds(newIds)
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
  async function changeLocation(markerId: string) {
    const val = markerId === '__none__' ? null : markerId
    setLocationMarkerId(val)
    if (!editing) await updateEvent(event.id, { locationMarkerId: val })
  }

  // ── Tag helpers ────────────────────────────────────────────────────────────
  function commitTag() {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag]
      setTags(newTags)
      if (!editing) updateEvent(event.id, { tags: newTags })
    }
    setTagInput('')
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitTag() }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      const newTags = tags.slice(0, -1)
      setTags(newTags)
      if (!editing) updateEvent(event.id, { tags: newTags })
    }
  }

  async function removeTag(tag: string) {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    if (!editing) await updateEvent(event.id, { tags: newTags })
  }

  // ── Summary line visibility ────────────────────────────────────────────────
  const hasSummary = involvedChars.length > 0 || currentLocation !== null || tags.length > 0

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {/* Header row */}
      <div className="flex items-center gap-1 px-3 py-2">
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
            className="h-7 flex-1 min-w-0 text-sm"
            autoFocus
          />
        ) : (
          <button
            className="flex-1 min-w-0 text-left"
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
              aria-label={`Move ${eventName} earlier`} title="Move earlier"
              disabled={isFirst} onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:text-[hsl(var(--foreground))]"
              aria-label={`Move ${eventName} later`} title="Move later"
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
            <Menu label={`More actions for ${eventName}`} triggerClassName="h-6 w-6">
              <MenuItem icon={Trash2} label="Delete scene" danger onClick={() => setConfirmOpen(true)} />
            </Menu>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={`Delete "${event.title || 'this scene'}"?`}
              onConfirm={() => deleteEvent(event.id)}
            />
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
            onAddCharacter={addCharacter}
            onAddMention={addMention}
            onWordsChange={setSceneWords}
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
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Setting
              </span>
              <Select value={locationMarkerId ?? '__none__'} onValueChange={changeLocation}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Nowhere in particular…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">Nowhere in particular</SelectItem>
                  {locationMarkers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tags */}
          {shows('tags') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <Tag className="h-3 w-3" /> Tags
            </span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1.5 min-h-[2rem] cursor-text"
              onClick={() => tagInputRef.current?.focus()}>
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[10px]">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-400">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={commitTag}
                aria-label="Add a tag to this scene"
                placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
                className="flex-1 min-w-[8rem] bg-transparent text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none"
              />
            </div>
          </div>
          )}

          {/* Involved Characters */}
          {shows('characters') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Characters</span>
            {involvedChars.length > 0 ? (
              <div className="flex flex-col gap-1">
                {involvedChars.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                    <PortraitImage
                      imageId={c.portraitImageId}
                      className="h-5 w-5 rounded-full object-cover"
                      fallbackClassName="h-5 w-5 rounded-full"
                    />
                    <span className="flex-1 text-xs">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400"
                      aria-label={`Remove ${c.name} from this scene`} title={`Remove ${c.name}`}
                      onClick={() => removeCharacter(c.id)}>
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : availableChars.length === 0 ? (
              /* X-4 rule 3: with the picker below, a sentence announcing the
                 absence says nothing the picker does not. Without one — no
                 characters exist yet — the section would be blank, so it says
                 why there is nothing to pick. */
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No characters in this world yet.</p>
            ) : null}
            {availableChars.length > 0 && (
              <Select onValueChange={addCharacter} value="">
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Add character…" />
                </SelectTrigger>
                <SelectContent>
                  {availableChars.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          )}

          {/* Mentioned (referenced but not present) */}
          {shows('mentions') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Mentioned
            </span>
            {mentionedChars.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {mentionedChars.map((c) => (
                  <span key={c.id} className="flex items-center gap-1 rounded-full bg-[hsl(var(--muted))] pl-0.5 pr-1 py-0.5">
                    <PortraitImage
                      imageId={c.portraitImageId}
                      className="h-4 w-4 rounded-full object-cover"
                      fallbackClassName="h-4 w-4 rounded-full"
                    />
                    <span className="text-[10px] text-[hsl(var(--foreground))]">{c.name}</span>
                    <button onClick={() => removeMention(c.id)} className="ml-0.5 hover:text-red-400" aria-label={`Remove mention of ${c.name}`}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {availableForMention.length > 0
                  ? 'Type @ in the scene draft to mention someone.'
                  : 'No characters in this world yet.'}
              </p>
            )}
            {availableForMention.length > 0 && (
              <Select onValueChange={addMention} value="">
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="+ Mention character…" />
                </SelectTrigger>
                <SelectContent>
                  {availableForMention.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          )}

          {/* Plot threads (created on the dashboard; tagged here) */}
          {shows('threads') && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Spline className="h-3 w-3" /> Plot Threads
              </span>
              {assignedThreads.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assignedThreads.map((t) => (
                    <span key={t.id} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                      style={{ background: `${t.color}22`, border: `1px solid ${t.color}55` }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />
                      <span className="text-[hsl(var(--foreground))]">{t.name}</span>
                      <button onClick={() => removeThread(t.id)} className="ml-0.5 hover:text-red-400" aria-label={`Remove thread ${t.name}`}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableThreads.length > 0 && (
                <Select onValueChange={addThread} value="">
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Tag a thread…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableThreads.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Motifs / themes (created on the dashboard; tagged here) */}
          {shows('motifs') && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Sparkle className="h-3 w-3" /> Motifs
              </span>
              {assignedMotifs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assignedMotifs.map((m) => (
                    <span key={m.id} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                      style={{ background: `${m.color}22`, border: `1px solid ${m.color}55` }}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: m.color }} />
                      <span className="text-[hsl(var(--foreground))]">{m.name}</span>
                      <button onClick={() => removeMotif(m.id)} className="ml-0.5 hover:text-red-400" aria-label={`Remove motif ${m.name}`}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableMotifs.length > 0 && (
                <Select onValueChange={addMotif} value="">
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Tag a motif…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMotifs.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Involved Items */}
          {shows('items') && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Items</span>
              {involvedItems.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {involvedItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                      <PortraitImage
                        imageId={it.imageId}
                        className="h-5 w-5 rounded object-cover"
                        fallbackClassName="h-5 w-5 rounded"
                        fallbackIcon={Package}
                      />
                      <span className="flex-1 text-xs">{it.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-red-400"
                        aria-label={`Remove ${it.name} from this scene`} title={`Remove ${it.name}`}
                        onClick={() => removeItem(it.id)}>
                        <PackageMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              {/* No "no items yet" fallback: this section is only offerable when
                  `involvedItems.length > 0 || availableItems.length > 0`, so an
                  empty list here guarantees the picker below. Rule 3 applies
                  outright. */}
              {availableItems.length > 0 && (
                <Select onValueChange={addItem} value="">
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Add item…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableItems.map((it) => (
                      <SelectItem key={it.id} value={it.id} className="text-xs">{it.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* POV picker */}
          {shows('pov') && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
                <Eye className="h-3 w-3" /> Point of View
              </span>
              <Select
                value={povCharacterId ?? '__none__'}
                onValueChange={(v) => changePov(v === '__none__' ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No POV character…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No POV character</SelectItem>
                  {involvedChars.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wide">In this scene</SelectLabel>
                      {involvedChars.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(c) }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {nonInvolvedChars.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wide">All characters</SelectLabel>
                      {nonInvolvedChars.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: charColor(c) }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Elapsed time before this event */}
          {shows('time') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <History className="h-3 w-3" /> Elapsed Time
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="any"
                aria-label="Days since the previous scene"
                className="h-8 w-24 text-xs"
                placeholder="0"
                value={travelDays ?? ''}
                onChange={(e) => handleTravelDaysChange(e.target.value)}
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">days since the previous scene</span>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Builds the in-world clock and powers the travel-time continuity check.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                step="any"
                aria-label="Exact in-world day for this scene"
                className="h-8 w-24 text-xs"
                placeholder="auto"
                value={inWorldTime ?? ''}
                onChange={(e) => handleInWorldTimeChange(e.target.value)}
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">pin to an exact in-world day</span>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Overrides the derived clock — use for flashbacks or scenes out of narrative order.
            </p>
          </div>
          )}

          {/* Flashback toggle */}
          {shows('flashback') && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFlashback}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                isFlashback
                  ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
              title="Mark as flashback or retrospective — suppresses present-state continuity checks for this scene"
            >
              <History className="h-3 w-3" />
              Flashback / Retrospective
            </button>
          </div>
          )}

          {/* Story-structure beat */}
          {shows('beat') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <Milestone className="h-3 w-3" /> Story Beat
            </span>
            <Select value={structureBeat ?? '__none__'} onValueChange={(v) => changeBeat(v === '__none__' ? null : v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="No beat…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs italic text-[hsl(var(--muted-foreground))]">No beat</SelectItem>
                {[1, 2, 3].map((act) => (
                  <SelectGroup key={act}>
                    <SelectLabel className="text-[10px] uppercase tracking-wide">Act {act}</SelectLabel>
                    {STORY_BEATS.filter((b) => b.act === act).map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: beatActColor(b.act) }} />
                          {b.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {beatById(structureBeat) && (
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{beatById(structureBeat)!.hint}</p>
            )}
          </div>
          )}

          {/* Tension picker */}
          {shows('tension') && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
              <Flame className="h-3 w-3" /> Dramatic Tension
            </span>
            <div className="flex gap-1">
              {TENSION_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => changeTension(level)}
                  className="flex-1 rounded py-1 text-[10px] font-medium tabular-nums transition-opacity hover:opacity-90"
                  style={
                    tension === level
                      ? { background: tensionColor(level), color: '#fff' }
                      : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                  }
                  title={`${tensionLabel(level)} (${level}/5)`}
                  aria-pressed={tension === level}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {tension !== null
                ? `${tensionLabel(tension)} — click the same level again to clear.`
                : 'Rate the intensity to plot this scene on the pacing curve.'}
            </p>
          </div>
          )}

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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</span>
            <div className="flex gap-1">
              {EVENT_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className="flex-1 rounded py-1 text-[10px] font-medium transition-opacity hover:opacity-90"
                  style={
                    status === s
                      ? { background: eventStatusConfig(s).color, color: eventStatusConfig(s).textColor }
                      : { background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }
                  }
                  aria-pressed={status === s}
                >
                  {eventStatusConfig(s).label}
                </button>
              ))}
            </div>
          </div>

          {/* Edit / save */}
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!title.trim()}>Save</Button>
              <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs self-start" onClick={startEdit}>
              Edit title &amp; description
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
