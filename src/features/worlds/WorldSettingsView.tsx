import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Footprints, Plus, Pencil, Check, X, Trash2, FileCode2, Upload, Image as ImageIcon, BookOpen } from 'lucide-react'
import { useWorld, updateWorld } from '@/db/hooks/useWorlds'
import { useTimelines, updateTimeline } from '@/db/hooks/useTimeline'
import { useRootMapLayers } from '@/db/hooks/useMapLayers'
import { useTravelModes, createTravelMode, updateTravelMode, deleteTravelMode } from '@/db/hooks/useTravelModes'
import { storeBlob } from '@/db/hooks/useBlobs'
import { LinkImageButton } from '@/components/LinkImageButton'
import { PortraitImage } from '@/components/PortraitImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TravelMode } from '@/types'
import { CloudSyncPanel } from './CloudSyncPanel'
import { DbHealthPanel } from './DbHealthPanel'
import { CalendarEditor } from './CalendarEditor'
import { APP_THEMES, themeClass } from '@/lib/themes'

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
  const timelines = useTimelines(worldId ?? null)
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

  // Cover image
  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !worldId) return
    const blob = await storeBlob(worldId, file)
    await updateWorld(worldId, { coverImageId: blob.id })
    e.target.value = '' // allow re-selecting the same file
  }
  async function removeCover() {
    if (!worldId) return
    await updateWorld(worldId, { coverImageId: null })
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

        {/* Cover image */}
        <div className="space-y-1.5">
          <Label>Cover image</Label>
          <div className="flex items-center gap-4">
            <PortraitImage
              imageId={world?.coverImageId}
              alt={world?.name ? `${world.name} cover` : 'World cover'}
              className="h-24 w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] object-contain"
              fallbackClassName="h-24 w-40 rounded-md border border-[hsl(var(--border))]"
              fallbackIcon={ImageIcon}
            />
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-1.5 text-xs text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} aria-label="Upload cover image" />
                </label>
                {worldId && (
                  <LinkImageButton
                    worldId={worldId}
                    onLinked={(blobId) => updateWorld(worldId, { coverImageId: blobId })}
                    triggerClassName="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2.5 py-2 text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--accent))]"
                    triggerAriaLabel="Link cover image by URL"
                  />
                )}
              </div>
              {world?.coverImageId && (
                <button
                  onClick={removeCover}
                  className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Reading mode. `world` loads asynchronously, so guard it — the rest of
          this view uses `world?.` for the same reason. */}
      {world && (
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Reading mode</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Present this world to someone reading the book rather than writing it. Characters,
            items and places the story has not introduced yet are hidden until the chapter
            cursor reaches them, and the writing screens step aside.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={world.readingMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => void updateWorld(world.id, { readingMode: !world.readingMode })}
          >
            <BookOpen className="h-4 w-4" />
            {world.readingMode ? 'Reading mode is on' : 'Turn on reading mode'}
          </Button>
        </div>
        {world.readingMode && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Turn it off whenever you want to edit. If this world came from the example library,
            note that downloading it again restores the original and discards your changes —
            export it first if you want to keep them.
          </p>
        )}
      </section>
      )}

      {/* World theme */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Theme</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Override the global app theme for this world. "Default" inherits your global setting.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {APP_THEMES.map((t) => {
            const worldThemeClass = themeClass(t.id)
            const isActive = (world?.theme ?? null) === worldThemeClass
            return (
              <button
                key={t.id}
                title={`${t.label}: ${t.description}`}
                onClick={() => worldId && updateWorld(worldId, { theme: worldThemeClass })}
                className={`group/theme grid grid-cols-[3.5rem_1fr_1rem] items-center gap-3 rounded-lg border p-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${
                  isActive
                    ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] shadow-[0_0_0_1px_hsl(var(--ring)/0.2)]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card)/0.55)] hover:-translate-y-px hover:border-[hsl(var(--ring)/0.55)] hover:bg-[hsl(var(--accent)/0.55)]'
                }`}
              >
                <span
                  className="h-10 w-14 rounded-md border border-white/15 shadow-inner"
                  style={{ background: t.swatch }}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-[hsl(var(--foreground))]">{t.icon} {t.id === 'default' ? 'Inherit global theme' : t.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{t.description}</span>
                </span>
                {isActive && <Check className="h-4 w-4 text-[hsl(var(--ring))]" aria-hidden="true" />}
              </button>
            )
          })}
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

      {/* Continuity */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Continuity</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Number of consecutive events a character can be involved in without a snapshot update before a stale-state warning is raised.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="stale-threshold" className="shrink-0">Stale snapshot threshold</Label>
          <input
            id="stale-threshold"
            type="number"
            min="2"
            max="50"
            className="w-20 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            value={world?.continuityStaleThreshold ?? 5}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (worldId && !isNaN(n) && n >= 2) updateWorld(worldId, { continuityStaleThreshold: n })
            }}
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">events</span>
        </div>
      </section>

      {/* Manuscript */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Manuscript</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            A book-level word target and an optional deadline. The dashboard's Writing Progress panel
            shows a burndown, the words/day needed, and a projected finish date.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="word-target" className="w-24 shrink-0">Word target</Label>
          <input
            id="word-target"
            type="number"
            min="0"
            step="1000"
            placeholder="e.g. 90000"
            className="w-32 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            value={world?.wordTarget ?? ''}
            onChange={(e) => {
              if (!worldId) return
              const v = e.target.value.trim()
              const n = v === '' ? null : Math.max(0, Math.floor(Number(v)))
              updateWorld(worldId, { wordTarget: n === null || isNaN(n) ? null : n })
            }}
          />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">words</span>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="target-date" className="w-24 shrink-0">Deadline</Label>
          <input
            id="target-date"
            type="date"
            className="w-40 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            value={world?.targetDate ?? ''}
            onChange={(e) => {
              if (!worldId) return
              const v = e.target.value.trim()
              updateWorld(worldId, { targetDate: v === '' ? null : v })
            }}
          />
          {world?.targetDate && (
            <button
              className="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
              onClick={() => worldId && updateWorld(worldId, { targetDate: null })}
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Timelines — per-timeline day offsets for multi-era worlds */}
      {timelines.length > 1 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Timelines</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              Each timeline's clock starts at its own day. Give a historically-shifted timeline
              (a frame narrative's past, an earlier era) a start day so it lines up with the others
              in chronological merges and on the calendar.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {timelines.map((tl) => (
              <div key={tl.id} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tl.color }} aria-hidden="true" />
                <span className="w-40 shrink-0 truncate text-sm text-[hsl(var(--foreground))]">{tl.name}</span>
                <Label htmlFor={`tl-offset-${tl.id}`} className="text-xs text-[hsl(var(--muted-foreground))]">starts at day</Label>
                <input
                  id={`tl-offset-${tl.id}`}
                  type="number"
                  step="1"
                  className="w-28 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  value={tl.dayOffset ?? 0}
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value))
                    updateTimeline(tl.id, { dayOffset: isNaN(n) ? 0 : n })
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calendar */}
      {world && <CalendarEditor world={world} />}

      {/* Share */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Share</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Export a read-only HTML snapshot of this world — characters, timeline, locations, items and relationships — that anyone can open in a browser.
          </p>
        </div>
        <Button
          variant="outline" size="sm" className="gap-2"
          onClick={async () => {
            if (!worldId) return
            const { exportWorldAsHtml } = await import('@/lib/htmlExport')
            await exportWorldAsHtml(worldId)
          }}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Export as HTML
        </Button>
      </section>

      {/* DB Health */}
      {worldId && <DbHealthPanel worldId={worldId} />}

      {/* Cloud Sync */}
      {worldId && (
        <CloudSyncPanel worldId={worldId} worldName={world?.name ?? ''} />
      )}

    </div>
  )
}
