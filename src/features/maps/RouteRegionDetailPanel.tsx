import { useState, useEffect } from 'react'
import { X, Trash2, Route, Hexagon, Link, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { updateMapRoute, deleteMapRoute } from '@/db/hooks/useMapRoutes'
import { updateMapRegion, deleteMapRegion } from '@/db/hooks/useMapRegions'
import { ROUTE_TYPE_COLORS } from './MapSidebar'
import type { RouteType } from '@/types'

// ─── Shared constants ─────────────────────────────────────────────────────────

const ROUTE_TYPES: RouteType[] = ['road', 'river', 'trail', 'sea_route', 'border', 'custom']
const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  road: 'Road', river: 'River', trail: 'Trail',
  sea_route: 'Sea route', border: 'Border', custom: 'Custom',
}

const PRESET_COLORS = [
  '#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa',
  '#fb923c', '#22d3ee', '#e879f9', '#94a3b8', '#f472b6',
]

// ─── Route detail panel ───────────────────────────────────────────────────────

export function RouteDetailPanel({
  routeId,
  onClose,
}: {
  routeId: string
  onClose: () => void
}) {
  const route = useLiveQuery(() => db.mapRoutes.get(routeId), [routeId])
  const [name, setName] = useState('')
  const [routeType, setRouteType] = useState<RouteType>('road')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync local state when route loads
  useEffect(() => {
    if (!route) return
    setName(route.name)
    setRouteType(route.routeType)
    setNotes(route.notes ?? '')
    setDirty(false)
  }, [route?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!route) return null

  async function handleSave() {
    if (!name.trim()) return
    await updateMapRoute(routeId, { name: name.trim(), routeType, notes: notes.trim() })
    setDirty(false)
  }

  async function handleDelete() {
    await deleteMapRoute(routeId)
    onClose()
  }

  function change<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  const waypointCount = route.waypoints.length
  const namedStops = route.waypoints.filter((wp) => typeof wp === 'string').length
  const freePoints = waypointCount - namedStops

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Route</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => change(setName)(e.target.value)}
            placeholder="Route name"
          />
        </div>

        {/* Route type */}
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROUTE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => change(setRouteType)(t)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  routeType === t
                    ? 'bg-[hsl(var(--ring))] text-[hsl(var(--background))]'
                    : 'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: routeType === t ? 'currentColor' : ROUTE_TYPE_COLORS[t] }}
                />
                {ROUTE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => change(setNotes)(e.target.value)}
            placeholder="Add notes about this route…"
            rows={3}
          />
        </div>

        {/* Waypoint summary */}
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2 flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Waypoints</span>
          <span className="text-xs text-[hsl(var(--foreground))]">
            {waypointCount} total — {namedStops} named location{namedStops !== 1 ? 's' : ''}, {freePoints} free point{freePoints !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Save */}
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            Save changes
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-red-400 hover:text-red-400 hover:bg-red-400/10"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete route
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
        title="Delete route"
        description={`Delete "${route.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ─── Region detail panel ──────────────────────────────────────────────────────

export function RegionDetailPanel({
  regionId,
  worldId,
  onClose,
  onDrillDown,
}: {
  regionId: string
  worldId: string
  onClose: () => void
  onDrillDown?: (layerId: string) => void
}) {
  const region = useLiveQuery(() => db.mapRegions.get(regionId), [regionId])
  const allLayers = useMapLayers(worldId)
  const [name, setName] = useState('')
  const [fillColor, setFillColor] = useState(PRESET_COLORS[0])
  const [opacity, setOpacity] = useState(0.35)
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!region) return
    setName(region.name)
    setFillColor(region.fillColor)
    setOpacity(region.opacity)
    setNotes(region.notes ?? '')
    setDirty(false)
  }, [region?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!region) return null

  const otherLayers = allLayers.filter((l) => l.id !== region.mapLayerId)

  async function handleSave() {
    if (!name.trim()) return
    await updateMapRegion(regionId, { name: name.trim(), fillColor, opacity, notes: notes.trim() })
    setDirty(false)
  }

  async function handleLinkSubMap(layerId: string) {
    await updateMapRegion(regionId, { linkedMapLayerId: layerId === 'none' ? null : layerId })
  }

  async function handleDelete() {
    await deleteMapRegion(regionId)
    onClose()
  }

  function change<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true) }
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Hexagon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">Region</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => change(setName)(e.target.value)}
            placeholder="Region name"
          />
        </div>

        {/* Fill color */}
        <div className="flex flex-col gap-1.5">
          <Label>Fill color</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => change(setFillColor)(c)}
                className={`h-6 w-6 rounded-full transition-all ${
                  fillColor === c ? 'ring-2 ring-offset-2 ring-[hsl(var(--ring))]' : 'opacity-75 hover:opacity-100'
                }`}
                style={{ background: c }}
                title={c}
              />
            ))}
            {/* Custom color input */}
            <div className="relative h-6 w-6">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => change(setFillColor)(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
                title="Custom color"
              />
              <div
                className={`h-6 w-6 rounded-full border border-dashed border-[hsl(var(--border))] flex items-center justify-center text-[8px] text-[hsl(var(--muted-foreground))] ${
                  !PRESET_COLORS.includes(fillColor) ? 'ring-2 ring-offset-2 ring-[hsl(var(--ring))]' : ''
                }`}
                style={!PRESET_COLORS.includes(fillColor) ? { background: fillColor } : {}}
              >
                {PRESET_COLORS.includes(fillColor) ? '+' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Preview swatch */}
        <div
          className="h-8 w-full rounded border border-[hsl(var(--border))]"
          style={{ background: fillColor, opacity }}
        />

        {/* Opacity */}
        <div className="flex flex-col gap-1.5">
          <Label>Opacity — {Math.round(opacity * 100)}%</Label>
          <input
            type="range"
            min={0.05} max={0.8} step={0.05}
            value={opacity}
            onChange={(e) => change(setOpacity)(Number(e.target.value))}
            className="h-1.5 w-full"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => change(setNotes)(e.target.value)}
            placeholder="Add notes about this region…"
            rows={3}
          />
        </div>

        {/* Sub-map link */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5" /> Sub-map
          </Label>
          {otherLayers.length > 0 && (
            <Select value={region.linkedMapLayerId ?? 'none'} onValueChange={handleLinkSubMap}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Link a sub-map…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {otherLayers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {region.linkedMapLayerId && onDrillDown && (
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => onDrillDown(region.linkedMapLayerId!)}>
              <Map className="h-3.5 w-3.5" /> Open Sub-map
            </Button>
          )}
        </div>

        {/* Vertex count */}
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Shape</span>
          <p className="mt-0.5 text-xs text-[hsl(var(--foreground))]">
            {region.vertices.length} vertices
          </p>
        </div>

        {/* Save */}
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
            Save changes
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1.5 text-red-400 hover:text-red-400 hover:bg-red-400/10"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete region
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(false) }}
        title="Delete region"
        description={`Delete "${region.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
