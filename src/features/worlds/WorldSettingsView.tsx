import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Footprints, Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes, createTravelMode, updateTravelMode, deleteTravelMode } from '@/db/hooks/useTravelModes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TravelMode } from '@/types'
import { CloudSyncPanel } from './CloudSyncPanel'

// ── Travel mode row ───────────────────────────────────────────────────────────

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
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteTravelMode(mode.id)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function WorldSettingsView() {
  const { worldId } = useParams<{ worldId: string }>()
  const world = useWorld(worldId ?? null)
  const maps = useRootMapLayers(worldId ?? null)
  const travelModes = useTravelModes(worldId ?? null)

  // World name / description
  const [name, setName] = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [desc, setDesc] = useState('')
  const [descEditing, setDescEditing] = useState(false)

  function startNameEdit() { setName(world?.name ?? ''); setNameEditing(true) }
  async function saveName() {
    if (!worldId || !name.trim()) return
    await updateWorld(worldId, { name: name.trim() })
    setNameEditing(false)
  }

  function startDescEdit() { setDesc(world?.description ?? ''); setDescEditing(true) }
  async function saveDesc() {
    if (!worldId) return
    await updateWorld(worldId, { description: desc.trim() })
    setDescEditing(false)
  }

  // Scale unit from first calibrated map
  const scaleUnit = useMemo(() => {
    const m = maps.find((m) => (m as unknown as Record<string, unknown>).scaleUnit)
    return m ? (m as unknown as Record<string, string>).scaleUnit : 'units'
  }, [maps])

  // Travel mode add form
  const [newName, setNewName] = useState('')
  const [newSpeed, setNewSpeed] = useState('')

  async function handleAdd() {
    if (!worldId || !newName.trim()) return
    const s = parseFloat(newSpeed)
    if (isNaN(s) || s <= 0) return
    await createTravelMode({ worldId, name: newName.trim(), speedPerDay: s })
    setNewName('')
    setNewSpeed('')
  }

  return (
    <div className="p-6 space-y-10 max-w-2xl">

      {/* World identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">World</h2>

        {/* Name */}
        <div className="space-y-1.5">
          <Label>Name</Label>
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setNameEditing(false) }}
                autoFocus
              />
              <Button size="sm" onClick={saveName}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setNameEditing(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[hsl(var(--foreground))]">{world?.name ?? '—'}</span>
              <button
                onClick={startNameEdit}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label>Description</Label>
          {descEditing ? (
            <div className="space-y-2">
              <textarea
                className="w-full rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe your world…"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDesc}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setDescEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {world?.description
                ? <p className="text-sm text-[hsl(var(--muted-foreground))]">{world.description}</p>
                : <p className="text-sm italic text-[hsl(var(--muted-foreground)/0.5)]">No description yet.</p>
              }
              <button
                onClick={startDescEdit}
                className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Travel modes */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Travel Modes</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Used for distance calculations on the map. Speed is in {scaleUnit} per in-world day.{' '}
            {scaleUnit === 'units' && 'Set the map scale unit in map settings to use real distances.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Footprints className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
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

        {travelModes.length === 0 ? (
          <p className="text-xs italic text-[hsl(var(--muted-foreground))]">
            No travel modes yet. Add one above to enable distance checks on the map.
          </p>
        ) : (
          <div className="space-y-1.5">
            {travelModes.map((m) => (
              <TravelModeRow key={m.id} mode={m} scaleUnit={scaleUnit} />
            ))}
          </div>
        )}
      </section>

      {/* Cloud Sync */}
      {worldId && (
        <CloudSyncPanel worldId={worldId} worldName={world?.name ?? ''} />
      )}

    </div>
  )
}
