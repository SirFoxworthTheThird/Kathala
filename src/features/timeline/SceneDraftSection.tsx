import { proseAliases } from '@/lib/characterNames'
import { useState, useEffect, useMemo, useRef } from 'react'
import { PenLine, History, Maximize2 } from 'lucide-react'
import { wordCount, detectMentions } from '@/lib/manuscript'
import { formatSceneHeader, planHeader, planIsClean, splitSceneDraft } from '@/lib/sceneHeader'
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
import { keptLine, keepLine, forgetLine } from '@/lib/keptHeaderLines'
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
  const [headerUnknown, setHeaderUnknown] = useState<{ names: string[]; place: string | null }>(
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
  async function handlePick(suggestion: MentionSuggestion, intent: MentionIntent) {
    await recordMention(eventId, suggestion, intent, { markers, mapLayers, mention: onAddMention })
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
  const headerLine = formatSceneHeader({
    place: markers.find((m) => m.id === event.locationMarkerId)?.name ?? null,
    characters: involvedIds
      .map((id) => characters.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n),
  })
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
  const mentions = detectMentions(sceneProse, characters)
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
  /** Whether the line was fully understood — false leaves it on screen as typed. */
  async function applyHeader(header: string | null): Promise<boolean> {
    /*
      No header clears the warning as well as changing nothing. Returning
      before this left the last accusation on screen describing an edit that
      had since been deleted — and deleting the line is the gesture the guide
      recommends for clearing your screen.
    */
    if (!header) { setHeaderUnknown({ names: [], place: null }); forgetLine(eventId); return true }
    // The rules themselves are `planHeader`'s, shared with the Manuscript's Page.
    const plan = planHeader(header, { characters, places: markers }, {
      involved: involvedIds, mentioned: mentionedIds, place: event.locationMarkerId,
    })
    setHeaderUnknown(plan.unknown)
    if (planIsClean(plan)) forgetLine(eventId)
    else keepLine(eventId, { line: header, unknown: plan.unknown })
    if (plan.update) await updateEvent(eventId, plan.update)
    return planIsClean(plan)
  }

  /**
   * The warning's answer for a place: make it, set the scene there, and let the
   * line go back to being drawn from the records — unless it still names
   * somebody nobody answers, in which case it stays as typed for that.
   */
  async function makeHeaderPlace(name: string) {
    await createHeaderPlace(eventId, name)
    setHeaderUnknown((u) => ({ ...u, place: null }))
    if (headerUnknown.names.length === 0) { setHeaderDraft(null); forgetLine(eventId) }
    else {
      const kept = keptLine(eventId)
      if (kept) keepLine(eventId, { ...kept, unknown: { names: headerUnknown.names, place: null } })
    }
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
      <SceneDraftEditor
        value={sceneValue}
        onChange={handleChange}
        onBlur={() => {
          // Apply, then hand the line back to the records so it re-renders
          // from what was actually stored rather than from what was typed.
          caretInHeader.current = false
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

      {(headerUnknown.names.length > 0 || headerUnknown.place !== null) && (
        <p role="status" className="text-[11px] text-amber-400">
          Nothing in this world is called{' '}
          {[...headerUnknown.names, ...(headerUnknown.place ? [headerUnknown.place] : [])]
            .map((n) => `“${n}”`).join(' or ')}
          {' '}— {headerUnknown.names.length > 0 && headerUnknown.place !== null
            ? 'the scene was left as it was'
            : headerUnknown.names.length > 0
              ? 'the cast was left as it was'
              : 'the setting was left as it was'}, so the spelling can be
          fixed on the line.
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
          header={headerLine}
          initialText={sceneText?.text ?? ''}
          onExit={() => setFocusOpen(false)}
          keys={focusKeys}
        />
      )}
    </div>
  )
}
