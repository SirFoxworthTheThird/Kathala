import { useState, useMemo } from 'react'
import { X, Link2, Plus, Trash2, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import {
  useTimelineRelationships,
  createTimelineRelationship,
  updateTimelineRelationship,
  deleteTimelineRelationship,
} from '@/db/hooks/useTimelineRelationships'
import { useWorldEvents, useWorldChapters } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useItems } from '@/db/hooks/useItems'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type {
  Timeline, TimelineRelationship, TimelineAnchor, TimelineSyncPoint, TimelineRelationshipType,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const REL_TYPE_LABELS: Record<TimelineRelationshipType, string> = {
  frame_narrative: 'Frame Narrative',
  historical_echo: 'Historical Echo',
  embedded_fiction: 'Embedded Fiction',
  alternate: 'Alternate',
}

const REL_TYPE_DESCRIPTIONS: Record<TimelineRelationshipType, string> = {
  frame_narrative:
    'One timeline narrates another. A character in the outer timeline tells the story of the inner timeline (e.g. Kvothe at the Inn).',
  historical_echo:
    'Two timelines share the same geography across different eras. Locations exist in both; documents can cross the boundary.',
  embedded_fiction:
    'A character in one timeline writes or tells a story that constitutes the other timeline (fairy tales, plays, prophecies).',
  alternate:
    'A branching alternate version: same starting conditions, different outcomes.',
}

const REL_TYPE_COLORS: Record<TimelineRelationshipType, string> = {
  frame_narrative: 'bg-blue-500/20 text-blue-400',
  historical_echo: 'bg-amber-500/20 text-amber-400',
  embedded_fiction: 'bg-purple-500/20 text-purple-400',
  alternate: 'bg-red-500/20 text-red-400',
}

const ANCHOR_KIND_LABELS: Record<string, string> = {
  character: 'Character',
  location: 'Location',
  document: 'Document / Item',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface EventOption { value: string; label: string }

type AnchorKind = 'character' | 'location' | 'document'

// ── Sync Point Row ────────────────────────────────────────────────────────────

function SyncPointRow({
  sp, innerOptions, outerOptions, onDelete,
}: {
  sp: TimelineSyncPoint
  innerOptions: EventOption[]
  outerOptions: EventOption[]
  onDelete: () => void
}) {
  const innerLabel = innerOptions.find((o) => o.value === sp.innerEventId)?.label ?? sp.innerEventId.slice(0, 8)
  const outerLabel = outerOptions.find((o) => o.value === sp.outerEventId)?.label ?? sp.outerEventId.slice(0, 8)
  return (
    <div className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs">
      <span className="flex-1 truncate text-[hsl(var(--foreground))]">{innerLabel}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <span className="flex-1 truncate text-[hsl(var(--foreground))]">{outerLabel}</span>
      <button
        onClick={onDelete}
        className="ml-1 text-[hsl(var(--muted-foreground))] hover:text-destructive transition-colors"
        title="Remove sync point"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Add Sync Point Form ───────────────────────────────────────────────────────

function AddSyncPointForm({
  innerOptions, outerOptions, onAdd,
}: {
  innerOptions: EventOption[]
  outerOptions: EventOption[]
  onAdd: (sp: TimelineSyncPoint) => void
}) {
  const [innerId, setInnerId] = useState('')
  const [outerId, setOuterId] = useState('')

  function submit() {
    if (!innerId || !outerId) return
    onAdd({ innerEventId: innerId, outerEventId: outerId })
    setInnerId('')
    setOuterId('')
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <Select value={innerId} onValueChange={setInnerId}>
        <SelectTrigger className="h-7 flex-1 text-xs">
          <SelectValue placeholder="Inner event…" />
        </SelectTrigger>
        <SelectContent>
          {innerOptions.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ArrowRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
      <Select value={outerId} onValueChange={setOuterId}>
        <SelectTrigger className="h-7 flex-1 text-xs">
          <SelectValue placeholder="Outer event…" />
        </SelectTrigger>
        <SelectContent>
          {outerOptions.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon" variant="outline" className="h-7 w-7 shrink-0"
        onClick={submit} disabled={!innerId || !outerId}
        title="Add sync point"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ── Relationship Card ─────────────────────────────────────────────────────────

interface CardProps {
  rel: TimelineRelationship
  timelines: Timeline[]
  allEvents: Array<{ id: string; timelineId: string; title: string; chapterId: string; sortOrder: number }>
  allChapters: Array<{ id: string; number: number }>
  characters: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string }>
  items: Array<{ id: string; name: string }>
}

function RelationshipCard({ rel, timelines, allEvents, allChapters, characters, locations, items }: CardProps) {
  const [expanded, setExpanded] = useState(false)
  const [anchorKind, setAnchorKind] = useState<AnchorKind>('character')
  const [anchorEntityId, setAnchorEntityId] = useState('')

  const sourceTimeline = timelines.find((t) => t.id === rel.sourceTimelineId)
  const targetTimeline = timelines.find((t) => t.id === rel.targetTimelineId)

  const chapterById = useMemo(() => new Map(allChapters.map((c) => [c.id, c])), [allChapters])

  const makeEventOptions = (timelineId: string): EventOption[] =>
    allEvents
      .filter((e) => e.timelineId === timelineId)
      .sort((a, b) => {
        const na = (chapterById.get(a.chapterId)?.number ?? 0) * 10000 + a.sortOrder
        const nb = (chapterById.get(b.chapterId)?.number ?? 0) * 10000 + b.sortOrder
        return na - nb
      })
      .map((e) => ({
        value: e.id,
        label: `Ch.${chapterById.get(e.chapterId)?.number ?? '?'} — ${e.title || '(untitled)'}`,
      }))

  const innerOptions = useMemo(
    () => makeEventOptions(rel.targetTimelineId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEvents, allChapters, rel.targetTimelineId]
  )
  const outerOptions = useMemo(
    () => makeEventOptions(rel.sourceTimelineId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEvents, allChapters, rel.sourceTimelineId]
  )

  const anchorEntityOptions = useMemo(() => {
    if (anchorKind === 'character') return characters.map((c) => ({ value: c.id, label: c.name }))
    if (anchorKind === 'location') return locations.map((l) => ({ value: l.id, label: l.name }))
    return items.map((i) => ({ value: i.id, label: i.name }))
  }, [anchorKind, characters, locations, items])

  function getAnchorEntityName(anchor: TimelineAnchor): string {
    if (anchor.kind === 'character') return characters.find((c) => c.id === anchor.entityId)?.name ?? '…'
    if (anchor.kind === 'location') return locations.find((l) => l.id === anchor.entityId)?.name ?? '…'
    return items.find((i) => i.id === anchor.entityId)?.name ?? '…'
  }

  async function handleDelete() {
    if (!confirm(`Delete the relationship "${rel.label || REL_TYPE_LABELS[rel.type]}"? This cannot be undone.`)) return
    await deleteTimelineRelationship(rel.id)
  }

  async function handleAddAnchor() {
    if (!anchorEntityId) return
    await updateTimelineRelationship(rel.id, { anchors: [...rel.anchors, { kind: anchorKind, entityId: anchorEntityId }] })
    setAnchorEntityId('')
  }

  async function handleRemoveAnchor(idx: number) {
    await updateTimelineRelationship(rel.id, { anchors: rel.anchors.filter((_, i) => i !== idx) })
  }

  async function handleAddSyncPoint(sp: TimelineSyncPoint) {
    await updateTimelineRelationship(rel.id, { syncPoints: [...rel.syncPoints, sp] })
  }

  async function handleRemoveSyncPoint(idx: number) {
    await updateTimelineRelationship(rel.id, { syncPoints: rel.syncPoints.filter((_, i) => i !== idx) })
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />}
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${REL_TYPE_COLORS[rel.type]}`}>
            {REL_TYPE_LABELS[rel.type]}
          </span>
          <span className="truncate text-xs text-[hsl(var(--foreground))] ml-1">
            {rel.label || `${sourceTimeline?.name ?? '?'} → ${targetTimeline?.name ?? '?'}`}
          </span>
        </button>
        <button
          onClick={handleDelete}
          className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-destructive transition-colors"
          title="Delete relationship"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Timeline pill row */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5 text-[10px] text-[hsl(var(--muted-foreground))]">
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{
            background: sourceTimeline?.color ? `${sourceTimeline.color}33` : undefined,
            color: sourceTimeline?.color,
          }}
        >
          {sourceTimeline?.name ?? 'Unknown'}
        </span>
        <ArrowRight className="h-2.5 w-2.5 shrink-0" />
        <span
          className="rounded px-1.5 py-0.5 font-medium"
          style={{
            background: targetTimeline?.color ? `${targetTimeline.color}33` : undefined,
            color: targetTimeline?.color,
          }}
        >
          {targetTimeline?.name ?? 'Unknown'}
        </span>
        {rel.anchors.length > 0 && (
          <span className="ml-auto">{rel.anchors.length} anchor{rel.anchors.length !== 1 ? 's' : ''}</span>
        )}
        {rel.type === 'frame_narrative' && rel.syncPoints.length > 0 && (
          <span>{rel.syncPoints.length} sync{rel.syncPoints.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-3 py-3 space-y-4">
          {rel.description && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{rel.description}</p>
          )}

          {/* Anchors */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">
              Anchors
            </p>
            {rel.anchors.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] italic mb-2">No anchors yet.</p>
            ) : (
              <div className="space-y-1 mb-2">
                {rel.anchors.map((anchor, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-[hsl(var(--muted-foreground))] shrink-0">{ANCHOR_KIND_LABELS[anchor.kind]}</span>
                    <span className="flex-1 font-medium truncate">{getAnchorEntityName(anchor)}</span>
                    <button
                      onClick={() => handleRemoveAnchor(idx)}
                      className="text-[hsl(var(--muted-foreground))] hover:text-destructive transition-colors"
                      title="Remove anchor"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Select value={anchorKind} onValueChange={(v) => { setAnchorKind(v as AnchorKind); setAnchorEntityId('') }}>
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="character" className="text-xs">Character</SelectItem>
                  <SelectItem value="location" className="text-xs">Location</SelectItem>
                  <SelectItem value="document" className="text-xs">Document</SelectItem>
                </SelectContent>
              </Select>
              <Select value={anchorEntityId} onValueChange={setAnchorEntityId}>
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {anchorEntityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon" variant="outline" className="h-7 w-7 shrink-0"
                onClick={handleAddAnchor} disabled={!anchorEntityId}
                title="Add anchor"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Sync Points — frame_narrative only */}
          {rel.type === 'frame_narrative' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                Sync Points
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2 leading-relaxed">
                When inner playback reaches the left event, the outer cursor snaps to the right event.
              </p>
              {rel.syncPoints.length > 0 && (
                <div className="space-y-1 mb-2">
                  {rel.syncPoints.map((sp, idx) => (
                    <SyncPointRow
                      key={idx}
                      sp={sp}
                      innerOptions={innerOptions}
                      outerOptions={outerOptions}
                      onDelete={() => handleRemoveSyncPoint(idx)}
                    />
                  ))}
                </div>
              )}
              {innerOptions.length === 0 || outerOptions.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] italic">
                  Add events to both timelines to create sync points.
                </p>
              ) : (
                <AddSyncPointForm
                  innerOptions={innerOptions}
                  outerOptions={outerOptions}
                  onAdd={handleAddSyncPoint}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── New Relationship Form ─────────────────────────────────────────────────────

function NewRelationshipForm({
  worldId, timelines, onDone,
}: {
  worldId: string
  timelines: Timeline[]
  onDone: () => void
}) {
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [type, setType] = useState<TimelineRelationshipType>('frame_narrative')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!sourceId || !targetId || sourceId === targetId) return
    setSaving(true)
    try {
      await createTimelineRelationship({
        worldId,
        sourceTimelineId: sourceId,
        targetTimelineId: targetId,
        type,
        anchors: [],
        syncPoints: [],
        label: label.trim(),
        description: description.trim(),
      })
      setSourceId('')
      setTargetId('')
      setLabel('')
      setDescription('')
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[hsl(var(--ring))] bg-[hsl(var(--background))] px-3 py-3 space-y-3">
      <p className="text-xs font-semibold text-[hsl(var(--foreground))]">New Relationship</p>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">Type</label>
        <Select value={type} onValueChange={(v) => setType(v as TimelineRelationshipType)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(REL_TYPE_LABELS) as TimelineRelationshipType[]).map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{REL_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-relaxed">{REL_TYPE_DESCRIPTIONS[type]}</p>
      </div>

      {/* Source → Target */}
      <div className="flex items-end gap-1.5">
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">
            Outer / Source
          </label>
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Timeline…" />
            </SelectTrigger>
            <SelectContent>
              {timelines.filter((t) => t.id !== targetId).map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 mb-1.5 text-[hsl(var(--muted-foreground))]" />
        <div className="flex-1 space-y-1">
          <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">
            Inner / Target
          </label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Timeline…" />
            </SelectTrigger>
            <SelectContent>
              {timelines.filter((t) => t.id !== sourceId).map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Label */}
      <div className="space-y-1">
        <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">
          Label <span className="normal-case font-normal">(optional)</span>
        </label>
        <Input
          className="h-8 text-xs"
          placeholder="e.g. Kvothe narrates his life"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider font-medium">
          Notes <span className="normal-case font-normal">(optional)</span>
        </label>
        <Input
          className="h-8 text-xs"
          placeholder="Any notes about this link…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm" variant="outline" className="flex-1"
          onClick={onDone} disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm" className="flex-1"
          disabled={!sourceId || !targetId || sourceId === targetId || saving}
          onClick={handleSubmit}
        >
          <Plus className="h-3.5 w-3.5" /> Create
        </Button>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface TimelineRelationshipPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  worldId: string
  timelines: Timeline[]
}

export function TimelineRelationshipPanel({
  open, onOpenChange, worldId, timelines,
}: TimelineRelationshipPanelProps) {
  const relationships = useTimelineRelationships(worldId)
  const allEvents = useWorldEvents(worldId)
  const allChapters = useWorldChapters(worldId)
  const characters = useCharacters(worldId)
  const locations = useAllLocationMarkers(worldId)
  const items = useItems(worldId)
  const [showNewForm, setShowNewForm] = useState(false)

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[3000] bg-black/30"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed right-0 top-0 z-[3001] flex h-screen w-96 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
          <Link2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-semibold">Timeline Relationships</span>
          <button
            className="ml-auto text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {relationships.length === 0 && !showNewForm && (
            <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))] italic">
              No relationships yet. Link timelines to model frame narratives, historical echoes, and more.
            </p>
          )}

          {relationships.map((rel) => (
            <RelationshipCard
              key={rel.id}
              rel={rel}
              timelines={timelines}
              allEvents={allEvents}
              allChapters={allChapters}
              characters={characters}
              locations={locations ?? []}
              items={items}
            />
          ))}

          {showNewForm ? (
            <NewRelationshipForm
              worldId={worldId}
              timelines={timelines}
              onDone={() => setShowNewForm(false)}
            />
          ) : (
            <Button
              size="sm" variant="outline" className="w-full"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Link Timelines
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
