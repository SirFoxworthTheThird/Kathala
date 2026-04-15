import { useState, useMemo, type ElementType } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Map as MapIcon, Users, Network, BookOpen, Footprints, Plus, Pencil, Trash2,
  Check, X, Package, BarChart2, ShieldAlert, Clock, Layers,
} from 'lucide-react'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useCharacters } from '@/db/hooks/useCharacters'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useRelationships } from '@/db/hooks/useRelationships'
import { useTravelModes, createTravelMode, updateTravelMode, deleteTravelMode } from '@/db/hooks/useTravelModes'
import { useTimelineRelationships } from '@/db/hooks/useTimelineRelationships'
import { useItems } from '@/db/hooks/useItems'
import { useWorldSnapshots } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
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

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, dim }: { label: string; value: string | number; dim?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[11px]',
      dim ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'
    )}>
      <span className="font-semibold">{value}</span>
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
    </span>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export default function WorldDashboardView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const { setActiveEventId, setCheckerOpen } = useAppStore()

  const world               = useWorld(worldId ?? null)
  const characters          = useCharacters(worldId ?? null)
  const maps                = useRootMapLayers(worldId ?? null)
  const timelines           = useTimelines(worldId ?? null)
  const chapters            = useWorldChapters(worldId ?? null)
  const allEvents           = useWorldEvents(worldId ?? null)
  const relationships       = useRelationships(worldId ?? null)
  const travelModes         = useTravelModes(worldId ?? null)
  const timelineRelationships = useTimelineRelationships(worldId ?? null)
  const items               = useItems(worldId ?? null)
  const snapshots           = useWorldSnapshots(worldId ?? null)
  const locationMarkers     = useAllLocationMarkers(worldId ?? null)

  // Inline description editing
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft]     = useState('')

  function startEditDesc() {
    setDescDraft(world?.description ?? '')
    setEditingDesc(true)
  }
  async function saveDesc() {
    if (!worldId) return
    await updateWorld(worldId, { description: descDraft.trim() })
    setEditingDesc(false)
  }

  // Scale unit from first calibrated map
  const scaleUnit = useMemo(() => {
    const m = maps.find((m) => (m as unknown as Record<string, unknown>).scaleUnit)
    return m ? (m as unknown as Record<string, string>).scaleUnit : 'units'
  }, [maps])

  // Derived stats
  const aliveCount = characters.filter((c) => c.isAlive).length
  const deadCount  = characters.length - aliveCount
  const totalEvents   = allEvents.length
  const totalChapters = chapters.length
  // Events that have at least one snapshot recorded
  const eventsWithSnap = useMemo(() => {
    const eventIds = new Set(snapshots.map((s) => s.eventId))
    return allEvents.filter((e) => eventIds.has(e.id)).length
  }, [snapshots, allEvents])
  const coveragePct = totalEvents > 0 ? Math.round((eventsWithSnap / totalEvents) * 100) : 0

  // 5 most recently updated events
  const recentEvents = useMemo(() => {
    return [...allEvents]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
  }, [allEvents])

  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])
  const timelineById = useMemo(() => new Map(timelines.map((t) => [t.id, t])), [timelines])

  // Travel mode form
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

  // Nav tiles
  type Tile = {
    label: string
    icon: ElementType
    count: number | null
    countSuffix?: string
    onClick: () => void
    pills: { label: string; value: number }[]
    description: string
  }
  const tiles: Tile[] = [
    {
      label: 'Timeline',
      icon: BookOpen,
      count: totalChapters,
      onClick: () => navigate('timeline'),
      pills: [
        { label: 'events', value: totalEvents },
        ...(timelines.length > 1 ? [{ label: 'timelines', value: timelines.length }] : []),
        ...(timelineRelationships.length > 0 ? [{ label: 'links', value: timelineRelationships.length }] : []),
      ],
      description: 'chapters',
    },
    {
      label: 'Characters',
      icon: Users,
      count: characters.length,
      onClick: () => navigate('characters'),
      pills: [
        ...(aliveCount > 0 ? [{ label: 'alive', value: aliveCount }] : []),
        ...(deadCount > 0  ? [{ label: 'dead',  value: deadCount  }] : []),
      ],
      description: 'in your cast',
    },
    {
      label: 'Maps',
      icon: MapIcon,
      count: maps.length,
      onClick: () => navigate('maps'),
      pills: locationMarkers.length > 0 ? [{ label: 'markers', value: locationMarkers.length }] : [],
      description: 'root map layers',
    },
    {
      label: 'Relationships',
      icon: Network,
      count: relationships.length,
      onClick: () => navigate('relationships'),
      pills: [],
      description: 'character connections',
    },
    {
      label: 'Items',
      icon: Package,
      count: items.length,
      onClick: () => navigate('items'),
      pills: [],
      description: 'in your catalogue',
    },
    {
      label: 'Character Arc',
      icon: BarChart2,
      count: coveragePct,
      countSuffix: '%',
      onClick: () => navigate('arc'),
      pills: eventsWithSnap > 0 ? [{ label: `/ ${totalEvents} events`, value: eventsWithSnap }] : [],
      description: 'snapshot coverage',
    },
    {
      label: 'Continuity',
      icon: ShieldAlert,
      count: null,
      onClick: () => setCheckerOpen(true),
      pills: [],
      description: 'check for issues',
    },
  ]

  return (
    <div className="p-6 space-y-8 max-w-5xl">

      {/* World header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            {world?.name ?? 'Loading…'}
          </h2>

          {editingDesc ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                className="w-full max-w-xl rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] resize-none"
                rows={3}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Describe your world…"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDesc}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-start gap-2">
              {world?.description
                ? <p className="text-sm text-[hsl(var(--muted-foreground))] max-w-xl">{world.description}</p>
                : <p className="text-sm italic text-[hsl(var(--muted-foreground)/0.5)]">No description — click to add one.</p>
              }
              <button
                onClick={startEditDesc}
                className="mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                title="Edit description"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nav tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(({ label, icon: Icon, count, countSuffix, onClick, pills, description }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-left transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <span className="text-xl font-bold text-[hsl(var(--foreground))]">
                {count !== null ? `${count}${countSuffix ?? ''}` : '—'}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{description}</p>
            </div>
            {pills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pills.map((p) => (
                  <StatPill key={p.label} value={p.value} label={p.label} dim />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Recent events + Travel modes — side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Recent events */}
        {recentEvents.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h3 className="text-sm font-semibold">Recent Events</h3>
            </div>
            <div className="space-y-1">
              {recentEvents.map((ev) => {
                const ch = chapterById.get(ev.chapterId)
                const tl = ch ? timelineById.get(ch.timelineId) : null
                return (
                  <button
                    key={ev.id}
                    onClick={() => {
                      setActiveEventId(ev.id)
                      navigate('timeline')
                    }}
                    className="w-full flex items-center gap-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left transition-colors hover:border-[hsl(var(--ring))] hover:bg-[hsl(var(--accent))]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                        {ev.title || <span className="italic opacity-50">Untitled event</span>}
                      </p>
                      <p className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                        {tl && timelines.length > 1 ? `${tl.name} · ` : ''}{ch ? `Ch. ${ch.number} — ${ch.title}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Travel modes */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Footprints className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h3 className="text-sm font-semibold">Travel Modes</h3>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">— for distance checks</span>
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
            Speed in {scaleUnit} per in-world day. Set the map scale unit in map settings.
          </p>
        </div>
      </div>

      {/* Timeline relationships — only shown when links exist */}
      {timelineRelationships.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h3 className="text-sm font-semibold">Timeline Links</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {timelineRelationships.map((rel) => {
              const src = timelineById.get(rel.sourceTimelineId)
              const tgt = timelineById.get(rel.targetTimelineId)
              return (
                <div
                  key={rel.id}
                  className="flex items-center gap-1.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{src?.name ?? '?'}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">→</span>
                  <span className="font-medium">{tgt?.name ?? '?'}</span>
                  <span className="ml-1 rounded bg-[hsl(var(--accent))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
                    {rel.type.replace(/_/g, ' ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
