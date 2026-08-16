import { useState, useEffect } from 'react'
import { Route, Hexagon, Link as LinkIcon, Map } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PanelHeader, PanelDangerFooter } from './PanelChrome'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { useMapLayers } from '@/db/hooks/useMapLayers'
import { isTreeVisible } from '@/lib/mapLevels'
import { updateMapRoute, deleteMapRoute } from '@/db/hooks/useMapRoutes'
import { updateMapRegion, deleteMapRegion, useMapRegionSnapshot, upsertMapRegionSnapshot } from '@/db/hooks/useMapRegions'
import { useFactions } from '@/db/hooks/useFactions'
import { ROUTE_TYPE_COLORS, REGION_STATUS_COLORS, ALL_REGION_STATUSES } from './MapSidebar'
import type { RouteType, MapRegionStatus } from '@/types'

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
    <div className="flex h-full w-[85vw] max-w-sm shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl sm:w-72 sm:max-w-none">
      <PanelHeader
        icon={Route}
        name={route.name || 'Untitled route'}
        kind={ROUTE_TYPE_LABELS[route.routeType] ?? 'Route'}
        closeLabel="Close route panel"
        onClose={onClose}
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          {/* Associated, not adjacent — HB-2's defect, in a panel no screen in
              `controlNames.spec.ts` has open, which is that check's boundary. */}
          <Label htmlFor="route-name">Name</Label>
          <Input
            id="route-name"
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
          <Label htmlFor="route-notes">Notes</Label>
          <Textarea
            id="route-notes"
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

      <PanelDangerFooter label="Delete route" onClick={() => setConfirmDelete(true)} />

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
  activeEventId,
  activeChapterTitle,
  onClose,
  onDrillDown,
}: {
  regionId: string
  worldId: string
  /** The moment the per-event status and notes below are about. */
  activeEventId: string | null
  activeChapterTitle: string | null
  onClose: () => void
  onDrillDown?: (layerId: string) => void
}) {
  const region = useLiveQuery(() => db.mapRegions.get(regionId), [regionId])
  const allLayers = useMapLayers(worldId)
  const snapshot = useMapRegionSnapshot(regionId, activeEventId)
  const status: MapRegionStatus = snapshot?.status ?? 'active'
  const [eventNotes, setEventNotes] = useState('')
  useEffect(() => { setEventNotes(snapshot?.notes ?? '') }, [snapshot?.notes, activeEventId])

  function saveSnapshot(next: { status?: MapRegionStatus; notes?: string }) {
    if (!activeEventId) return
    upsertMapRegionSnapshot({
      worldId,
      regionId,
      eventId: activeEventId,
      status: next.status ?? status,
      notes: next.notes ?? eventNotes,
    })
  }
  const factions = useFactions(worldId)
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

  // Only standalone maps and each building's representative floor — not floors.
  const otherLayers = allLayers.filter((l) => l.id !== region.mapLayerId && isTreeVisible(allLayers, l))

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
    <div className="flex h-full w-[85vw] max-w-sm shrink-0 flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl sm:w-72 sm:max-w-none">
      <PanelHeader
        icon={Hexagon}
        name={region.name || 'Untitled region'}
        kind="Region"
        moment={activeChapterTitle}
        closeLabel="Close region panel"
        onClose={onClose}
      />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="region-name">Name</Label>
          <Input
            id="region-name"
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
          <Label htmlFor="region-notes">Notes</Label>
          <Textarea
            id="region-notes"
            value={notes}
            onChange={(e) => change(setNotes)(e.target.value)}
            placeholder="Add notes about this region…"
            rows={3}
          />
        </div>

        {/* Owning faction */}
        <div className="flex flex-col gap-1.5">
          <Label>Owning faction</Label>
          {factions.length === 0 ? (
            /* X-4 rule 2, and the twin of LP-3: the location panel got its link
               and this one, with the same copy, did not. */
            <div className="flex flex-col items-start gap-1.5">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                No factions yet — create one to say who holds this ground.
              </p>
              <Link
                to={`/worlds/${worldId}/factions`}
                className="pw-tap inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring))]"
              >
                Open Factions
              </Link>
            </div>
          ) : (
            <Select
              value={region.factionId ?? 'none'}
              onValueChange={(v) => updateMapRegion(regionId, { factionId: v === 'none' ? null : v })}
            >
              <SelectTrigger className="text-xs gap-1.5">
                {region.factionId && (() => {
                  const sel = factions.find((f) => f.id === region.factionId)
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

        {/* Sub-map link */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> Sub-map
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

        {/*
          RG-1: a region's *status* is the one part of it that changes with the
          story — the Continuity Checker reads it, and it is what "abandoned" or
          "destroyed" means for a character walking through. It lived only in an
          inline editor inside the sidebar row, which appears exactly when this
          panel is open, so a region had two homes side by side and this one —
          the one holding its name, colour, notes and faction — was the half
          that could not say what was happening to it.
        */}
        <div className="flex flex-col gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            At this moment
          </span>
          {!activeEventId ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Pick a scene on the bar below to set what has become of this region, and
              to leave a note about it for that moment.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {ALL_REGION_STATUSES.map((s) => (
                  <button
                    key={s}
                    aria-pressed={status === s}
                    onClick={() => saveSnapshot({ status: s })}
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
              {/* Named apart from the region's own Notes above, which are not
                  per-moment — two fields called "Notes" on one panel would be
                  the confusion this section exists to remove. */}
              <Label htmlFor="region-event-notes" className="mt-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                Notes at this moment
              </Label>
              <Textarea
                id="region-event-notes"
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                onBlur={() => saveSnapshot({ notes: eventNotes })}
                placeholder="What has happened here by now…"
                rows={2}
                className="text-xs"
              />
            </>
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

      <PanelDangerFooter label="Delete region" onClick={() => setConfirmDelete(true)} />

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
