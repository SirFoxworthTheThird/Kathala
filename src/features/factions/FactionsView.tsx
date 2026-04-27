import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, Trash2, Users, ChevronRight, Shield, Map as MapIcon, MapPin, Swords, Handshake, Minus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  useFactions, useFactionMemberships, useMembershipsForFaction,
  useFactionRelationships,
  createFaction, updateFaction, deleteFaction,
  createFactionMembership, updateFactionMembership, deleteFactionMembership,
  createFactionRelationship, updateFactionRelationship, deleteFactionRelationship,
} from '@/db/hooks/useFactions'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useEvents, useChapters, useTimelines } from '@/db/hooks/useTimeline'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import type { Faction, FactionMembership, FactionRelationship, FactionStance } from '@/types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#a16207',
]

// ── Membership row ────────────────────────────────────────────────────────────

function MembershipRow({
  membership, characters, allEvents, onDelete,
}: {
  membership: FactionMembership
  characters: ReturnType<typeof useCharacters>
  allEvents: ReturnType<typeof useEvents>
  onDelete: () => void
}) {
  const char = characters.find((c) => c.id === membership.characterId)
  const startEv = allEvents.find((e) => e.id === membership.startEventId)
  const endEv = allEvents.find((e) => e.id === membership.endEventId)
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!char) return null

  return (
    <div className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex-1 text-sm font-medium truncate">{char.name}</span>
        {!expanded && (membership.role || startEv || endEv) && (
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
            {membership.role && <span>{membership.role}</span>}
            {(startEv || endEv) && (
              <span>{membership.role ? ' · ' : ''}{startEv ? startEv.title : '…'} → {endEv ? endEv.title : 'ongoing'}</span>
            )}
          </span>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
        title="Remove member"
        description={`Remove ${char?.name ?? 'this character'} from the faction?`}
        onConfirm={onDelete}
      />

      {expanded && (
        <div className="border-t border-[hsl(var(--border))] px-3 pb-3 pt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Role</Label>
              <Input
                className="mt-1 h-7 text-xs"
                value={membership.role ?? ''}
                placeholder="e.g. Leader, Spy…"
                onChange={(e) => updateFactionMembership(membership.id, { role: e.target.value || null })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">From event</Label>
              <Select
                value={membership.startEventId ?? 'none'}
                onValueChange={(v) => updateFactionMembership(membership.id, { startEventId: v === 'none' ? null : v })}
              >
                <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Beginning</SelectItem>
                  {allEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title || e.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs">Until event</Label>
              <Select
                value={membership.endEventId ?? 'none'}
                onValueChange={(v) => updateFactionMembership(membership.id, { endEventId: v === 'none' ? null : v })}
              >
                <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ongoing</SelectItem>
                  {allEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title || e.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(startEv || endEv) && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {startEv ? `From: ${startEv.title}` : 'From: beginning'}
              {' · '}
              {endEv ? `Until: ${endEv.title}` : 'Ongoing'}
            </p>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              className="mt-1 text-xs resize-none"
              rows={2}
              value={membership.notes}
              placeholder="Notes about this membership…"
              onChange={(e) => updateFactionMembership(membership.id, { notes: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stance helpers ────────────────────────────────────────────────────────────

const STANCE_LABELS: Record<FactionStance, string> = {
  allied: 'Allied',
  neutral: 'Neutral',
  hostile: 'Hostile',
}

const STANCE_COLORS: Record<FactionStance, string> = {
  allied: 'text-emerald-400',
  neutral: 'text-[hsl(var(--muted-foreground))]',
  hostile: 'text-red-400',
}

function StanceIcon({ stance }: { stance: FactionStance }) {
  if (stance === 'allied') return <Handshake className="h-3.5 w-3.5" />
  if (stance === 'hostile') return <Swords className="h-3.5 w-3.5" />
  return <Minus className="h-3.5 w-3.5" />
}

// ── Relation row ──────────────────────────────────────────────────────────────

function RelationRow({
  rel, otherFaction, onDelete,
}: {
  rel: FactionRelationship
  otherFaction: Faction
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
      <div className="h-3 w-3 rounded-full shrink-0" style={{ background: otherFaction.color }} />
      <span className="flex-1 text-sm truncate">{otherFaction.name}</span>
      <Select
        value={rel.stance}
        onValueChange={(v) => updateFactionRelationship(rel.id, { stance: v as FactionStance })}
      >
        <SelectTrigger className={`h-6 w-24 text-[11px] gap-1 ${STANCE_COLORS[rel.stance]}`}>
          <span className="flex items-center gap-1">
            <StanceIcon stance={rel.stance} />
            {STANCE_LABELS[rel.stance]}
          </span>
        </SelectTrigger>
        <SelectContent>
          {(['allied', 'neutral', 'hostile'] as FactionStance[]).map((s) => (
            <SelectItem key={s} value={s} className={STANCE_COLORS[s]}>
              <span className="flex items-center gap-1.5">
                <StanceIcon stance={s} />
                {STANCE_LABELS[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={() => setConfirmDelete(true)}
        className="text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
        title="Remove relation"
        description={`Remove the relationship with "${otherFaction.name}"?`}
        onConfirm={onDelete}
      />
    </div>
  )
}

// ── Faction detail panel ──────────────────────────────────────────────────────

function FactionDetailPanel({
  faction, worldId, onClose,
}: {
  faction: Faction
  worldId: string
  onClose: () => void
}) {
  const [name, setName] = useState(faction.name)
  const [description, setDescription] = useState(faction.description)
  const [color, setColor] = useState(faction.color)
  const [tags, setTags] = useState<string[]>(faction.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const [addingRelation, setAddingRelation] = useState(false)

  const memberships = useMembershipsForFaction(faction.id)
  const allFactions = useFactions(worldId)
  const allRelations = useFactionRelationships(worldId)
  const myRelations = allRelations.filter(
    (r) => r.factionAId === faction.id || r.factionBId === faction.id
  )
  const relatedFactionIds = new Set(myRelations.map((r) =>
    r.factionAId === faction.id ? r.factionBId : r.factionAId
  ))
  const unrelatedFactions = allFactions.filter(
    (f) => f.id !== faction.id && !relatedFactionIds.has(f.id)
  )
  const territories = useLiveQuery(
    () => db.mapRegions.where('factionId').equals(faction.id).toArray(),
    [faction.id],
    []
  )
  const territoryLocations = useLiveQuery(
    () => db.locationMarkers.where('factionId').equals(faction.id).toArray(),
    [faction.id],
    []
  )
  const allLayers = useMapLayers(worldId)
  const layerById = new Map(allLayers.map((l) => [l.id, l]))
  const characters = useCharacters(worldId)
  const timelines = useTimelines(worldId)
  const firstTimelineId = timelines[0]?.id ?? null
  const chapters = useChapters(firstTimelineId)
  const firstChapterId = chapters[0]?.id ?? null
  const allEvents = useEvents(firstChapterId)

  const memberIds = new Set(memberships.map((m) => m.characterId))
  const nonMembers = characters.filter((c) => !memberIds.has(c.id))

  async function save() {
    await updateFaction(faction.id, { name: name.trim(), description: description.trim(), color })
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) { setTagInput(''); return }
    const next = [...tags, t]
    setTags(next)
    setTagInput('')
    updateFaction(faction.id, { tags: next })
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    updateFaction(faction.id, { tags: next })
  }

  async function handleDelete() {
    await deleteFaction(faction.id)
    onClose()
  }

  async function addRelation(otherFactionId: string) {
    await createFactionRelationship({
      worldId,
      factionAId: faction.id,
      factionBId: otherFactionId,
      stance: 'neutral',
      notes: '',
    })
    setAddingRelation(false)
  }

  async function addMember(characterId: string) {
    await createFactionMembership({
      worldId,
      factionId: faction.id,
      characterId,
      role: null,
      startEventId: null,
      endEventId: null,
      notes: '',
    })
    setAddingMember(false)
  }

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="h-3 w-3 rounded-full shrink-0" style={{ background: faction.color }} />
        <span className="flex-1 text-sm font-semibold truncate">{faction.name}</span>
        {savedFlash && (
          <span className="text-[10px] text-emerald-400 shrink-0">Saved</span>
        )}
        <button
          onClick={onClose}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {/* Edit fields */}
        <div className="flex flex-col gap-3">
          <div>
            <Label>Name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea className="mt-1 resize-none text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={save} />
          </div>
          <div>
            <Label>Colour</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); updateFaction(faction.id, { color: c }); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500) }}
                />
              ))}
              <input
                type="color"
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                onBlur={() => save()}
                title="Custom colour"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <Label>Tags</Label>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded bg-[hsl(var(--border))] px-2 py-0.5 text-xs text-[hsl(var(--foreground))]">
                {t}
                <button onClick={() => removeTag(t)} className="text-[hsl(var(--muted-foreground))] hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <Input
              className="h-6 w-24 text-xs"
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
              }}
              onBlur={addTag}
            />
          </div>
        </div>

        {/* Members */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Members ({memberships.length})
            </span>
          </div>

          {memberships.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No members yet.</p>
          )}

          <div className="flex flex-col gap-1.5">
            {memberships.map((m) => (
              <MembershipRow
                key={m.id}
                membership={m}
                characters={characters}
                allEvents={allEvents ?? []}
                onDelete={() => deleteFactionMembership(m.id)}
              />
            ))}
          </div>

          {addingMember ? (
            <Select onValueChange={addMember}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="Choose character…" />
              </SelectTrigger>
              <SelectContent>
                {nonMembers.length === 0 ? (
                  <SelectItem value="__none__" disabled>All characters are members</SelectItem>
                ) : (
                  nonMembers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setAddingMember(true)}
              disabled={nonMembers.length === 0}
            >
              <Plus className="h-3.5 w-3.5" /> Add member
            </Button>
          )}
        </div>

        {/* Relations */}
        {allFactions.length > 1 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Relations ({myRelations.length})
              </span>
            </div>

            {myRelations.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No inter-faction relations defined.</p>
            )}

            <div className="flex flex-col gap-1.5">
              {myRelations.map((rel) => {
                const otherId = rel.factionAId === faction.id ? rel.factionBId : rel.factionAId
                const other = allFactions.find((f) => f.id === otherId)
                if (!other) return null
                return (
                  <RelationRow
                    key={rel.id}
                    rel={rel}
                    otherFaction={other}
                    onDelete={() => deleteFactionRelationship(rel.id)}
                  />
                )
              })}
            </div>

            {addingRelation ? (
              <Select onValueChange={addRelation}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Choose faction…" />
                </SelectTrigger>
                <SelectContent>
                  {unrelatedFactions.length === 0 ? (
                    <SelectItem value="__none__" disabled>All factions have a relation</SelectItem>
                  ) : (
                    unrelatedFactions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                          {f.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => setAddingRelation(true)}
                disabled={unrelatedFactions.length === 0}
              >
                <Plus className="h-3.5 w-3.5" /> Add relation
              </Button>
            )}
          </div>
        )}

        {/* Territories */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <MapIcon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Territories ({territories.length + territoryLocations.length})
            </span>
          </div>

          {territories.length === 0 && territoryLocations.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              No regions or locations assigned — open a region or location on the map and set its owning faction.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {territories.map((r) => {
                const layer = layerById.get(r.mapLayerId)
                return (
                  <div key={r.id} className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: r.fillColor }} />
                    <span className="flex-1 text-sm truncate">{r.name}</span>
                    {layer && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{layer.name}</span>
                    )}
                  </div>
                )
              })}
              {territoryLocations.map((m) => {
                const layer = layerById.get(m.mapLayerId)
                return (
                  <div key={m.id} className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2">
                    <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <span className="flex-1 text-sm truncate">{m.name}</span>
                    {layer && (
                      <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">{layer.name}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--border))] p-3">
        <Button
          variant="destructive"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete Faction
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${faction.name}"?`}
        description="All memberships in this faction will also be removed."
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ── Factions View ─────────────────────────────────────────────────────────────

export default function FactionsView() {
  const { worldId } = useParams<{ worldId: string }>()
  const factions = useFactions(worldId ?? null)
  const allMemberships = useFactionMemberships(worldId ?? null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const selectedFaction = factions.find((f) => f.id === selectedId) ?? null

  // Count members per faction
  const memberCountById = new Map<string, number>()
  for (const m of allMemberships) {
    memberCountById.set(m.factionId, (memberCountById.get(m.factionId) ?? 0) + 1)
  }

  async function handleCreate() {
    if (!newName.trim() || !worldId) return
    const f = await createFaction({
      worldId,
      name: newName.trim(),
      description: '',
      color: PRESET_COLORS[factions.length % PRESET_COLORS.length],
      coverImageId: null,
      tags: [],
    })
    setNewName('')
    setCreating(false)
    setSelectedId(f.id)
  }

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-6 py-4">
          <Shield className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
          <h1 className="text-lg font-semibold">Factions</h1>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">({factions.length})</span>
          <div className="ml-auto">
            {creating ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-48 text-sm"
                  placeholder="Faction name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate()
                    if (e.key === 'Escape') { setCreating(false); setNewName('') }
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName('') }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New Faction
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto p-6">
          {factions.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No factions yet"
              description="Factions are organizations characters can belong to — kingdoms, guilds, cults. Optional, but powerful for political stories."
              action={
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Add Faction
                </Button>
              }
              className="h-full"
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {factions.map((faction) => {
                const count = memberCountById.get(faction.id) ?? 0
                const isSelected = faction.id === selectedId
                return (
                  <button
                    key={faction.id}
                    onClick={() => setSelectedId(isSelected ? null : faction.id)}
                    className={`rounded-lg border p-4 text-left transition-colors hover:border-[hsl(var(--ring)/0.4)] ${
                      isSelected
                        ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent)/0.15)]'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-4 w-4 rounded-full shrink-0 shadow-sm"
                        style={{ background: faction.color }}
                      />
                      <span className="font-semibold text-sm truncate">{faction.name}</span>
                    </div>
                    {faction.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 mb-2">
                        {faction.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                      <Users className="h-3 w-3" />
                      <span>{count} member{count !== 1 ? 's' : ''}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedFaction ? (
        <FactionDetailPanel
          key={selectedFaction.id}
          faction={selectedFaction}
          worldId={worldId ?? ''}
          onClose={() => setSelectedId(null)}
        />
      ) : factions.length > 0 ? (
        <div className="flex w-80 shrink-0 items-center justify-center border-l border-[hsl(var(--border))]">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a faction to view its details</p>
        </div>
      ) : null}
    </div>
  )
}

