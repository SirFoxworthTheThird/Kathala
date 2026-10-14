import { proseAliases } from '@/lib/characterNames'
import { useState, useEffect, useMemo, useRef } from 'react'
import { PenLine, History, Maximize2 } from 'lucide-react'
import { wordCount, detectMentions } from '@/lib/manuscript'
import { knownBeforeNote, formatSceneHeader, formatSceneHeaderLine, headerFacts, headerItems, headerRelations, planHeader, planIsClean, sceneFacts, sceneFates, sceneItems, scenePlaceStatus, sceneRelations, sceneNames, headerNames, splitSceneDraft } from '@/lib/sceneHeader'
import { recordRelationshipChanges } from '@/db/hooks/useRelationships'
import { createHeaderCharacter, recordIdentityChanges } from '@/db/hooks/useCharacters'
import { recordPlaceStatus } from '@/db/hooks/useLocationSnapshots'
import { createHeaderFact, recordFactChanges } from '@/db/hooks/useKnowledge'
import { createHeaderItem } from '@/db/hooks/useItems'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { placeCastAtScene, recordFates } from '@/db/hooks/useSnapshots'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { splitParagraphs } from '@/lib/manuscriptParagraphs'
import { useSceneText, setSceneText } from '@/db/hooks/useManuscript'
import type { SceneShortcut } from '@/lib/sceneStep'
import { useSceneRevisions } from '@/db/hooks/useSceneRevisions'
import { SceneDraftEditor } from './SceneDraftEditor'
import { SceneHistoryDialog } from './SceneHistoryDialog'
import { NamedInTextField } from './SceneFields'
import { FocusMode, type FocusKeys } from './FocusMode'
import type { Character, WorldEvent } from '@/types'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { recordMention, createHeaderPlace } from '@/db/hooks/useMentions'
import { NewCharacterNames } from './NewCharacterNames'
import { usePendingNames } from '@/lib/pendingNames'
import { HeaderCheatSheet } from './HeaderCheatSheet'
import { keptLine, keepLine, forgetLine, keptLineWarning, placeChoices } from '@/lib/keptHeaderLines'
import { placeLabel } from '@/lib/placeNames'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { updateEvent } from '@/db/hooks/useTimeline'
import type { MentionCandidate, MentionSuggestion, MentionIntent } from '@/lib/mentionPicker'
import { draftAfterSave } from '@/lib/draftHandoff'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

interface SceneDraftSectionProps {
  event: WorldEvent
  characters: Character[]
  involvedIds: string[]
  mentionedIds: string[]
  /** Add an in-text name to the on-stage cast. */
  /** Add an in-text name to the referenced-but-absent list. */
  onAddMention: (characterId: string) => void
  /** Reports the current word count so the card header chip can stay live. */
  onWordsChange?: (words: number) => void
  /**
   * The scene keys, answered by the Timeline — see `SceneDraftEditor`. `at` is
   * the caret's place in the *prose*: the box also holds the header line above
   * it, which is not part of the scene's text.
   */
  onShortcut?: (shortcut: SceneShortcut, at: number) => boolean
  /** Take focus on arrival, once the text is in. */
  focusRequest?: { nonce: number; at: 'start' | 'end' } | null
  /** Whether Ctrl+Enter makes a new scene here, for the hint to say so or not. */
  canAddAfter?: boolean
  /** Changes when the scene should open straight into Focus mode — arrived at from it. */
  openFocusNonce?: number | null
  /** The scene keys in Focus mode — see `FocusMode`. */
  focusKeys?: FocusKeys
}

const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'
const ALT = IS_MAC ? '⌥' : 'Alt+'
const SHIFT = IS_MAC ? '⇧' : 'Shift+'

/** Idle gap before an edit is written. Matches Focus mode, which writes the same table. */
const AUTOSAVE_MS = 1000

/**
 * The manuscript-prose half of an event card: the scene draft editor with its
 * own unsaved-draft state, live word count, revision history, focus mode, and
 * the "in the text but not on this scene" mention nudges. Split out of
 * EventCard so the card's metadata editing and the prose editing stay separate.
 */
/** A line of pasted text that the Page would make a scene or a chapter of. */
const PASTED_HEADING = /^#{1,2} \S/m

export function SceneDraftSection({
  event, characters, involvedIds, mentionedIds, onAddMention, onWordsChange,
  onShortcut, focusRequest = null, canAddAfter = false, openFocusNonce = null, focusKeys,
}: SceneDraftSectionProps) {
  const { worldId, id: eventId } = event
  const sceneText = useSceneText(event.id)
  const sceneRevisions = useSceneRevisions(event.id)
  // `draft === null` means "show the stored value"; a string means unsaved edits.
  const [draft, setDraft] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)

  /*
    The draft as of the latest render, readable from a timer or a cleanup —
    neither of which can see the `draft` closed over by the render that
    scheduled it.
  */
  const latestDraft = useRef<string | null>(null)
  // `draft` is the *prose*, never the header — see `headerDraft`.
  useEffect(() => { latestDraft.current = draft }, [draft])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /*
    The header the box is currently showing, and whether the caret is still
    inside it. The autosave applies the line as well as the prose now, and these
    two are what let it: a declaration is safe to act on once the writer has
    moved off it.
  */
  const pendingHeader = useRef<string>('')
  const caretInHeader = useRef(false)
  const applying = useRef<Promise<unknown>>(Promise.resolve())
  /*
    Names in the header that nothing in the world answers.

    Silence here would be the same fault `@@` had until this morning: the
    header is typed blind, with no picker to correct a spelling, so a typo
    would simply drop a character out of the scene with nothing said.
  */
  /*
    Split into people and place because they are answered differently, and the
    message used to claim otherwise: it said "the rest of the line was
    recorded" while an unmatched name was quietly taking somebody out of the
    scene. Nothing is recorded now when a name misses, so the sentence has to
    say which half was left alone.
  */
  // A line kept as typed on an earlier visit comes back with what it could not answer: see `keptHeaderLines`.
  const [headerUnknown, setHeaderUnknown] = useState<{ names: string[]; place: string | null; facts?: string[]; items?: string[]; people?: string[]; refused?: string[] }>(
    () => keptLine(eventId)?.unknown ?? { names: [], place: null },
  )
  /**
   * The header line *while the writer is editing it*, and null the rest of the
   * time — meaning "show the one drawn from the records".
   *
   * Two states rather than one because the box has to serve both directions at
   * once. Holding the whole textarea in `draft` meant that the moment somebody
   * typed a word of prose, a cast change made in the panel could no longer
   * reach the line: the stale draft won every render. Holding only the prose
   * meant their half-typed `@@Sal` snapped back to the rendered line on the
   * next keystroke.
   *
   * So the prose is `draft`, the header is this, and a record change reaches
   * the line whenever nobody is in the middle of typing over it.
   */
  const [headerDraft, setHeaderDraft] = useState<string | null>(() => keptLine(eventId)?.line ?? null)

  /*
    Everything "@" can name. The picker began as a character list; a writer
    naming a sword or a house had to leave the prose, make the record and come
    back, which is the errand the picker exists to spare people.
  */
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)
  const mapLayers = useMapLayers(worldId)
  /** A place as the header writes it: with its map's name where another place shares its name (`placeLabel`). */
  const labelOf = (id: string | null) => {
    const m = id ? markers.find((x) => x.id === id) : undefined
    return m ? placeLabel(m, markers, mapLayers) : null
  }

  const candidates = useMemo<MentionCandidate[]>(() => [
    ...characters.map((c) => ({ id: c.id, kind: 'character' as const, name: c.name, aliases: proseAliases(c) })),
    ...items.map((i) => ({ id: i.id, kind: 'item' as const, name: i.name })),
    ...markers.map((m) => ({ id: m.id, kind: 'location' as const, name: m.name })),
  ], [characters, items, markers])

  /*
    A location is a pin, so it only exists on a map: places may be added to
    maps and sub-maps that are already there, and nowhere else. That rule was
    already enforced — the picker withholds the *new place* row, the scene's
    Location chip does not appear, and a character's Current Location has
    nothing to offer — but the prompt above the box named "place" **always**
    (W19-9), so a brand-new world advertised a third option that was not in the
    list and gave no reason. One flag now decides both, which is what stops the
    text and the behaviour drifting apart again.
  */
  /*
    A place can always be made now, map or no map.

    This used to be `mapLayers.length > 0`, because a place *was* a pin and
    there was nowhere to put one. A place may now exist in the story before it
    exists on a map — so the writer of a book set in a kitchen and an office
    is no longer told, by silence, that their book has no places in it.
  */
  const canCreateLocation = true

  /** Record what was named: see `recordMention`. The card's own mention knows the cast it is editing. */
  /** Whoever the picker has made, each asked for the other names they go by: see `NewCharacterNames`. */
  const [newCharacters, setNewCharacters] = usePendingNames(`scene:${eventId}`)
  const [pastedHeadings, setPastedHeadings] = useState(false)
  /** Where a `:before` typed here went: the first scene (`knownBeforeNote`). */
  const [filedNote, setFiledNote] = useState<string | null>(null)
  async function handlePick(suggestion: MentionSuggestion, intent: MentionIntent) {
    const made = await recordMention(eventId, suggestion, intent, { markers, mapLayers, mention: onAddMention })
    if (made) setNewCharacters((all) => [...all.filter((c) => c.id !== made.id), made])
  }

  /*
    ── The scene header ──────────────────────────────────────────────────────

    `[#The Kitchen @@Wren @@Sal'ka]` sits at the top of the box, and is
    **rendered from this scene's own records rather than stored**. A change
    made anywhere — the cast panel, the Setting chip, `@@` in the prose —
    shows up here on the next paint, with no sync to drift, because there is
    only ever one copy of the fact.

    The prose in `sceneTexts` never contains it, so the five exports, the
    manuscript, search, find-and-replace, reading mode, the continuity checker
    and the word count that feeds the pacing curve all need to know nothing
    about it. A header cannot leak into a book it was never in.
  */
  // States and placements, for what the header draws beyond place and cast: who dies or comes back here, and what changes hands.
  const states = useLiveQuery(() => db.characterSnapshots.where('worldId').equals(event.worldId).toArray(), [event.worldId])
  const placementsHere = useLiveQuery(() => db.itemPlacements.where('eventId').equals(eventId).toArray(), [eventId])
  const fates = sceneFates(eventId, involvedIds, states ?? [], mentionedIds)
  const itemStates = useLiveQuery(() => db.itemSnapshots.where('worldId').equals(event.worldId).toArray(), [event.worldId])
  const drawnItems = sceneItems(eventId, event.involvedItemIds ?? [], states ?? [], placementsHere ?? [], itemStates ?? [])
  const facts = useLiveQuery(() => db.knowledgeFacts.where('worldId').equals(event.worldId).toArray(), [event.worldId])
  const revealsHere = useLiveQuery(() => db.knowledgeReveals.where('eventId').equals(eventId).toArray(), [eventId])
  const drawnFacts = sceneFacts(eventId, revealsHere ?? [], facts ?? [])
  const relationships = useLiveQuery(() => db.relationships.where('worldId').equals(event.worldId).toArray(), [event.worldId])
  const relationStatesHere = useLiveQuery(() => db.relationshipSnapshots.where('eventId').equals(eventId).toArray(), [eventId])
  const drawnRelations = sceneRelations(eventId, relationships ?? [], relationStatesHere ?? [])
  const placeStates = useLiveQuery(() => db.locationSnapshots.where('worldId').equals(event.worldId).toArray(), [event.worldId])
  const drawnPlaceStatus = scenePlaceStatus(eventId, event.locationMarkerId, placeStates ?? [])
  const names = (ids: string[]) => ids
    .map((id) => characters.find((c) => c.id === id)?.name)
    .filter((n): n is string => !!n)
  const headerRecords = {
    place: labelOf(event.locationMarkerId),
    ...(drawnPlaceStatus ? { placeStatus: drawnPlaceStatus } : {}),
    // Those on the phone are on the line too, marked `:phone`.
    characters: names([...involvedIds, ...(event.remoteCharacterIds ?? []), ...fates.elsewhere]),
    remote: names(event.remoteCharacterIds ?? []),
    // Who dies away from the scene, which tells of it: on the line too, marked `:dead elsewhere`.
    elsewhere: names(fates.elsewhere),
    dead: names(fates.dead),
    alive: names(fates.alive),
    ...headerNames(sceneNames(eventId, characters), involvedIds, (id) => characters.find((c) => c.id === id)?.name),
    items: headerItems(drawnItems, {
      item: (id) => items.find((i) => i.id === id)?.name,
      character: (id) => characters.find((c) => c.id === id)?.name,
      place: (id) => labelOf(id) ?? undefined,
    }),
    facts: headerFacts(drawnFacts, {
      fact: (id) => facts?.find((f) => f.id === id)?.title,
      character: (id) => characters.find((c) => c.id === id)?.name,
    }),
    relations: headerRelations(drawnRelations, relationships ?? [], (id) => characters.find((c) => c.id === id)?.name),
  }
  const headerLine = formatSceneHeader(headerRecords)
  const storedProse = sceneText?.text ?? ''
  const shownHeader = headerDraft ?? headerLine
  const sceneProseValue = draft ?? storedProse
  const sceneValue = shownHeader ? `${shownHeader}\n\n${sceneProseValue}` : sceneProseValue
  /*
    Everything below counts the *prose*, never the header.

    `[#The Kitchen @@Wren @@Sal'ka]` is five words by any split, and counting
    it would inflate the scene, the chapter, the pacing curve, the daily goal
    and the manuscript total — and would have the continuity checker reading
    the cast list as prose that names people.
  */
  const sceneProse = sceneProseValue
  const sceneWords = draft === null ? (sceneText?.wordCount ?? 0) : wordCount(sceneProse)
  /** What the Manuscript and every export will make of this text — one split,
   *  shared, so the number here cannot drift from the pages it describes. */
  const paragraphCount = splitParagraphs(sceneProse).length
  // Memoized: every card on the Timeline runs this, and it scans the prose for each place's and item's name too.
  const otherNames = useMemo(() => [...markers.map((m) => m.name), ...items.map((i) => i.name)], [markers, items])
  const mentions = useMemo(() => detectMentions(sceneProse, characters, otherNames), [sceneProse, characters, otherNames])
  // Nudge only for names that aren't accounted for as present OR mentioned.
  const untaggedMentions = mentions.filter(
    (m) => !involvedIds.includes(m.characterId) && !mentionedIds.includes(m.characterId),
  )

  useEffect(() => { onWordsChange?.(sceneWords) }, [sceneWords, onWordsChange])

  /**
   * Read the header back and make the records say what it says.
   *
   * **On blur, not on every keystroke.** A header is read as a declaration —
   * a name that has left it has left the scene — and applying that mid-word
   * would remove Wren the moment somebody typed `@@Wr`. Blur is the writer
   * saying they are done with the box.
   *
   * No header means the records are left exactly alone, rather than read as
   * an empty declaration: deleting the line is how somebody clears their
   * screen, not how they empty their cast. It reappears on the next paint.
   *
   * A name nothing answers is reported and otherwise ignored — it cannot
   * create a character, for the same reason `@@` cannot.
   */
  /**
   * Whether the line was fully understood — false leaves it on screen as typed.
   * One at a time: the autosave and the blur can both apply the line, and two
   * that each find somebody unrecorded here would each record them.
   */
  function applyHeader(header: string | null): Promise<boolean> {
    const next = applying.current.then(() => applyHeaderNow(header))
    applying.current = next.then(() => undefined, () => undefined)
    return next
  }
  async function applyHeaderNow(header: string | null): Promise<boolean> {
    /*
      No header clears the warning as well as changing nothing. Returning
      before this left the last accusation on screen describing an edit that
      had since been deleted — and deleting the line is the gesture the guide
      recommends for clearing your screen.
    */
    if (!header) { setHeaderUnknown({ names: [], place: null }); forgetLine(eventId); return true }
    // The rules themselves are `planHeader`'s, shared with the Manuscript's Page.
    // The facts from the store, not this render's copy: one just made from the note is not in that yet.
    const factList = await db.knowledgeFacts.where('worldId').equals(event.worldId).toArray()
    const relList = await db.relationships.where('worldId').equals(event.worldId).toArray()
    // The people from the store, not this render's copy: who is revealed as whom is what a reveal is checked against.
    const people = await db.characters.where('worldId').equals(event.worldId).toArray()
    // The items from the store as well: the card's copy is behind an item just made from the note.
    const worldItems = await db.items.where('worldId').equals(event.worldId).toArray()
    const worldPlaces = await db.locationMarkers.where('worldId').equals(event.worldId).toArray()
    const worldMaps = await db.mapLayers.where('worldId').equals(event.worldId).toArray()
    const plan = planHeader(header, { characters: people, places: worldPlaces, maps: worldMaps, items: worldItems, facts: factList, relationships: relList }, {
      involved: involvedIds, mentioned: mentionedIds, remote: event.remoteCharacterIds ?? [], place: event.locationMarkerId, placeStatus: drawnPlaceStatus, names: sceneNames(eventId, people), ...fates, items: drawnItems, facts: drawnFacts, relations: drawnRelations,
    })
    setHeaderUnknown(plan.unknown)
    if (planIsClean(plan)) forgetLine(eventId)
    else keepLine(eventId, { line: header, unknown: plan.unknown })
    const itemList = plan.items.involvedItemIds
    if (plan.update || itemList) await updateEvent(eventId, { ...plan.update, ...(itemList ? { involvedItemIds: itemList } : {}) })
    // The header says where and who: the cast is recorded there. Before the fates, so a death here is at the scene's place.
    await placeCastAtScene(event.worldId, eventId, plan.update?.involvedCharacterIds ?? involvedIds, plan.update ? plan.update.locationMarkerId : event.locationMarkerId, event.locationMarkerId)
    if (plan.fates.length) await recordFates(event.worldId, eventId, plan.fates)
    await recordItemChanges(event.worldId, eventId, plan.items)
    const { filedAt } = await recordFactChanges(event.worldId, eventId, plan.facts)
    if (filedAt) setFiledNote(knownBeforeNote((await db.events.get(filedAt))?.title))
    await recordRelationshipChanges(event.worldId, eventId, plan.relations)
    await recordPlaceStatus(event.worldId, eventId, plan.placeStatus)
    await recordIdentityChanges(eventId, plan.identity)
    return planIsClean(plan)
  }

  /** The note's answer for a place name several places answer to: set the scene at the one picked, then read the header again. */
  async function pickHeaderPlace(placeId: string) {
    await updateEvent(eventId, { locationMarkerId: placeId })
    if (await applyHeader(shownHeader)) setHeaderDraft(null)
  }
  /** The note's answer for a fact title: make the fact, then read the header again, so what it says of the fact is written. */
  async function makeHeaderFact(title: string) {
    await createHeaderFact(event.worldId, title)
    if (await applyHeader(shownHeader)) setHeaderDraft(null)
  }
  /** The same for an item: make it, then read the header again, so the Items line puts it in the scene. */
  async function makeHeaderItem(name: string) {
    await createHeaderItem(event.worldId, name)
    if (await applyHeader(shownHeader)) setHeaderDraft(null)
  }
  /** And for somebody a Relationships or Facts line names. */
  async function makeHeaderPerson(name: string) {
    await createHeaderCharacter(event.worldId, name)
    if (await applyHeader(shownHeader)) setHeaderDraft(null)
  }

  /**
   * The warning's answer for a place: make it, set the scene there, then read
   * the header again, as for a fact or an item — so what else the line names
   * that the world has not got stays kept and offered, and the rest is
   * written. It used to keep only unknown people, and dropped the rest (W5-1).
   */
  async function makeHeaderPlace(name: string) {
    await createHeaderPlace(eventId, name)
    if (await applyHeader(shownHeader)) setHeaderDraft(null)
  }

  async function saveScene() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const pending = latestDraft.current
    if (pending === null) return
    await setSceneText(event.worldId, event.id, pending)
    // Not an unconditional clear: anything typed while the write was in flight
    // is newer than what was stored, and clearing would discard it. See
    // `draftAfterSave`.
    setDraft((current) => draftAfterSave(current, pending))
  }

  /*
    Blur was the *only* way this box reached the database, and prose is the one
    thing in the app nothing else keeps a copy of. Reloading the tab, following
    a link, or closing a laptop mid-sentence stored nothing at all — while
    Writer's Notes one screen up debounced at 600ms and said "Auto-saved", and
    Focus mode autosaved at 1s and flushed on unmount. The box holding the novel
    was the only one that could lose it.

    Same shape as Focus mode, which writes the same table: debounce, then flush
    when this scene goes away — a collapsed card, a different scene, or leaving
    the chapter. `setSceneText` coalesces revisions over two minutes, so a
    burst of autosaves is still one entry in History.
  */
  function handleChange(next: string, caret: number) {
    const { header, body } = splitSceneDraft(next, shownHeader)
    // An empty string rather than null when the line has been deleted: null
    // means "render it from the records", which would put it straight back.
    setHeaderDraft(header ?? '')
    setDraft(body)
    latestDraft.current = body
    pendingHeader.current = header ?? ''
    const at = header ? next.indexOf(header) : -1
    caretInHeader.current = at >= 0 && caret >= at && caret <= at + header!.length
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      void saveScene()
      /*
        The prose autosave used to be the only half that ran, and it printed
        "Draft auto-saved" over a declaration it had not saved: blur was the
        only thing that ever applied the line, so a writer who typed a header,
        wrote the scene under it and reloaded kept every word of the prose and
        lost the cast and the setting. It looked like a scene that never had a
        header.

        Not while the caret is still in the line, though — that is somebody
        mid-word, and the point of applying on a beat rather than a keystroke
        is to not read `@@Wr` as a claim about who is in the room.
      */
      if (!caretInHeader.current) void applyHeader(pendingHeader.current)
    }, AUTOSAVE_MS)
  }

  /*
    Arrived at from Focus mode — the next scene, or one just made from there —
    so it opens in Focus mode, once its text is in: Focus mode takes the prose
    it starts with, and it would start an arriving scene empty.
  */
  const openedFocusFor = useRef<number | null>(null)
  useEffect(() => {
    if (!openFocusNonce || sceneText === undefined || openedFocusFor.current === openFocusNonce) return
    openedFocusFor.current = openFocusNonce
    setFocusOpen(true)
  }, [openFocusNonce, sceneText])

  useEffect(() => () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (latestDraft.current !== null) void setSceneText(worldId, eventId, latestDraft.current)
  }, [worldId, eventId])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
          <PenLine className="h-3 w-3" /> Scene Draft
        </span>
        <div className="flex items-center gap-2">
          {sceneRevisions.length > 0 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
              title="View earlier drafts of this scene"
            >
              <History className="h-3 w-3" /> History ({sceneRevisions.length})
            </button>
          )}
          <span className="text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {plural(sceneWords, 'word')}
          </span>
          {/*
            EV-6: Focus mode is the best writing surface in the app and it was
            announced by 10px of muted text, in a row of 10px muted text — the
            revision count and the word count read exactly the same, and two of
            those three are readouts rather than actions. It is a button now,
            and it is last so that the two readouts stay together and the one
            thing you can press is not among them.
          */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={() => { if (draft !== null) saveScene(); setFocusOpen(true) }}
            title="Write this scene distraction-free"
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" /> Focus
          </Button>
        </div>
      </div>
      {/*
        A scene's own box has no headings — they are the Page's — so `## ` pasted
        here stays text. Said, rather than left to be found in the word count.
      */}
      <div className="contents" onPasteCapture={(e) => setPastedHeadings(PASTED_HEADING.test(e.clipboardData.getData('text/plain')))}>
      <SceneDraftEditor
        value={sceneValue}
        onChange={handleChange}
        onBlur={() => {
          // Apply, then hand the line back to the records so it re-renders
          // from what was actually stored rather than from what was typed.
          caretInHeader.current = false
          setPastedHeadings(false)
          /*
            Handing the line back to the records is what makes it a view of
            them — but only once they can answer for all of it. A name this
            world does not have stays on screen as typed, because the repair is
            "fix one letter", and re-rendering erased the letter along with the
            name: the amber line named somebody who was no longer anywhere on
            screen, and the writer had to work out who was missing and retype
            them in full.
          */
          void applyHeader(shownHeader).then((clean) => { if (clean) setHeaderDraft(null) })
          void saveScene()
        }}
        candidates={candidates}
        canCreateLocation={canCreateLocation}
        headerRange={shownHeader ? { start: 0, end: shownHeader.length } : null}
        onPick={(s, intent) => { void handlePick(s, intent) }}
        placeholder={`Write or paste this scene's prose… (@ names a character${canCreateLocation ? ', item or place' : ' or item'}; @@ says who is here)`}
        ariaLabel="Scene prose"
        rows={5}
        onShortcut={onShortcut
          ? (s, caret) => onShortcut(s, shownHeader ? Math.max(0, caret - shownHeader.length - 2) : caret)
          : undefined}
        focusRequest={focusRequest}
        ready={sceneText !== undefined}
      />
      </div>
      {filedNote && (
        <p role="status" className="text-[11px] text-[hsl(var(--muted-foreground))]">{filedNote}</p>
      )}
      {pastedHeadings && (
        <p role="status" className="text-[11px] text-[hsl(var(--muted-foreground))]">
          The pasted <code>##</code> lines stay text in a scene. Pasted on the Page instead, each becomes a scene of its own.
        </p>
      )}
      {/*
        Says which of the two states the prose is actually in, rather than
        printing a permanent "Auto-saved" over text that has not been written
        yet — which is what Writer's Notes does, and what would have made this
        finding invisible instead of fixing it.

        Named "Draft" because Writer's Notes is on this same screen and says
        "Auto-saved" too: two identical labels, a column apart, about different
        boxes. That is ambiguous to a reader before it is ambiguous to a
        locator.
      */}
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {/*
          The save state is the live region, and only the save state. The
          paragraph count sits beside it *outside* `role="status"` on purpose:
          a live region announces every change, and a number that moves as you
          type would have a screen reader reciting the count on every pause. It
          is a thing to glance at, not a thing to be told.
        */}
        <span role="status">{draft === null ? 'Draft auto-saved' : 'Saving draft…'}</span>
        {/*
          W23-8: a **blank line** starts a new paragraph here, not a single
          Enter — the Manuscript and every export split on `\n\s*\n`, so
          "One line.⏎Second line." is read back, and written out, as one
          paragraph. The rule is right and should stay: prose pasted from a
          text file or a PDF arrives hard-wrapped at some column, and treating
          every newline as a break would turn it into one paragraph per line.

          What was wrong is that it was stated **nowhere** — the guide mentions
          paragraph preservation only for *manuscript import* — so a writer
          found out on reading their own book back, or on exporting it.

          Saying it as a **count of what you actually have** rather than as a
          rule: type one Enter, watch it still say one paragraph, and the rule
          explains itself without a tooltip. It appears only once there is
          prose, and only once there is more than nothing to count.
        */}
        {sceneWords > 0 && (
          <> · {paragraphCount} {paragraphCount === 1 ? 'paragraph' : 'paragraphs'}</>
        )}
        {/*
          Keys nobody can see are keys nobody uses, and these are the ones that
          keep a writer in the prose. Beside the save state rather than in a
          tooltip, and only where they work.
        */}
        {onShortcut && (
          <span className="hidden sm:inline">
            {' · '}<kbd className="font-sans">{MOD}{ALT}↓ ↑</kbd> next or previous scene
            {canAddAfter && <>{' · '}<kbd className="font-sans">{MOD}Enter</kbd> new scene after</>}
            {canAddAfter && <>{' · '}<kbd className="font-sans">{MOD}{SHIFT}Enter</kbd> split here</>}
          </span>
        )}
        {' · '}<HeaderCheatSheet />
      </p>

      {/*
        What the header named and the world does not have.

        The header is typed blind — there is no picker inside the brackets to
        correct a spelling — so without this a typo would simply drop somebody
        out of the scene and say nothing, which is exactly the fault `@@` had
        until this morning. It does not offer to create them: asserting that
        somebody is in the room is a claim about a person who exists.
      */}
      {/*
        The placeholder is the only place in the app that names the sigils, and a
        textarea shows one only while it is empty. A scene with any cast or any
        place is never empty now — the header is in the box — and the first-run
        guide puts your first character into your first scene, so the hint was
        invisible from the first moment a writer opened the box.

        So it is said here instead, under exactly the condition the placeholder
        used to appear under: no prose yet. It goes when the prose arrives, which
        is what the placeholder did.
      */}
      {sceneProse.trim() === '' && shownHeader !== '' && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          @ names a character, item or place; @@ says who is here.
        </p>
      )}

      {/* Kept across a reload, so only for somebody who still exists. */}
      {newCharacters.filter((c) => characters.some((x) => x.id === c.id)).map((c) => (
        <NewCharacterNames key={c.id} character={c} onDone={() => setNewCharacters((all) => all.filter((n) => n.id !== c.id))} />
      ))}

      {!planIsClean({ unknown: headerUnknown }) && (
        <p role="status" className="text-[11px] text-amber-400">
          {keptLineWarning(headerUnknown, {
            cast: involvedIds.flatMap((id) => characters.find((c) => c.id === id)?.name ?? []),
            place: labelOf(event.locationMarkerId),
          })}
          {/*
            Or the place is new, and the writer is naming it for the first time.
            Nothing is offered for a person: a name in a cast is far likelier to
            be misspelt than new, and the picker inside the brackets already
            offers to make somebody as it is typed. A place named in a header is
            as likely to be new as mistyped, and a writer who has no map should
            not have to leave the scene to make one. Made without a map: see
            `createHeaderPlace`.
          */}
          {headerUnknown.place !== null && (
            <>
              {' '}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
                onClick={() => { void makeHeaderPlace(headerUnknown.place!) }}
              >
                Create “{headerUnknown.place}” as a place
              </Button>
            </>
          )}
          {/* Several places answer to the Place line's name: setting the scene at one of them settles which. */}
          {placeChoices(headerUnknown).map((c) => (
            <Button
              key={c.id}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void pickHeaderPlace(c.id) }}
            >
              Set at “{c.label}”
            </Button>
          ))}
          {/* A fact title nothing answers, offered as a place is: as likely new as misspelt, and made only when asked. */}
          {(headerUnknown.facts ?? []).map((title) => (
            <Button
              key={title}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderFact(title) }}
            >
              Create “{title}” as a fact
            </Button>
          ))}
          {(headerUnknown.items ?? []).map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderItem(name) }}
            >
              Create “{name}” as an item
            </Button>
          ))}
          {(headerUnknown.people ?? []).map((name) => (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              className="ml-1 h-6 px-2 text-[11px] pointer-coarse:h-11"
              onClick={() => { void makeHeaderPerson(name) }}
            >
              Create “{name}” as a character
            </Button>
          ))}
        </p>
      )}

      {/*
        W-2: these chips used to put the character **in the scene**.

        The observation is "this name is in the text", and the cast is a larger
        claim — the map places those people, the Brief lists them, and the
        Character States panel asks what state each of them is in. The
        Continuity Checker makes exactly the same observation and answers it
        with `addMention`, after a writer's run took its old cast button
        seventeen times on a 1,489-word draft and gave a two-hander a cast of
        four, including a woman across the city and a dead man.

        A later run found the two disagreeing: the panel recorded a mention and
        the chip, six inches away on the same prose, recorded a presence. They
        make the same claim now, and the label says which.

        Being in the room stays a deliberate act on the scene card, which is
        where the cast picker already is.
      */}
      <NamedInTextField names={untaggedMentions} onAdd={onAddMention} />
      <SceneHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        eventId={event.id}
        currentText={sceneText?.text ?? ''}
      />
      {focusOpen && (
        <FocusMode
          worldId={event.worldId}
          eventId={event.id}
          title={event.title}
          header={formatSceneHeaderLine(headerRecords)}
          initialText={sceneText?.text ?? ''}
          onExit={() => setFocusOpen(false)}
          keys={focusKeys}
        />
      )}
    </div>
  )
}
