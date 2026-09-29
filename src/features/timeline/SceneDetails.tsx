import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FolderInput, History, Trash2 } from 'lucide-react'
import type { WorldEvent } from '@/types'
import { deleteEvent, updateEvent } from '@/db/hooks/useTimeline'
import { useSceneText } from '@/db/hooks/useManuscript'
import { useSceneRevisions } from '@/db/hooks/useSceneRevisions'
import { detectMentions } from '@/lib/manuscript'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useItems } from '@/db/hooks/useItems'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useMotifs } from '@/db/hooks/useMotifs'
import { nextTension, parseInWorldDay, parseTravelDays } from '@/lib/sceneFields'
import { Textarea } from '@/components/ui/textarea'
import { Menu, MenuItem } from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  SettingField, TagsField, CastField, MentionsField, ThreadsField, MotifsField, ItemsField,
  PovField, TimeField, FlashbackField, BeatField, TensionField, StatusField, NamedInTextField,
} from './SceneFields'
import { SceneHistoryDialog } from './SceneHistoryDialog'
import { MoveSceneDialog } from './MoveSceneDialog'
import { bringIntoPanelView } from './panelScroll'

/** Idle gap before the description is written — the chapter panel's synopsis and notes wait as long. */
const SAVE_DELAY = 600

/**
 * The scene being written, beside the Page.
 *
 * Everything a scene's card holds but its prose: status, tension and point of
 * view; the description; where it happens, who is in it, who is named in it
 * and what is carried through it; and, folded away, its beat, time, flashback,
 * tags, threads and motifs. Before this, a writer drafting on the Page left for
 * Cards to mark a scene final or take somebody out of it.
 *
 * And what the card offers around them: the scene's earlier drafts, the
 * names its prose uses that it has not recorded, and — behind a menu, as on
 * the card — moving it to another chapter or deleting it.
 *
 * Every change is written as it is made, one step of undo each — there is no
 * Save here, as there is none for the prose beside it. The description, typed
 * rather than clicked, is written after a pause and a burst of typing is one
 * step. Place and cast are the records the Page's header line is drawn from,
 * so a change here shows on that line, and one typed there shows here.
 *
 * Keyed on the scene by its parent, so what is half-typed in one scene's
 * fields is never carried into the next.
 */
export function SceneDetails({ event }: { event: WorldEvent }) {
  const worldId = event.worldId
  const characters = useCharacters(worldId)
  const items = useItems(worldId)
  const markers = useAllLocationMarkers(worldId)
  const threads = usePlotThreads(worldId)
  const motifs = useMotifs(worldId)
  const [more, setMore] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const sceneText = useSceneText(event.id)
  const revisions = useSceneRevisions(event.id)
  const sectionRef = useRef<HTMLElement>(null)

  // Arriving at a scene brings its details into view, if the writer had scrolled the panel away from them.
  useEffect(() => { bringIntoPanelView(sectionRef.current) }, [])

  const set = (data: Partial<WorldEvent>) => { void updateEvent(event.id, data) }

  // ── The description: typed, so held while typing and written after a pause ──
  const [description, setDescription] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)
  function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (pending.current !== null) {
      void updateEvent(event.id, { description: pending.current }, { coalesce: true })
      pending.current = null
    }
  }
  function typeDescription(value: string) {
    setDescription(value)
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }
  // Leaving the scene, or the panel, writes what was typed rather than dropping it.
  useEffect(() => {
    const id = event.id
    return () => {
      if (timer.current) clearTimeout(timer.current)
      if (pending.current !== null) void updateEvent(id, { description: pending.current }, { coalesce: true })
    }
  }, [event.id])

  // ── Days: typed numbers, held here so a keystroke is not undone by the record catching up ──
  const [travelDays, setTravelDays] = useState<number | null>(event.travelDays ?? null)
  const [inWorldTime, setInWorldTime] = useState<number | null>(event.inWorldTime ?? null)

  const involvedIds = event.involvedCharacterIds
  const mentionedIds = event.mentionedCharacterIds ?? []
  const itemIds = event.involvedItemIds
  const threadIds = event.threadIds ?? []
  const motifIds = event.motifIds ?? []
  const present = characters.filter((c) => involvedIds.includes(c.id))
  const others = characters.filter((c) => !involvedIds.includes(c.id))
  /*
    Read from the saved prose, so a name typed on the page is offered here a
    moment later, once the page has written it — the draft beside a card reads
    what is in its box, which is the same text sooner.
  */
  const namedInText = detectMentions(sceneText?.text ?? '', characters)
    .filter((m) => !involvedIds.includes(m.characterId) && !mentionedIds.includes(m.characterId))
  const addMention = (id: string) => {
    // Somebody in the scene is not merely mentioned in it — the card's rule, for the same reason.
    if (!involvedIds.includes(id) && !mentionedIds.includes(id)) set({ mentionedCharacterIds: [...mentionedIds, id] })
  }
  const sceneName = event.title || 'this scene'

  return (
    <section
      ref={sectionRef}
      aria-label="This scene"
      className="flex flex-col gap-3 border-b border-[hsl(var(--border))] p-3"
    >
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">This scene</span>
          <h3 className="truncate text-sm font-semibold">{event.title || 'Untitled scene'}</h3>
        </div>
        {revisions.length > 0 && (
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            title="Earlier drafts of this scene"
          >
            <History className="h-3 w-3" aria-hidden="true" /> History ({revisions.length})
          </button>
        )}
        <Menu label={`More actions for “${sceneName}”`} triggerClassName="h-7 w-7">
          <MenuItem icon={FolderInput} label="Move to chapter…" onClick={() => setMoveOpen(true)} />
          <MenuItem icon={Trash2} label="Delete scene" danger onClick={() => setDeleteOpen(true)} />
        </Menu>
      </div>

      <StatusField value={event.status ?? 'draft'} onChange={(status) => set({ status })} />
      <TensionField value={event.tension ?? null} onPick={(level) => set({ tension: nextTension(event.tension ?? null, level) })} />
      {characters.length > 0 && (
        <PovField value={event.povCharacterId ?? null} present={present} others={others} onChange={(povCharacterId) => set({ povCharacterId })} />
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Description</span>
        <Textarea
          value={description ?? event.description}
          onChange={(e) => typeDescription(e.target.value)}
          onBlur={() => { flush(); setDescription(null) }}
          aria-label="Scene description"
          placeholder="What happens in this scene…"
          rows={2}
          className="text-sm"
        />
      </div>

      {markers.length > 0 && (
        <SettingField markers={markers} value={event.locationMarkerId} onChange={(locationMarkerId) => set({ locationMarkerId })} />
      )}
      <CastField
        present={present}
        available={others}
        onAdd={(id) => { if (!involvedIds.includes(id)) set({ involvedCharacterIds: [...involvedIds, id] }) }}
        onRemove={(id) => set({ involvedCharacterIds: involvedIds.filter((x) => x !== id) })}
      />
      <MentionsField
        mentioned={characters.filter((c) => mentionedIds.includes(c.id))}
        available={characters.filter((c) => !mentionedIds.includes(c.id) && !involvedIds.includes(c.id))}
        onAdd={addMention}
        onRemove={(id) => set({ mentionedCharacterIds: mentionedIds.filter((x) => x !== id) })}
      />
      <NamedInTextField names={namedInText} onAdd={addMention} />
      {items.length > 0 && (
        <ItemsField
          involved={items.filter((it) => itemIds.includes(it.id))}
          available={items.filter((it) => !itemIds.includes(it.id))}
          onAdd={(id) => { if (!itemIds.includes(id)) set({ involvedItemIds: [...itemIds, id] }) }}
          onRemove={(id) => set({ involvedItemIds: itemIds.filter((x) => x !== id) })}
        />
      )}

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="flex items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        {more ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        More about this scene
      </button>
      {more && (
        <div className="flex flex-col gap-3">
          <BeatField value={event.structureBeat ?? null} onChange={(structureBeat) => set({ structureBeat })} />
          <TimeField
            travelDays={travelDays}
            inWorldTime={inWorldTime}
            onTravelDays={(raw) => { const v = parseTravelDays(raw); setTravelDays(v); set({ travelDays: v }) }}
            onInWorldTime={(raw) => { const v = parseInWorldDay(raw); setInWorldTime(v); set({ inWorldTime: v }) }}
          />
          <FlashbackField value={event.isFlashback ?? false} onToggle={() => set({ isFlashback: !(event.isFlashback ?? false) })} />
          <TagsField tags={event.tags} onChange={(tags) => set({ tags })} />
          {threads.length > 0 && (
            <ThreadsField
              assigned={threads.filter((t) => threadIds.includes(t.id))}
              available={threads.filter((t) => !threadIds.includes(t.id))}
              onAdd={(id) => { if (!threadIds.includes(id)) set({ threadIds: [...threadIds, id] }) }}
              onRemove={(id) => set({ threadIds: threadIds.filter((x) => x !== id) })}
            />
          )}
          {motifs.length > 0 && (
            <MotifsField
              assigned={motifs.filter((m) => motifIds.includes(m.id))}
              available={motifs.filter((m) => !motifIds.includes(m.id))}
              onAdd={(id) => { if (!motifIds.includes(id)) set({ motifIds: [...motifIds, id] }) }}
              onRemove={(id) => set({ motifIds: motifIds.filter((x) => x !== id) })}
            />
          )}
        </div>
      )}

      <SceneHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} eventId={event.id} currentText={sceneText?.text ?? ''} />
      <MoveSceneDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        eventId={event.id}
        timelineId={event.timelineId}
        currentChapterId={event.chapterId}
        sceneName={sceneName}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${sceneName}"?`}
        onConfirm={() => deleteEvent(event.id)}
      />
    </section>
  )
}
