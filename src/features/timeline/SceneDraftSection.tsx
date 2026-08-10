import { useState, useEffect } from 'react'
import { PenLine, History, Maximize2, Plus } from 'lucide-react'
import { wordCount, detectMentions } from '@/lib/manuscript'
import { useSceneText, setSceneText } from '@/db/hooks/useManuscript'
import { useSceneRevisions } from '@/db/hooks/useSceneRevisions'
import { SceneDraftEditor } from './SceneDraftEditor'
import { SceneHistoryDialog } from './SceneHistoryDialog'
import { FocusMode } from './FocusMode'
import type { Character, WorldEvent } from '@/types'
import { draftAfterSave } from '@/lib/draftHandoff'

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

/**
 * The manuscript-prose half of an event card: the scene draft editor with its
 * own unsaved-draft state, live word count, revision history, focus mode, and
 * the "in the text but not on this event" mention nudges. Split out of
 * EventCard so the card's metadata editing and the prose editing stay separate.
 */
export function SceneDraftSection({
  event, characters, involvedIds, mentionedIds, onAddCharacter, onAddMention, onWordsChange,
}: SceneDraftSectionProps) {
  const sceneText = useSceneText(event.id)
  const sceneRevisions = useSceneRevisions(event.id)
  // `draft === null` means "show the stored value"; a string means unsaved edits.
  const [draft, setDraft] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)

  const sceneValue = draft ?? sceneText?.text ?? ''
  const sceneWords = draft === null ? (sceneText?.wordCount ?? 0) : wordCount(sceneValue)
  const mentions = detectMentions(sceneValue, characters)
  // Nudge only for names that aren't accounted for as present OR mentioned.
  const untaggedMentions = mentions.filter(
    (m) => !involvedIds.includes(m.characterId) && !mentionedIds.includes(m.characterId),
  )

  useEffect(() => { onWordsChange?.(sceneWords) }, [sceneWords, onWordsChange])

  async function saveScene() {
    const pending = draft
    if (pending === null) return
    await setSceneText(event.worldId, event.id, pending)
    // Not an unconditional clear: anything typed while the write was in flight
    // is newer than what was stored, and clearing would discard it. See
    // `draftAfterSave`.
    setDraft((current) => draftAfterSave(current, pending))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide flex items-center gap-1">
          <PenLine className="h-3 w-3" /> Scene Draft
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (draft !== null) saveScene(); setFocusOpen(true) }}
            className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            title="Write this scene distraction-free"
          >
            <Maximize2 className="h-3 w-3" /> Focus
          </button>
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
            {sceneWords} {sceneWords === 1 ? 'word' : 'words'}
          </span>
        </div>
      </div>
      <SceneDraftEditor
        value={sceneValue}
        onChange={setDraft}
        onBlur={saveScene}
        characters={characters}
        onMention={onAddMention}
        placeholder="Write or paste this scene's prose… (type @ to mention a character; word count feeds the pacing curve)"
        rows={5}
      />
      {untaggedMentions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">In the text but not on this event:</span>
          {untaggedMentions.map((m) => (
            <button
              key={m.characterId}
              onClick={() => onAddCharacter(m.characterId)}
              className="flex items-center gap-1 rounded-full border border-dashed border-[hsl(var(--border))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))] transition-colors"
              title={`${m.name} appears ${m.count}× — click to add to this event`}
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
