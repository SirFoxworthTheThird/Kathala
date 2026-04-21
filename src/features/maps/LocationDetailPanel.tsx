import { useState } from 'react'
import { X, Trash2, Map, Link, Upload, Users, Plus, UserMinus, Package, BookOpen, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLocationMarker, updateLocationMarker, deleteLocationMarker } from '@/db/hooks/useLocationMarkers'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useBestSnapshots, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { useTimelines, useChapters, createTimeline, createChapter } from '@/db/hooks/useTimeline'
import { useItems } from '@/db/hooks/useItems'
import { useLocationItemPlacements, useWorldItemPlacements, placeItemAtLocation, removeItemPlacement } from '@/db/hooks/useItemPlacements'
import { useLocationSnapshot, upsertLocationSnapshot } from '@/db/hooks/useLocationSnapshots'
import { useItemSnapshot, upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { useAppStore } from '@/store'
import { UploadMapDialog } from './UploadMapDialog'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { RelatedLoreSection } from '@/features/lore/RelatedLoreSection'
import { useFactions } from '@/db/hooks/useFactions'
import type { Item } from '@/types'

const ITEM_CONDITIONS = ['intact', 'damaged', 'broken', 'lost', 'used', 'depleted']
const CONDITION_COLORS: Record<string, string> = {
  intact: '#34d399', damaged: '#fbbf24', broken: '#f87171',
  lost: '#94a3b8', used: '#fb923c', depleted: '#94a3b8',
}

function LocationItemRow({ item, eventId, worldId, onRemove }: {
  item: Item
  eventId: string
  worldId: string
  onRemove: () => void
}) {
  const snap = useItemSnapshot(item.id, worldId, eventId)
  const [expanded, setExpanded] = useState(false)
  const condition = snap?.condition ?? 'intact'

  return (
    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <PortraitImage
          imageId={item.imageId}
          fallbackIcon={Package}
          className="h-5 w-5 rounded object-cover shrink-0"
          fallbackClassName="h-5 w-5 rounded shrink-0"
        />
        <span className="flex-1 truncate text-xs font-medium">{item.name}</span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: CONDITION_COLORS[condition] ?? '#94a3b8' }}
          title={condition}
        />
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          title="Edit item state"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onRemove}
          className="text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
          title="Remove from location"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1.5 border-t border-[hsl(var(--border))] px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Condition</span>
            <select
              className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--foreground))]"
              value={condition}
              onChange={(e) =>
                upsertItemSnapshot({
                  worldId,
                  itemId: item.id,
                  eventId,
                  condition: e.target.value,
                  notes: snap?.notes ?? '',
                })
              }
            >
              {ITEM_CONDITIONS.map((c) => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-1 text-[10px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
            rows={2}
            placeholder="Chapter notes..."
            value={snap?.notes ?? ''}
            onChange={(e) =>
              upsertItemSnapshot({
                worldId,
                itemId: item.id,
                eventId,
                condition: snap?.condition ?? 'intact',
                notes: e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

interface LocationDetailPanelProps {
  markerId: string
  worldId: string
  onClose: () => void
  onDrillDown: (mapLayerId: string) => void
}

export function LocationDetailPanel({ markerId, worldId, onClose, onDrillDown }: LocationDetailPanelProps) {
  const marker = useLocationMarker(markerId)
  const allLayers = useMapLayers(worldId)
  const characters = useCharacters(worldId)
  const { setSelectedLocationMarkerId, activeEventId, setActiveEventId } = useAppStore()
  const allSnapshots = useBestSnapshots(worldId, activeEventId)
  const timelines = useTimelines(worldId)
  const firstTimelineId = timelines[0]?.id ?? null
  const chapters = useChapters(firstTimelineId)
  const allItems = useItems(worldId)
  const itemsHere = useLocationItemPlacements(markerId, activeEventId)
  const allPlacements = useWorldItemPlacements(worldId)
  const locationSnap = useLocationSnapshot(markerId, worldId, activeEventId)
  const factions = useFactions(worldId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploadSubMapOpen, setUploadSubMapOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [addingChar, setAddingChar] = useState(false)
  const [creatingChapter, setCreatingChapter] = useState(false)
  const [newChapterTitle, setNewChapterTitle] = useState('')

  if (!marker) return null

  // Characters currently at this location (last-known snapshot at the active event)
  const snapByChar = new globalThis.Map(allSnapshots.map((s): [string, typeof s] => [s.characterId, s]))
  const charsHere = characters.filter(
    (c) => snapByChar.get(c.id)?.currentLocationMarkerId === markerId
  )

  const charsElsewhere = characters.filter((c) => !charsHere.find((h) => h.id === c.id))

  async function assignCharacter(characterId: string) {
    if (!activeEventId) return
    // Use the last-known state as a base (already resolved by useBestSnapshots)
    const existing = snapByChar.get(characterId)
    await upsertSnapshot({
      worldId,
      characterId,
      eventId: activeEventId,
      isAlive: existing?.isAlive ?? true,
      currentLocationMarkerId: markerId,
      currentMapLayerId: marker!.mapLayerId,
      inventoryItemIds: existing?.inventoryItemIds ?? [],
      inventoryNotes: existing?.inventoryNotes ?? '',
      statusNotes: existing?.statusNotes ?? '',
      travelModeId: existing?.travelModeId ?? null,
    })
    setAddingChar(false)
  }

  async function removeCharacter(characterId: string) {
    if (!activeEventId) return
    const existing = snapByChar.get(characterId)
    if (!existing) return
    await upsertSnapshot({
      ...existing,
      eventId: activeEventId,
      currentLocationMarkerId: null,
      currentMapLayerId: null,
    })
  }

  async function handleCreateChapter() {
    if (!newChapterTitle.trim()) return
    let timelineId = firstTimelineId
    if (!timelineId) {
      const tl = await createTimeline({ worldId, name: 'Main Timeline', description: '', color: '#60a5fa' })
      timelineId = tl.id
    }
    const ch = await createChapter({
      worldId,
      timelineId,
      number: chapters.length + 1,
      title: newChapterTitle.trim(),
      synopsis: '',
    })
    setActiveEventId(ch.id)
    setCreatingChapter(false)
    setNewChapterTitle('')
  }

  function startEdit() {
    setName(marker!.name)
    setDescription(marker!.description)
    setEditing(true)
  }

  async function saveEdit() {
    await updateLocationMarker(markerId, { name: name.trim(), description: description.trim() })
    setEditing(false)
  }

  async function handleDelete() {
    await deleteLocationMarker(markerId)
    setSelectedLocationMarkerId(null)
    onClose()
  }

  async function handleLinkSubMap(layerId: string) {
    await updateLocationMarker(markerId, { linkedMapLayerId: layerId === 'none' ? null : layerId })
  }

  const otherLayers = allLayers.filter((l) => l.id !== marker.mapLayerId)

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Location</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close location panel" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">

        {/* Name / edit */}
        {editing ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={!name.trim()}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="font-semibold text-[hsl(var(--foreground))]">{marker.name}</h3>
              <p className="mt-0.5 text-xs capitalize text-[hsl(var(--muted-foreground))]">{marker.iconType}</p>
              {marker.description && (
                <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{marker.description}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
          </>
        )}

        {/* ── Characters ── */}
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Characters here
          </Label>

          {/* No chapter selected → prompt */}
          {!activeEventId && (
            <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-3 flex flex-col gap-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Select an event to place characters, or create one now:
              </p>
              {chapters.length > 0 && (
                <Select onValueChange={setActiveEventId}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Select chapter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {chapters.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>Ch. {ch.number} — {ch.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {creatingChapter ? (
                <div className="flex gap-1.5">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Chapter title..."
                    value={newChapterTitle}
                    onChange={(e) => setNewChapterTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateChapter()}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateChapter} disabled={!newChapterTitle.trim()}>
                    Add
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCreatingChapter(true)}>
                  <Plus className="h-3 w-3" /> New chapter
                </Button>
              )}
            </div>
          )}

          {/* Characters already here */}
          {charsHere.length > 0 && (
            <div className="flex flex-col gap-1">
              {charsHere.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                  <PortraitImage
                    imageId={c.portraitImageId}
                    className="h-6 w-6 rounded-full object-cover"
                    fallbackClassName="h-6 w-6 rounded-full"
                  />
                  <span className="flex-1 text-xs font-medium truncate">{c.name}</span>
                  {activeEventId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:text-red-400"
                      aria-label="Remove character from location"
                      onClick={() => removeCharacter(c.id)}
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add a character */}
          {activeEventId && charsElsewhere.length > 0 && (
            addingChar ? (
              <Select onValueChange={assignCharacter}>
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Choose character..." />
                </SelectTrigger>
                <SelectContent>
                  {charsElsewhere.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddingChar(true)}>
                <Plus className="h-3.5 w-3.5" /> Add character here
              </Button>
            )
          )}

          {activeEventId && characters.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No characters in this world yet.</p>
          )}
        </div>

        {/* ── Items ── */}
        {activeEventId && (
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Items here
            </Label>

            {itemsHere.length > 0 && (
              <div className="flex flex-col gap-1">
                {itemsHere.map((placement) => {
                  const item = allItems.find((i) => i.id === placement.itemId)
                  if (!item) return null
                  return (
                    <LocationItemRow
                      key={placement.id}
                      item={item}
                      eventId={activeEventId!}
                      worldId={worldId}
                      onRemove={() => removeItemPlacement(placement.itemId, activeEventId)}
                    />
                  )
                })}
              </div>
            )}

            {(() => {
              // Items not in any character's inventory AND not already here
              const hereIds = new Set(itemsHere.map((p) => p.itemId))
              const inInventory = new Set(
                allSnapshots.flatMap((s) => s.inventoryItemIds)
              )
              const elsewhereIds = new Set(
                allPlacements
                  .filter((p) => p.eventId === activeEventId && p.locationMarkerId !== markerId)
                  .map((p) => p.itemId)
              )
              const free = allItems.filter((i) => !hereIds.has(i.id) && !inInventory.has(i.id) && !elsewhereIds.has(i.id))
              const elsewhere = allItems.filter((i) => !hereIds.has(i.id) && (inInventory.has(i.id) || elsewhereIds.has(i.id)))
              if (allItems.length === 0) return <p className="text-xs italic text-[hsl(var(--muted-foreground))]">No items in this world yet.</p>
              return (
                <Select onValueChange={(v) => placeItemAtLocation(worldId, v, activeEventId, markerId)}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Place item here..." />
                  </SelectTrigger>
                  <SelectContent>
                    {free.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                    {elsewhere.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} <span className="opacity-50">(move from elsewhere)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })()}
          </div>
        )}

        {/* ── Chapter State ── */}
        {activeEventId && (
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Chapter State
            </Label>
            <Select
              value={locationSnap?.status ?? 'active'}
              onValueChange={(v) =>
                upsertLocationSnapshot({
                  worldId,
                  locationMarkerId: markerId,
                  eventId: activeEventId,
                  status: v,
                  notes: locationSnap?.notes ?? '',
                })
              }
            >
              <SelectTrigger className="text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['active', 'occupied', 'sieged', 'abandoned', 'ruined', 'destroyed', 'unknown'].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              className="text-xs resize-none"
              rows={3}
              placeholder="Notes for this chapter..."
              value={locationSnap?.notes ?? ''}
              onChange={(e) =>
                upsertLocationSnapshot({
                  worldId,
                  locationMarkerId: markerId,
                  eventId: activeEventId,
                  status: locationSnap?.status ?? 'active',
                  notes: e.target.value,
                })
              }
            />
          </div>
        )}

        {/* ── Controlling Faction ── */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Controlling Faction
          </Label>
          {factions.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              No factions yet — create one in the Factions view.
            </p>
          ) : (
            <Select
              value={marker.factionId ?? 'none'}
              onValueChange={(v) => updateLocationMarker(markerId, { factionId: v === 'none' ? null : v })}
            >
              <SelectTrigger className="text-xs gap-1.5">
                {marker.factionId && (() => {
                  const sel = factions.find((f) => f.id === marker.factionId)
                  return sel ? <span className="h-3 w-3 rounded-full shrink-0" style={{ background: sel.color }} /> : null
                })()}
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {factions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Related Lore ── */}
        <RelatedLoreSection worldId={worldId} entityId={markerId} entityName={marker.name} />

        {/* ── Sub-map ── */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5" /> Sub-map
          </Label>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setUploadSubMapOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Upload Sub-map
          </Button>
          {otherLayers.length > 0 && (
            <Select value={marker.linkedMapLayerId ?? 'none'} onValueChange={handleLinkSubMap}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Or link existing map..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {otherLayers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {marker.linkedMapLayerId && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => onDrillDown(marker.linkedMapLayerId!)}>
              <Map className="h-3.5 w-3.5" /> Open Sub-map
            </Button>
          )}
        </div>
      </div>

      <UploadMapDialog
        open={uploadSubMapOpen}
        onOpenChange={setUploadSubMapOpen}
        worldId={worldId}
        parentMapId={marker.mapLayerId}
        onCreated={async (newLayerId) => {
          await handleLinkSubMap(newLayerId)
          onDrillDown(newLayerId)
        }}
      />

      <div className="border-t border-[hsl(var(--border))] p-3">
        <Button variant="destructive" size="sm" className="w-full gap-1.5" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete Location
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${marker.name}"?`}
        description="This location marker will be permanently removed from the map."
        onConfirm={handleDelete}
      />
    </div>
  )
}
