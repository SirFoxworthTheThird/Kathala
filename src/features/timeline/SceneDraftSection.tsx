import { useState, useEffect, useMemo, useRef } from 'react'
import { PenLine, History, Maximize2, Plus } from 'lucide-react'
import { wordCount, detectMentions } from '@/lib/manuscript'
import { useSceneText, setSceneText } from '@/db/hooks/useManuscript'
import { useSceneRevisions } from '@/db/hooks/useSceneRevisions'
import { SceneDraftEditor } from './SceneDraftEditor'
import { SceneHistoryDialog } from './SceneHistoryDialog'
import { FocusMode } from './FocusMode'
import type { Character, WorldEvent } from '@/types'
import { useItems, createItem } from '@/db/hooks/useItems'
import { createCharacter } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers, createLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { updateEvent } from '@/db/hooks/useTimeline'
import type { MentionCandidate, MentionSuggestion } from '@/lib/mentionPicker'
import { draftAfterSave } from '@/lib/draftHandoff'
import { Button } from '@/components/ui/button'
import { plural } from '@/lib/plural'

interface SceneDraftSectionProps {
  event: WorldEvent
  characters: Character[]
  involvedIds: string[]
  mentionedIds: string[]
  /** Add an in-text name to the on-stage cast. */
  onAddCharacter: (characterId: string) => void
  /** Add an in-text name to the referenced-but-absent list. */
  onAddMention: (characterId: string) => void
  /** Reports the current word count so the card header chip can stay live. */
  onWordsChange?: (words: number) => void
}

/** Idle gap before an edit is written. Matches Focus mode, which writes the same table. */
const AUTOSAVE_MS = 1000

/**
 * The manuscript-prose half of an event card: the scene draft editor with its
 * own unsaved-draft state, live word count, revision history, focus mode, and
 * the "in the text but not on this scene" mention nudges. Split out of
 * EventCard so the card's metadata editing and the prose editing stay separate.
 */
export function SceneDraftSection({
  event, characters, involvedIds, mentionedIds, onAddCharacter, onAddMention, onWordsChange,
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
  useEffect(() => { latestDraft.current = draft }, [draft])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /*
    Everything "@" can name. The picker began as a character list; a writer
    naming a sword or a house had to leave the prose, make the record and come
    back, which is the errand the picker exists to spare people.
  */
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)
  const mapLayers = useMapLayers(worldId)

  const candidates = useMemo<MentionCandidate[]>(() => [
    ...characters.map((c) => ({ id: c.id, kind: 'character' as const, name: c.name, aliases: c.aliases })),
    ...items.map((i) => ({ id: i.id, kind: 'item' as const, name: i.name })),
    ...markers.map((m) => ({ id: m.id, kind: 'location' as const, name: m.name })),
  ], [characters, items, markers])

  /**
   * Record what was named against this scene, creating the record first when
   * the row was an offer to create one.
   *
   * A **place** is set only when the scene has none: `locationMarkerId` is a
   * single field, so writing to it over an existing value would silently move
   * the scene somewhere else on the strength of a word in the prose. Naming a
   * second place in a scene is ordinary; relocating the scene is not.
   */
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
  const canCreateLocation = mapLayers.length > 0

  async function handlePick(suggestion: MentionSuggestion) {
    if (suggestion.type === 'create') {
      if (suggestion.kind === 'character') {
        const created = await createCharacter({ worldId, name: suggestion.name, description: '' })
        onAddMention(created.id)
        return
      }
      if (suggestion.kind === 'item') {
        const created = await createItem({
          worldId, name: suggestion.name, description: '', iconType: 'misc', tags: [],
        })
        await updateEvent(eventId, { involvedItemIds: [...new Set([...event.involvedItemIds, created.id])] })
        return
      }
      // A place is a pin, so it needs a map and a position. It goes at the
      // centre of the scene's own map where there is one, and of the world's
      // first map otherwise — somewhere findable, to be dragged where it
      // belongs. The row is not offered at all when there is no map.
      const home = markers.find((m) => m.id === event.locationMarkerId)
      const layer = mapLayers.find((l) => l.id === home?.mapLayerId) ?? mapLayers[0]
      if (!layer) return
      const created = await createLocationMarker({
        worldId, mapLayerId: layer.id, name: suggestion.name, description: '',
        x: Math.round(layer.imageWidth / 2), y: Math.round(layer.imageHeight / 2),
        iconType: 'landmark',
      })
      if (!event.locationMarkerId) await updateEvent(eventId, { locationMarkerId: created.id })
      return
    }

    if (suggestion.kind === 'character') { onAddMention(suggestion.id); return }
    if (suggestion.kind === 'item') {
      await updateEvent(eventId, { involvedItemIds: [...new Set([...event.involvedItemIds, suggestion.id])] })
      return
    }
    if (!event.locationMarkerId) await updateEvent(eventId, { locationMarkerId: suggestion.id })
  }

  const sceneValue = draft ?? sceneText?.text ?? ''
  const sceneWords = draft === null ? (sceneText?.wordCount ?? 0) : wordCount(sceneValue)
  const mentions = detectMentions(sceneValue, characters)
  // Nudge only for names that aren't accounted for as present OR mentioned.
  const untaggedMentions = mentions.filter(
    (m) => !involvedIds.includes(m.characterId) && !mentionedIds.includes(m.characterId),
  )

  useEffect(() => { onWordsChange?.(sceneWords) }, [sceneWords, onWordsChange])

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
  function handleChange(next: string) {
    setDraft(next)
    latestDraft.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void saveScene() }, AUTOSAVE_MS)
  }

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
        onBlur={saveScene}
        candidates={candidates}
        canCreateLocation={canCreateLocation}
        onPick={(s) => { void handlePick(s) }}
        placeholder={`Write or paste this scene's prose… (type @ to name a character${canCreateLocation ? ', item or place' : ' or item'}; word count feeds the pacing curve)`}
        ariaLabel="Scene prose"
        rows={5}
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
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]" role="status">
        {draft === null ? 'Draft auto-saved' : 'Saving draft…'}
      </p>
      {untaggedMentions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">In the text but not on this scene:</span>
          {untaggedMentions.map((m) => (
            <button
              key={m.characterId}
              onClick={() => onAddCharacter(m.characterId)}
              className="flex items-center gap-1 rounded-full border border-dashed border-[hsl(var(--border))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))] transition-colors"
              title={`${m.name} appears ${m.count}× — click to add to this scene`}
            >
              <Plus className="h-2.5 w-2.5" /> {m.name}
            </button>
          ))}
        </div>
      )}
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
          initialText={sceneText?.text ?? ''}
          onExit={() => setFocusOpen(false)}
        />
      )}
    </div>
  )
}
