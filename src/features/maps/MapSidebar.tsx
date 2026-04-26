import { useState, useMemo } from 'react'
import {
  Users, Map as MapIcon, MapPin, Package, Layers,
  ChevronRight, ChevronDown, Trash2, Undo2, X, Search,
  Route, Hexagon, Plus, Link,
} from 'lucide-react'
import { useAppStore, useMapLayerHistory } from '@/store'
import { useMapLayers, deleteMapLayer } from '@/db/hooks/useMapLayers'
import { useEventMovements, clearMovement, removeLastWaypoint } from '@/db/hooks/useMovements'
import { useItems } from '@/db/hooks/useItems'
import { useEventItemPlacements } from '@/db/hooks/useItemPlacements'
import { useItemSnapshot, upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { useCrossTimelineArtifacts } from '@/db/hooks/useTimelineRelationships'
import { useMapRoutes, deleteMapRoute } from '@/db/hooks/useMapRoutes'
import { useMapRegions, deleteMapRegion, useBestRegionSnapshots, upsertMapRegionSnapshot } from '@/db/hooks/useMapRegions'
import { PortraitImage } from '@/components/PortraitImage'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { Character, CharacterSnapshot, Item, LocationMarker, MapLayer, RouteType, MapRegionStatus } from '@/types'
import { pathPixelLength, formatDistance } from '@/lib/mapScale'
import { characterColor, ICON_COLORS } from './mapUtils'

// ─── SidebarSection ──────────────────────────────────────────────────────────

export function SidebarSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  count,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="flex flex-col border-b border-[hsl(var(--border))]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors select-none"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {title}
        </span>
        {count !== undefined && (
          <span className="rounded-full bg-[hsl(var(--muted))] px-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
            {count}
          </span>
        )}
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          : <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />}
      </button>
      {open && children}
    </div>
  )
}

// ─── SidebarSearch ───────────────────────────────────────────────────────────

function SidebarSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mx-2 mb-1.5 mt-0.5">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1 pl-6 pr-6 text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--ring))] transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

// ─── Map Layers tree ─────────────────────────────────────────────────────────

function LayerTreeNode({
  layer,
  allLayers,
  activeLayerId,
  depth,
  onSelect,
  onDeleted,
}: {
  layer: MapLayer
  allLayers: MapLayer[]
  activeLayerId: string | null
  depth: number
  onSelect: (id: string) => void
  onDeleted: (id: string) => void
}) {
  const children = allLayers.filter((l) => l.parentMapId === layer.id)
  const [open, setOpen] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const isActive = layer.id === activeLayerId
  const childCount = allLayers.filter((l) => l.parentMapId === layer.id).length

  async function handleDelete() {
    await deleteMapLayer(layer.id)
    onDeleted(layer.id)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 cursor-pointer select-none transition-colors rounded-sm mx-1 ${
          isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }}
        onClick={() => onSelect(layer.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {children.length > 0 ? (
          <button
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <MapPin className="h-3 w-3 shrink-0 opacity-40" />
        )}
        {depth === 0 && <MapIcon className="h-3 w-3 shrink-0 opacity-70" />}
        <span className="flex-1 truncate text-xs">{layer.name}</span>
        {hovered && (
          <button
            className="shrink-0 rounded p-0.5 hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true) }}
            title="Delete map"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={childCount > 0 ? `Delete "${layer.name}" and its ${childCount} sub-map(s)?` : `Delete "${layer.name}"?`}
        description="This cannot be undone."
        onConfirm={handleDelete}
      />
      {open && children.map((child) => (
        <LayerTreeNode
          key={child.id}
          layer={child}
          allLayers={allLayers}
          activeLayerId={activeLayerId}
          depth={depth + 1}
          onSelect={onSelect}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}

export function LayersSection({ worldId }: { worldId: string }) {
  const allLayers = useMapLayers(worldId)
  const history = useMapLayerHistory()
  const { resetMapHistory, setActiveMapLayerId } = useAppStore()
  const activeLayerId = history[history.length - 1] ?? null
  const roots = allLayers.filter((l) => l.parentMapId === null)

  function handleDeleted(deletedId: string) {
    if (history.includes(deletedId)) {
      const remaining = allLayers.filter((l) => l.id !== deletedId && l.parentMapId === null)
      if (remaining.length > 0) resetMapHistory(remaining[0].id)
      else setActiveMapLayerId('')
    }
  }

  return (
    <SidebarSection title="Map Layers" icon={Layers} count={roots.length}>
      <div className="py-1">
        {roots.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No maps yet.</p>
        ) : (
          roots.map((root) => (
            <LayerTreeNode
              key={root.id}
              layer={root}
              allLayers={allLayers}
              activeLayerId={activeLayerId}
              depth={0}
              onSelect={(id) => resetMapHistory(id)}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Characters section ───────────────────────────────────────────────────────

export function CharactersSection({
  characters,
  snapshots,
  allMarkers,
  activeEventId,
  worldId,
  scalePixelsPerUnit,
  scaleUnit,
  onDragStart,
  onDragEnd,
  onFocus,
}: {
  characters: Character[]
  snapshots: CharacterSnapshot[]
  allMarkers: LocationMarker[]
  activeEventId: string | null
  worldId: string
  scalePixelsPerUnit: number | null
  scaleUnit: string | null
  onDragStart: () => void
  onDragEnd: () => void
  onFocus: (characterId: string) => void
}) {
  const movements = useEventMovements(worldId, activeEventId)
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? characters.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : characters

  return (
    <SidebarSection title="Characters" icon={Users} count={characters.length}>
      {!activeEventId && (
        <p className="px-3 pb-2 text-[10px] italic text-[hsl(var(--muted-foreground))]">
          Select an event from the timeline bar below to place and drag characters onto the map.
        </p>
      )}
      {characters.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col gap-1 px-2 pb-2">
        {characters.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No characters yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-1 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((c) => {
            const snap = snapshots.find((s) => s.characterId === c.id)
            const locationName = snap?.currentLocationMarkerId
              ? allMarkers.find((m) => m.id === snap.currentLocationMarkerId)?.name
              : null
            const movement = movements.find((m) => m.characterId === c.id)
            const color = characterColor(c.id)
            return (
              <div key={c.id} className="flex flex-col gap-0.5">
                <div
                  draggable={!!activeEventId}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('characterId', c.id)
                    e.dataTransfer.effectAllowed = 'move'
                    onDragStart()
                  }}
                  onDragEnd={onDragEnd}
                  onClick={() => onFocus(c.id)}
                  className={`flex items-center gap-2 rounded-md border bg-[hsl(var(--muted))] px-2 py-1.5 select-none cursor-pointer ${
                    activeEventId ? 'hover:border-[hsl(var(--ring))]' : 'opacity-60'
                  }`}
                  style={{ borderColor: movement ? color : 'hsl(var(--border))' }}
                >
                  <PortraitImage
                    imageId={c.portraitImageId}
                    className="h-6 w-6 rounded-full object-cover shrink-0"
                    fallbackClassName="h-6 w-6 rounded-full shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.name}</p>
                    {locationName && (
                      <p className="truncate text-[10px] text-[hsl(var(--muted-foreground))]">{locationName}</p>
                    )}
                  </div>
                </div>

                {movement && movement.waypoints.length >= 2 && activeEventId && (
                  <div className="flex items-center gap-1 pl-2">
                    <span className="h-1 w-3 rounded-full shrink-0" style={{ background: color }} />
                    <p className="flex-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">
                      {movement.waypoints.length} stops
                      {scalePixelsPerUnit && scaleUnit && (() => {
                        const pts = movement.waypoints
                          .map((id) => allMarkers.find((m) => m.id === id))
                          .filter(Boolean)
                          .map((m) => [m!.x, m!.y] as [number, number])
                        if (pts.length < 2) return null
                        return ` · ${formatDistance(pathPixelLength(pts), scalePixelsPerUnit, scaleUnit)}`
                      })()}
                    </p>
                    <button
                      title="Undo last stop"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                      onClick={() => removeLastWaypoint(c.id, activeEventId)}
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                    <button
                      title="Clear path"
                      className="rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                      onClick={() => clearMovement(c.id, activeEventId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Locations section ────────────────────────────────────────────────────────

export function LocationsSection({
  markers,
  selectedId,
  onSelect,
  onFocus,
}: {
  markers: LocationMarker[]
  selectedId: string | null
  onSelect: (id: string) => void
  onFocus: (marker: LocationMarker) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? markers.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : markers

  return (
    <SidebarSection title="Locations" icon={MapPin} count={markers.length} defaultOpen={false}>
      {markers.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {markers.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No locations on this map.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => { onSelect(m.id); onFocus(m) }}
              className={`flex items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-sm mx-1 ${
                selectedId === m.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: ICON_COLORS[m.iconType] ?? '#94a3b8' }}
              />
              <span className="flex-1 truncate text-xs">{m.name}</span>
              {m.linkedMapLayerId && (
                <MapIcon className="h-3 w-3 shrink-0 opacity-50" />
              )}
            </button>
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Items section ────────────────────────────────────────────────────────────

const ITEM_CONDITIONS = ['intact', 'damaged', 'destroyed', 'lost', 'found', 'unknown']
const CONDITION_COLORS: Record<string, string> = {
  intact: '#34d399', damaged: '#fbbf24', destroyed: '#f87171',
  lost: '#94a3b8', found: '#60a5fa', unknown: '#a78bfa',
}

function ItemRow({
  item,
  activeEventId,
  worldId,
  locationName,
  isCrossTimeline,
  onFocus,
}: {
  item: Item
  activeEventId: string | null
  worldId: string
  locationName: string | null
  isCrossTimeline: boolean
  onFocus: () => void
}) {
  const snap = useItemSnapshot(item.id, worldId, activeEventId)
  const [expanded, setExpanded] = useState(false)
  const condition = snap?.condition ?? 'intact'

  return (
    <div className="mx-1 rounded-sm border border-transparent hover:border-[hsl(var(--border))] transition-colors">
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        onClick={() => { onFocus(); setExpanded((v) => !v) }}
      >
        <PortraitImage
          imageId={item.imageId}
          fallbackIcon={Package}
          className="h-5 w-5 rounded object-cover shrink-0"
          fallbackClassName="h-5 w-5 rounded shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="truncate text-xs">{item.name}</p>
            {isCrossTimeline && (
              <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide bg-amber-500/20 text-amber-400">echo era</span>
            )}
          </div>
          {locationName && (
            <p className="truncate text-[10px] opacity-60">{locationName}</p>
          )}
        </div>
        {activeEventId && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: CONDITION_COLORS[condition] ?? '#94a3b8' }}
            title={condition}
          />
        )}
        {activeEventId && (
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </div>

      {expanded && activeEventId && (
        <div className="flex flex-col gap-1.5 border-t border-[hsl(var(--border))] px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] w-16 shrink-0">Condition</span>
            <select
              className="flex-1 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[10px] text-[hsl(var(--foreground))]"
              value={condition}
              onChange={(e) =>
                upsertItemSnapshot({
                  worldId,
                  itemId: item.id,
                  eventId: activeEventId,
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
                eventId: activeEventId,
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

export function ItemsSection({
  worldId,
  activeEventId,
  allMarkers,
  snapshots,
  onFocus,
}: {
  worldId: string
  activeEventId: string | null
  allMarkers: LocationMarker[]
  snapshots: CharacterSnapshot[]
  onFocus: (itemId: string) => void
}) {
  const items = useItems(worldId)
  const placements = useEventItemPlacements(activeEventId)
  const artifacts = useCrossTimelineArtifacts(worldId)
  const crossTimelineItemIds = useMemo(() => new Set(artifacts.map((a) => a.itemId)), [artifacts])
  const [search, setSearch] = useState('')
  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  function getItemLocation(itemId: string): string | null {
    const placement = placements.find((p) => p.itemId === itemId)
    if (placement) {
      return allMarkers.find((m) => m.id === placement.locationMarkerId)?.name ?? null
    }
    const snap = snapshots.find((s) => s.inventoryItemIds.includes(itemId))
    if (snap) {
      const loc = snap.currentLocationMarkerId
        ? allMarkers.find((m) => m.id === snap.currentLocationMarkerId)?.name
        : null
      return loc ?? null
    }
    return null
  }

  return (
    <SidebarSection title="Items" icon={Package} count={items.length} defaultOpen={false}>
      {items.length > 0 && <SidebarSearch value={search} onChange={setSearch} />}
      <div className="flex flex-col py-1">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No items yet.</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No matches.</p>
        ) : (
          filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              activeEventId={activeEventId}
              worldId={worldId}
              locationName={getItemLocation(item.id)}
              isCrossTimeline={crossTimelineItemIds.has(item.id)}
              onFocus={() => onFocus(item.id)}
            />
          ))
        )}
      </div>
    </SidebarSection>
  )
}

// ─── Route type display helpers ───────────────────────────────────────────────

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  road: 'Road', river: 'River', trail: 'Trail',
  sea_route: 'Sea route', border: 'Border', custom: 'Custom',
}
export const ROUTE_TYPE_COLORS: Record<RouteType, string> = {
  road: '#a78bfa', river: '#60a5fa', trail: '#34d399',
  sea_route: '#22d3ee', border: '#fb923c', custom: '#94a3b8',
}

// ─── Routes section ───────────────────────────────────────────────────────────

export function RoutesSection({
  mapLayerId,
  worldId: _worldId,
  selectedRouteId,
  onSelectRoute,
  drawingRoute,
  onStartDraw,
  onCancelDraw,
}: {
  mapLayerId: string
  worldId: string
  selectedRouteId: string | null
  onSelectRoute: (id: string | null) => void
  drawingRoute: boolean
  onStartDraw: () => void
  onCancelDraw: () => void
}) {
  const routes = useMapRoutes(mapLayerId)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const confirmRoute = confirmId ? routes.find((r) => r.id === confirmId) : null

  return (
    <SidebarSection title="Routes" icon={Route} count={routes.length} defaultOpen={false}>
      <div className="px-2 pb-1.5 pt-0.5">
        {drawingRoute ? (
          <button
            onClick={onCancelDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] px-2 py-1 text-[10px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--ring)/0.2)]"
          >
            <X className="h-3 w-3" /> Cancel drawing
          </button>
        ) : (
          <button
            onClick={onStartDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus className="h-3 w-3" /> New route
          </button>
        )}
      </div>
      <div className="flex flex-col py-1">
        {routes.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No routes yet. Click 'New route' above, or right-click the map to start drawing.</p>
        ) : (
          routes.map((route) => (
            <div
              key={route.id}
              className={`group flex items-center gap-2 rounded-sm mx-1 px-2 py-1.5 cursor-pointer transition-colors ${
                selectedRouteId === route.id
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
              }`}
              onClick={() => onSelectRoute(selectedRouteId === route.id ? null : route.id)}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: route.color ?? ROUTE_TYPE_COLORS[route.routeType] }}
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="truncate text-xs leading-tight">{route.name}</span>
                <span className="text-[9px] capitalize text-[hsl(var(--muted-foreground))] leading-tight">
                  {ROUTE_TYPE_LABELS[route.routeType]} · {route.waypoints.length} stops
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmId(route.id) }}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => { if (!v) setConfirmId(null) }}
        title="Delete route"
        description={`Delete "${confirmRoute?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => { if (confirmId) deleteMapRoute(confirmId); setConfirmId(null) }}
      />
    </SidebarSection>
  )
}

// ─── Region status helpers ────────────────────────────────────────────────────

export const REGION_STATUS_COLORS: Record<MapRegionStatus, string> = {
  active: '#34d399', occupied: '#fb923c', contested: '#ef4444',
  abandoned: '#94a3b8', destroyed: '#dc2626', unknown: '#a78bfa',
}
const ALL_REGION_STATUSES: MapRegionStatus[] = ['active', 'occupied', 'contested', 'abandoned', 'destroyed', 'unknown']

// ─── Regions section ──────────────────────────────────────────────────────────

export function RegionsSection({
  mapLayerId,
  worldId,
  activeEventId,
  selectedRegionId,
  onSelectRegion,
  drawingRegion,
  onStartDraw,
  onCancelDraw,
}: {
  mapLayerId: string
  worldId: string
  activeEventId: string | null
  selectedRegionId: string | null
  onSelectRegion: (id: string | null) => void
  drawingRegion: boolean
  onStartDraw: () => void
  onCancelDraw: () => void
}) {
  const regions = useMapRegions(mapLayerId)
  const regionSnaps = useBestRegionSnapshots(worldId, activeEventId)
  const snapByRegionId = useMemo(() => new Map(regionSnaps.map((s) => [s.regionId, s])), [regionSnaps])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const confirmRegion = confirmId ? regions.find((r) => r.id === confirmId) : null

  function handleStatusChange(regionId: string, status: MapRegionStatus) {
    if (!activeEventId) return
    upsertMapRegionSnapshot({
      worldId,
      regionId,
      eventId: activeEventId,
      status,
      notes: editingNotes[regionId] ?? snapByRegionId.get(regionId)?.notes ?? '',
    })
  }

  function handleNotesSave(regionId: string) {
    if (!activeEventId) return
    const currentSnap = snapByRegionId.get(regionId)
    upsertMapRegionSnapshot({
      worldId,
      regionId,
      eventId: activeEventId,
      status: currentSnap?.status ?? 'active',
      notes: editingNotes[regionId] ?? '',
    })
  }

  return (
    <SidebarSection title="Regions" icon={Hexagon} count={regions.length} defaultOpen={false}>
      <div className="px-2 pb-1.5 pt-0.5">
        {drawingRegion ? (
          <button
            onClick={onCancelDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--ring))] bg-[hsl(var(--ring)/0.12)] px-2 py-1 text-[10px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--ring)/0.2)]"
          >
            <X className="h-3 w-3" /> Cancel drawing
          </button>
        ) : (
          <button
            onClick={onStartDraw}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus className="h-3 w-3" /> New region
          </button>
        )}
      </div>
      <div className="flex flex-col py-1">
        {regions.length === 0 ? (
          <p className="px-3 py-2 text-xs italic text-[hsl(var(--muted-foreground))]">No regions yet. Click 'New region' above, or right-click the map to start drawing.</p>
        ) : (
          regions.map((region) => {
            const snap = snapByRegionId.get(region.id)
            const status: MapRegionStatus = snap?.status ?? 'active'
            const isSelected = selectedRegionId === region.id
            const notes = editingNotes[region.id] ?? snap?.notes ?? ''
            return (
              <div key={region.id} className="flex flex-col">
                {/* Region row */}
                <div
                  className={`group flex items-center gap-2 rounded-sm mx-1 px-2 py-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                  }`}
                  onClick={() => onSelectRegion(isSelected ? null : region.id)}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0 ring-1 ring-black/20"
                    style={{ background: region.fillColor }}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate text-xs leading-tight">{region.name}</span>
                      {region.linkedMapLayerId && (
                        <Link className="h-2.5 w-2.5 shrink-0 text-[hsl(var(--muted-foreground))] opacity-60" />
                      )}
                    </div>
                    {activeEventId && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: REGION_STATUS_COLORS[status] }}
                        />
                        <span className="text-[9px] capitalize text-[hsl(var(--muted-foreground))] leading-tight">
                          {status}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmId(region.id) }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Inline status editor — only when selected and an event is active */}
                {isSelected && activeEventId && (
                  <div className="mx-2 mb-2 flex flex-col gap-1.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-2 py-2">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      Status at this event
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {ALL_REGION_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(region.id, s)}
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] capitalize transition-colors ${
                            status === s
                              ? 'bg-[hsl(var(--ring))] text-[hsl(var(--background))]'
                              : 'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                          }`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: status === s ? 'currentColor' : REGION_STATUS_COLORS[s] }}
                          />
                          {s}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setEditingNotes((prev) => ({ ...prev, [region.id]: e.target.value }))}
                      onBlur={() => handleNotesSave(region.id)}
                      placeholder="Notes for this event…"
                      rows={2}
                      className="w-full resize-none rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-[11px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(var(--ring))] transition-colors"
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => { if (!v) setConfirmId(null) }}
        title="Delete region"
        description={`Delete "${confirmRegion?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => { if (confirmId) deleteMapRegion(confirmId); setConfirmId(null) }}
      />
    </SidebarSection>
  )
}
