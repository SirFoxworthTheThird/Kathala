import { useState } from 'react'
import { Check, Undo2, X } from 'lucide-react'
import { createMapRoute } from '@/db/hooks/useMapRoutes'
import { createMapRegion } from '@/db/hooks/useMapRegions'
import type { LocationMarker, RouteType } from '@/types'

// ─── Route draw HUD ───────────────────────────────────────────────────────────

const ROUTE_TYPES: RouteType[] = ['road', 'river', 'trail', 'sea_route', 'border', 'custom']
const ROUTE_LABELS: Record<RouteType, string> = {
  road: 'Road', river: 'River', trail: 'Trail',
  sea_route: 'Sea route', border: 'Border', custom: 'Custom',
}

export function RouteDrawHud({
  worldId,
  mapLayerId,
  waypoints,
  allMarkers,
  onUndo,
  onCancel,
  onSave,
}: {
  worldId: string
  mapLayerId: string
  waypoints: Array<string | { x: number; y: number }>
  allMarkers: LocationMarker[]
  onUndo: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const [name, setName] = useState('')
  const [routeType, setRouteType] = useState<RouteType>('road')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (waypoints.length < 2 || !name.trim()) return
    setSaving(true)
    await createMapRoute({ worldId, mapLayerId, name: name.trim(), routeType, waypoints })
    setSaving(false)
    onSave()
  }

  const waypointLabels = waypoints.map((wp) =>
    typeof wp === 'string'
      ? (allMarkers.find((m) => m.id === wp)?.name ?? 'Location')
      : 'Point'
  )

  return (
    <div className="absolute bottom-4 left-1/2 z-[580] -translate-x-1/2">
      <div className="w-80 rounded-lg border border-[hsl(var(--ring)/0.5)] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ring))]">
            Drawing route — click anywhere to add points
          </span>
          <button onClick={onCancel} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-3 py-2 space-y-2">
          <input
            type="text"
            placeholder="Route name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--ring))]"
          />
          <div className="flex flex-wrap gap-1">
            {ROUTE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setRouteType(t)}
                className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                  routeType === t
                    ? 'bg-[hsl(var(--ring))] text-[hsl(var(--background))]'
                    : 'border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                {ROUTE_LABELS[t]}
              </button>
            ))}
          </div>
          {waypoints.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {waypointLabels.map((label, i) => (
                <span
                  key={i}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    label === 'Point'
                      ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                      : 'bg-[hsl(var(--ring)/0.15)] text-[hsl(var(--foreground))]'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{waypoints.length} point{waypoints.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onUndo}
              disabled={waypoints.length === 0}
              className="flex items-center gap-1 rounded border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] disabled:opacity-40 hover:text-[hsl(var(--foreground))]"
            >
              <Undo2 className="h-3 w-3" /> Undo
            </button>
            <button
              onClick={handleSave}
              disabled={waypoints.length < 2 || !name.trim() || saving}
              className="ml-auto flex items-center gap-1 rounded bg-[hsl(var(--ring))] px-3 py-1 text-[10px] font-medium text-[hsl(var(--background))] disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Save route
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Region draw HUD ──────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#e879f9',
]

export function RegionDrawHud({
  worldId,
  mapLayerId,
  vertices,
  onUndo,
  onCancel,
  onSave,
}: {
  worldId: string
  mapLayerId: string
  vertices: Array<{ x: number; y: number }>
  onUndo: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const [name, setName] = useState('')
  const [fillColor, setFillColor] = useState(PRESET_COLORS[0])
  const [opacity, setOpacity] = useState(0.35)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (vertices.length < 3 || !name.trim()) return
    setSaving(true)
    await createMapRegion({ worldId, mapLayerId, name: name.trim(), vertices, fillColor, opacity })
    setSaving(false)
    onSave()
  }

  return (
    <div className="absolute bottom-4 left-1/2 z-[580] -translate-x-1/2">
      <div className="w-72 rounded-lg border border-[hsl(var(--ring)/0.5)] bg-[hsl(var(--card))] shadow-xl">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ring))]">
            Drawing region — click map to place vertices
          </span>
          <button onClick={onCancel} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="px-3 py-2 space-y-2">
          <input
            type="text"
            placeholder="Region name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:border-[hsl(var(--ring))]"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Color:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setFillColor(c)}
                className={`h-4 w-4 rounded-full transition-all ${fillColor === c ? 'ring-2 ring-offset-1 ring-[hsl(var(--ring))]' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Opacity:</span>
            <input
              type="range"
              min={0.1} max={0.8} step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="flex-1 h-1"
            />
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{Math.round(opacity * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{vertices.length} point{vertices.length !== 1 ? 's' : ''}</span>
            <button
              onClick={onUndo}
              disabled={vertices.length === 0}
              className="flex items-center gap-1 rounded border border-[hsl(var(--border))] px-2 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))] disabled:opacity-40 hover:text-[hsl(var(--foreground))]"
            >
              <Undo2 className="h-3 w-3" /> Undo
            </button>
            <button
              onClick={handleSave}
              disabled={vertices.length < 3 || !name.trim() || saving}
              className="ml-auto flex items-center gap-1 rounded bg-[hsl(var(--ring))] px-3 py-1 text-[10px] font-medium text-[hsl(var(--background))] disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Save region
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
