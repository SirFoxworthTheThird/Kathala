import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Map, Users, Network, BookOpen, Footprints, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useWorld } from '@/db/hooks/useWorlds'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTimelines } from '@/db/hooks/useTimeline'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useTravelModes, createTravelMode, updateTravelMode, deleteTravelMode } from '@/db/hooks/useTravelModes'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TravelMode } from '@/types'

// ── Travel mode row ──────────────────────────────────────────────────────────

function TravelModeRow({ mode, scaleUnit }: { mode: TravelMode; scaleUnit: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(mode.name)
  const [speed, setSpeed] = useState(String(mode.speedPerDay))

  async function save() {
    const s = parseFloat(speed)
    if (!name.trim() || isNaN(s) || s <= 0) return
    await updateTravelMode(mode.id, { name: name.trim(), speedPerDay: s })
    setEditing(false)
  }

  function cancel() {
    setName(mode.name)
    setSpeed(String(mode.speedPerDay))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          className="h-7 flex-1 text-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          autoFocus
        />
        <Input
          className="h-7 w-24 text-xs"
          type="number"
          min="0.1"
          step="any"
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        />
        <span className="text-xs text-[hsl(var(--muted-foreground))]">{scaleUnit}/day</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Check className="h-3 w-3" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancel}><X className="h-3 w-3" /></Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm">
      <span className="flex-1 font-medium">{mode.name}</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{mode.speedPerDay} {scaleUnit}/day</span>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteTravelMode(mode.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function WorldDashboardView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const world = useWorld(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const maps = useRootMapLayers(worldId ?? null)
  const timelines = useTimelines(worldId ?? null)
  const relationships = useRelationships(worldId ?? null)
  const travelModes = useTravelModes(worldId ?? null)
  const timelineRelationships = useTimelineRelationships(worldId ?? null)

  const [newName, setNewName] = useState('')
  const [newSpeed, setNewSpeed] = useState('')

  // Infer the scale unit from the first map that has one set
  const scaleUnit = maps.find((m) => (m as unknown as Record<string, unknown>).scaleUnit)
    ? (maps.find((m) => (m as unknown as Record<string, unknown>).scaleUnit) as unknown as Record<string, string>).scaleUnit
    : 'units'

  const tiles = [
    { label: 'Maps', icon: Map, count: maps.length, to: 'maps', description: 'Locations and sub-maps' },
    { label: 'Characters', icon: Users, count: characters.length, to: 'characters', description: 'Track your cast' },
    { label: 'Relationships', icon: Network, count: relationships.length, to: 'relationships', description: 'Character connections' },
    {
      label: 'Timeline', icon: BookOpen, count: timelines.length, to: 'timeline',
      description: timelineRelationships.length > 0
        ? `${timelineRelationships.length} linked timeline${timelineRelationships.length !== 1 ? 's' : ''}`
        : 'Chapters and events',
    },
  ]

  async function handleAdd() {
    if (!worldId || !newName.trim()) return
    const s = parseFloat(newSpeed)
    if (isNaN(s) || s <= 0) return
    await createTravelMode({ worldId, name: newName.trim(), speedPerDay: s })
    setNewName('')
    setNewSpeed('')
  }

  return (
    <div className="p-6 space-y-8">
      {/* World header */}
      <div>
        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          {world?.name ?? 'Loading...'}
        </h2>
        {world?.description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{world.description}</p>
        )}
      </div>

      {/* Nav tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles.map(({ label, icon: Icon, count, to, description }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              <span className="text-2xl font-bold text-[hsl(var(--foreground))]">{count}</span>
            </div>
            <div>
              <p className="font-medium text-[hsl(var(--foreground))]">{label}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Travel modes */}
      <div className="max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <Footprints className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h3 className="text-sm font-semibold">Travel Modes</h3>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">— used for travel distance checks</span>
        </div>

        <div className="space-y-1.5 mb-3">
          {travelModes.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] italic py-1">
              No travel modes defined. Add some below to enable travel distance checks.
            </p>
          )}
          {travelModes.map((m) => (
            <TravelModeRow key={m.id} mode={m} scaleUnit={scaleUnit} />
          ))}
        </div>

        {/* Add new */}
        <div className="flex items-center gap-2">
          <Input
            className="h-8 flex-1 text-xs"
            placeholder="Mode name (e.g. On foot)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input
            className="h-8 w-24 text-xs"
            type="number"
            min="0.1"
            step="any"
            placeholder="Speed"
            value={newSpeed}
            onChange={(e) => setNewSpeed(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{scaleUnit}/day</span>
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newName.trim() || !newSpeed}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          Speed is in {scaleUnit} per in-world day. Set the map scale unit in the map settings.
        </p>
      </div>
    </div>
  )
}
