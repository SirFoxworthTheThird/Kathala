import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, MapPin, Package, Heart, HeartOff, Plus, Footprints, ExternalLink, Route, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PortraitImage } from '@/components/PortraitImage'
import { useCharacterRelationships } from '@/db/hooks/useRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useTravelModes } from '@/db/hooks/useTravelModes'
import { useBestSnapshots, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { useCharacterMovement, updateMovement } from '@/db/hooks/useMovements'
import { useActiveEventId } from '@/store'
import type { Character, CharacterSnapshot, LocationMarker, MapLayer, Relationship } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#34d399',
  neutral: '#94a3b8',
  negative: '#f87171',
  complex: '#fbbf24',
}

function RelationshipRow({ rel, characterId, characters }: {
  rel: Relationship
  characterId: string
  characters: Character[]
}) {
  const otherId = rel.characterAId === characterId ? rel.characterBId : rel.characterAId
  const other = characters.find((c) => c.id === otherId)
  if (!other) return null
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: SENTIMENT_COLOR[rel.sentiment] ?? '#94a3b8' }} />
      <PortraitImage
        imageId={other.portraitImageId}
        className="h-5 w-5 rounded-full object-cover shrink-0"
        fallbackClassName="h-5 w-5 rounded-full shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[hsl(var(--foreground))]">{other.name}</p>
        <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{rel.label}</p>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface CharacterSnapshotPanelProps {
  character: Character
  snapshot: CharacterSnapshot | undefined
  allMarkers: LocationMarker[]
  allLayers: MapLayer[]
  allCharacters: Character[]
  activeChapterTitle: string | null
  worldId: string
  onClose: () => void
}

export function CharacterSnapshotPanel({
  character,
  snapshot,
  allMarkers,
  allLayers,
  allCharacters,
  activeChapterTitle,
  worldId,
  onClose,
}: CharacterSnapshotPanelProps) {
  const activeEventId = useActiveEventId()
  const relationships = useCharacterRelationships(character.id)
  const items = useItems(worldId)
  const travelModes = useTravelModes(worldId)
  const chapterSnapshots = useBestSnapshots(worldId, activeEventId)
  const movement = useCharacterMovement(character.id, activeEventId)
  const navigate = useNavigate()

  // Local state for text fields (save on blur to avoid cursor jumping)
  const [statusNotes, setStatusNotes] = useState(snapshot?.statusNotes ?? '')
  const [inventoryNotes, setInventoryNotes] = useState(snapshot?.inventoryNotes ?? '')
  const [movementNotes, setMovementNotes] = useState(movement?.notes ?? '')

  // Re-sync text fields when the character or chapter changes (not on every save)
  useEffect(() => {
    setStatusNotes(snapshot?.statusNotes ?? '')
    setInventoryNotes(snapshot?.inventoryNotes ?? '')
  }, [character.id, activeEventId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMovementNotes(movement?.notes ?? '')
  }, [movement?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const locationMarker = snapshot?.currentLocationMarkerId
    ? allMarkers.find((m) => m.id === snapshot.currentLocationMarkerId)
    : null
  const locationLayer = locationMarker
    ? allLayers.find((l) => l.id === locationMarker.mapLayerId)
    : null

  const inventoryItems = snapshot?.inventoryItemIds
    ? items.filter((it) => snapshot.inventoryItemIds.includes(it.id))
    : []

  // Items not already in this character's inventory
  const availableItems = items.filter(
    (it) => !snapshot?.inventoryItemIds.includes(it.id)
  )

  // ── Save helpers ────────────────────────────────────────────────────────────

  function baseData() {
    return {
      worldId,
      characterId: character.id,
      eventId: activeEventId!,
      isAlive: snapshot?.isAlive ?? true,
      currentLocationMarkerId: snapshot?.currentLocationMarkerId ?? null,
      currentMapLayerId: snapshot?.currentMapLayerId ?? null,
      inventoryItemIds: snapshot?.inventoryItemIds ?? [],
      inventoryNotes: snapshot?.inventoryNotes ?? '',
      statusNotes: snapshot?.statusNotes ?? '',
      travelModeId: snapshot?.travelModeId ?? null,
    }
  }

  async function saveField(patch: Partial<Omit<CharacterSnapshot, 'id' | 'worldId' | 'characterId' | 'eventId' | 'createdAt' | 'updatedAt'>>) {
    if (!activeEventId) return
    await upsertSnapshot({ ...baseData(), ...patch })
  }

  async function handleAliveToggle() {
    await saveField({ isAlive: !(snapshot?.isAlive ?? true) })
  }

  async function handleTravelMode(value: string) {
    await saveField({ travelModeId: value === 'none' ? null : value })
  }

  async function handleAddInventory(itemId: string) {
    // Remove from any other character's snapshot in this chapter first
    const others = chapterSnapshots.filter(
      (s) => s.characterId !== character.id && s.inventoryItemIds.includes(itemId)
    )
    await Promise.all(
      others.map((s) =>
        upsertSnapshot({ ...s, inventoryItemIds: s.inventoryItemIds.filter((id) => id !== itemId) })
      )
    )
    const current = snapshot?.inventoryItemIds ?? []
    await saveField({ inventoryItemIds: [...current, itemId] })
  }

  async function handleRemoveInventory(itemId: string) {
    const current = snapshot?.inventoryItemIds ?? []
    await saveField({ inventoryItemIds: current.filter((id) => id !== itemId) })
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{character.name}</p>
          {activeChapterTitle && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{activeChapterTitle}</p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Portrait */}
        <div className="flex justify-center border-b border-[hsl(var(--border))] p-4">
          <PortraitImage
            imageId={character.portraitImageId}
            className="h-20 w-20 rounded-full object-cover ring-2 ring-[hsl(var(--border))]"
            fallbackClassName="h-20 w-20 rounded-full ring-2 ring-[hsl(var(--border))]"
          />
        </div>

        <div className="flex flex-col gap-4 p-4">

          {/* No chapter selected */}
          {!activeEventId && (
            <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
              Select an event from the timeline bar to view and edit state.
            </p>
          )}

          {activeEventId && (
            <>
              {/* Alive toggle */}
              <button
                onClick={handleAliveToggle}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  (snapshot?.isAlive ?? true)
                    ? 'bg-green-950/30 text-green-400 hover:bg-green-950/50'
                    : 'bg-red-950/30 text-red-400 hover:bg-red-950/50'
                }`}
              >
                {(snapshot?.isAlive ?? true)
                  ? <><Heart className="h-3.5 w-3.5" /> Alive</>
                  : <><HeartOff className="h-3.5 w-3.5" /> Deceased</>
                }
              </button>

              {/* Status notes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Status
                </Label>
                <Textarea
                  className="resize-none text-xs"
                  rows={3}
                  placeholder="What is this character doing this chapter?"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  onBlur={() => saveField({ statusNotes })}
                />
              </div>

              {/* Travel mode */}
              {travelModes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    <Footprints className="h-3 w-3" /> Travel Mode
                  </Label>
                  <Select
                    value={snapshot?.travelModeId ?? 'none'}
                    onValueChange={handleTravelMode}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {travelModes.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Current location (read-only — change by dragging on the map) */}
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  Location
                </p>
                {locationMarker ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <div>
                      <p className="text-xs font-medium text-[hsl(var(--foreground))]">{locationMarker.name}</p>
                      {locationLayer && locationLayer.id !== locationMarker.mapLayerId && (
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{locationLayer.name}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
                    Drag character to a location marker to place them.
                  </p>
                )}
              </div>

              {/* Inventory */}
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  <Package className="h-3 w-3" /> Inventory
                </Label>

                {inventoryItems.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {inventoryItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] px-2 py-1.5">
                        <PortraitImage
                          imageId={item.imageId}
                          fallbackIcon={Package}
                          className="h-5 w-5 rounded object-cover shrink-0"
                          fallbackClassName="h-5 w-5 rounded shrink-0"
                        />
                        <span className="flex-1 truncate text-xs">{item.name}</span>
                        <button
                          onClick={() => handleRemoveInventory(item.id)}
                          className="text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                          title="Remove from inventory"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {availableItems.length > 0 && (
                  <Select onValueChange={handleAddInventory} value="">
                    <SelectTrigger className="h-8 text-xs">
                      <span className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                        <Plus className="h-3 w-3" /> Add item...
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map((it) => (
                        <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {inventoryItems.length > 0 && (
                  <Textarea
                    className="resize-none text-xs"
                    rows={2}
                    placeholder="Inventory notes..."
                    value={inventoryNotes}
                    onChange={(e) => setInventoryNotes(e.target.value)}
                    onBlur={() => saveField({ inventoryNotes })}
                  />
                )}
              </div>
            </>
          )}

          {/* Journey (movement waypoints, travel mode, notes) */}
          {movement && movement.waypoints.length > 0 && activeEventId && (() => {
            const mov = movement
            const evId = activeEventId
            return (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
                  <Route className="h-3 w-3" /> Journey
                </p>

                {/* Waypoint list with reorder */}
                <div className="flex flex-col gap-1">
                  {mov.waypoints.map((markerId, idx) => {
                    const marker = allMarkers.find((m) => m.id === markerId)
                    const isFirst = idx === 0
                    const isLast = idx === mov.waypoints.length - 1
                    const waypoints = mov.waypoints

                    return (
                      <div key={`${markerId}-${idx}`} className="flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-1">
                        <GripVertical className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
                        <span className="flex-1 truncate text-xs">{marker?.name ?? markerId}</span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => {
                              const wps = [...waypoints]
                              ;[wps[idx], wps[idx - 1]] = [wps[idx - 1], wps[idx]]
                              updateMovement(character.id, evId, { waypoints: wps })
                            }}
                            disabled={isFirst}
                            className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30 transition-colors"
                            title="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              const wps = [...waypoints]
                              ;[wps[idx], wps[idx + 1]] = [wps[idx + 1], wps[idx]]
                              updateMovement(character.id, evId, { waypoints: wps })
                            }}
                            disabled={isLast}
                            className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30 transition-colors"
                            title="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Travel mode for this movement */}
                {travelModes.length > 0 && (
                  <Select
                    value={mov.travelModeId ?? 'none'}
                    onValueChange={(v) =>
                      updateMovement(character.id, evId, { travelModeId: v === 'none' ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <span className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                        <Footprints className="h-3 w-3" />
                        <SelectValue placeholder="Travel mode…" />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No travel mode</SelectItem>
                      {travelModes.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Journey notes */}
                <Textarea
                  className="resize-none text-xs"
                  rows={2}
                  placeholder="Reason for travel, notes on the journey…"
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  onBlur={() => updateMovement(character.id, evId, { notes: movementNotes })}
                />
              </div>
            )
          })()}

          {/* Relationships (always visible, read-only) */}
          {relationships.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Relationships
              </p>
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {relationships.map((rel) => (
                  <RelationshipRow
                    key={rel.id}
                    rel={rel}
                    characterId={character.id}
                    characters={allCharacters}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer: link to full character view */}
      <div className="border-t border-[hsl(var(--border))] p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => navigate(`/worlds/${worldId}/characters/${character.id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View full profile
        </Button>
      </div>
    </div>
  )
}
