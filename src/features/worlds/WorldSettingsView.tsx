import { useState, useMemo, useRef } from 'react'
import { BlockingReason } from '@/components/BlockingReason'
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
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import type { TravelMode } from '@/types'
import { CloudSyncPanel } from './CloudSyncPanel'
import { DbHealthPanel } from './DbHealthPanel'
import { CalendarEditor } from './CalendarEditor'
import { SettingsIndex, useSettingsSections } from './SettingsIndex'
import { APP_THEMES, themeClass } from '@/lib/themes'
import { useAppStore, type AppTheme } from '@/store'
import { SettingsSection, SettingsFoldProvider } from './SettingsSection'
import { LocalPicturesSection } from './LocalPicturesSection'

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
          aria-label={`Name of travel mode ${mode.name}`}
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
          aria-label={`Speed of travel mode ${mode.name}, in ${scaleUnit} per day`}
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

function WorldSettingsBody() {
  const { worldId } = useParams<{ worldId: string }>()
  const world = useWorld(worldId ?? null)
  // Settings is the escape hatch, so it stays reachable while reading — but
  // only two things on it are a reader's to change: how the app looks, and
  // whether reading mode is on at all. The rest calibrates a draft.
  const readingMode = !!world?.readingMode
  const timelines = useTimelines(worldId ?? null)
  const maps = useRootMapLayers(worldId ?? null)
  const travelModes = useTravelModes(worldId ?? null)
  const appTheme = useAppStore((s) => s.theme)
  const setAppTheme = useAppStore((s) => s.setTheme)
  // The index reads the sections that actually rendered, since half of them are
  // conditional — see SettingsIndex.
  const rootRef = useRef<HTMLDivElement>(null)
  const sections = useSettingsSections(rootRef)

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
    <div ref={rootRef} className="p-6 space-y-10 max-w-2xl">
      {/* SET-2: eleven sections in one scroll, with nothing to navigate by. */}
      <SettingsIndex sections={sections} />

      {/* World identity — a downloaded book is not the reader's to rename. */}
      {!readingMode && (
        <SettingsSection id="settings-world" label="World">

          {/* Name */}
          <Field label="Name" className="space-y-1.5">
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
              /*
                SET-3: this was a 12px pencil glyph with no accessible name at
                all — no aria-label, no title, no text — beside a read-only
                span. Two defects in one control, and the second is the same as
                X-12 and LORE-1.

                EV-3 settled the pattern for exactly this shape: the read view
                is the control that opens the editor, so the thing you want to
                change is the thing you click. The pencil stays as an affordance
                cue inside the button rather than being the whole of it.
              */
              <button
                onClick={startNameEdit}
                aria-label={`Edit world name (currently ${world?.name || 'unset'})`}
                className="group flex w-full items-center gap-2 rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                <span className="text-sm text-[hsl(var(--foreground))]">{world?.name ?? '—'}</span>
                <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--foreground))]" aria-hidden="true" />
              </button>
            )}
          </Field>

          {/* Description */}
          <Field label="Description" className="space-y-1.5">
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
              /* SET-3, and the worse half of it: the pencil floated at the
                 right of a three-line paragraph with nothing anchoring it to
                 what it edited. The paragraph is the control. */
              <button
                onClick={startDescEdit}
                aria-label={world?.description ? 'Edit world description' : 'Add a world description'}
                className="group flex w-full items-start gap-2 rounded border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              >
                {world?.description
                  ? <span className="text-sm text-[hsl(var(--muted-foreground))]">{world.description}</span>
                  : <span className="text-sm italic text-[hsl(var(--muted-foreground)/0.5)]">Describe your world…</span>
                }
                <Pencil className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover:text-[hsl(var(--foreground))]" aria-hidden="true" />
              </button>
            )}
          </Field>

          {/* Cover image */}
          <Field label="Cover image" className="space-y-1.5">
            <div className="flex items-center gap-4">
              <PortraitImage
                imageId={world?.coverImageId}
                alt={world?.name ? `${world.name} cover` : 'World cover'}
                className="h-24 w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] object-contain"
                fallbackClassName="h-24 w-40 rounded-md border border-[hsl(var(--border))]"
                fallbackIcon={ImageIcon}
                zoomable
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
          </Field>
        </SettingsSection>
      )}

      {/* Reading mode. `world` loads asynchronously, so guard it — the rest of
          this view uses `world?.` for the same reason. */}
      {world && (
      <SettingsSection id="settings-reading-mode" label="Reading mode"
      blurb={<>Present this world to someone reading the book rather than writing it. Characters,
            items and places the story has not introduced yet are hidden until the chapter
            cursor reaches them, and the writing screens step aside.</>}
    >
        <div className="flex flex-wrap items-center gap-2">
          {/*
            A toggle, so it says so: `aria-pressed` carries the state and the
            label stays an action in both directions. It previously read
            "Reading mode is on" when on and "Turn on reading mode" when off —
            a status in one direction and an instruction in the other, which
            left the on state looking like a label rather than a control.
          */}
          <Button
            variant={world.readingMode ? 'default' : 'outline'}
            size="sm"
            aria-pressed={!!world.readingMode}
            onClick={() => void updateWorld(world.id, { readingMode: !world.readingMode })}
          >
            <BookOpen className="h-4 w-4" />
            {world.readingMode ? 'Turn off reading mode' : 'Turn on reading mode'}
          </Button>
          {world.readingMode && (
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Reading mode is on.
            </span>
          )}
        </div>
        {world.readingMode && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Turn it off whenever you want to edit. If this world came from the library,
            note that downloading it again restores the original and discards your changes —
            export it first if you want to keep them.
          </p>
        )}
      </SettingsSection>
      )}

      {/* `world` loads asynchronously — same guard as the section above. */}
      {world && (
      <SettingsSection id="settings-pictures" label="Pictures"
        blurb={<>A picture is either a file kept in this browser or a link to one on the web.
              Linked pictures are fetched each time they are shown, so they need a connection
              — and they stop working if the site takes them down.</>}
      >
        <LocalPicturesSection worldId={world.id} />
      </SettingsSection>
      )}

      {/* World theme */}
      <SettingsSection id="settings-theme" label="Theme"
      blurb={<>Override the app theme for this world. <em>Inherit app theme</em> uses the setting below.</>}
    >
        {/*
          SET-1: this section offered to override a setting the app gave no way
          to set. The app theme is real and load-bearing — it is what the world
          list uses, and what every world set to inherit resolves to — but its
          only control, `ThemePicker`, was exported and never rendered. So the
          default option inherited from a value nobody could change, and the
          sentence above described a screen that did not exist. It exists here
          now, beside the sentence that describes it.
        */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.55)] p-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="app-theme" className="text-xs font-semibold">App theme</Label>
            <p className="mt-0.5 text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">
              Used on the world list, and by every world set to inherit.
            </p>
          </div>
          <select
            id="app-theme"
            value={appTheme}
            onChange={(e) => setAppTheme(e.target.value as AppTheme)}
            className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            {APP_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
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
                  <span className="block text-xs font-semibold text-[hsl(var(--foreground))]">{t.icon} {t.id === 'default' ? 'Inherit app theme' : t.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[hsl(var(--muted-foreground))]">{t.description}</span>
                </span>
                {isActive && <Check className="h-4 w-4 text-[hsl(var(--ring))]" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* Everything from here calibrates the draft rather than describing the
          story: travel speeds for map distances, the continuity checker's
          tolerance, a word target and deadline, per-timeline day offsets, the
          in-world calendar's own definition, folder sync, and database repair.
          The HTML export goes too — it writes out the whole world, cursor and
          all, so offering it here would hand a reader the ending in a file. */}
      {!readingMode && (
        <>
          {/* Travel modes */}
          <SettingsSection id="settings-travel-modes" label="Travel Modes"
      blurb={<>Used for distance calculations on the map. Speed is in {scaleUnit} per in-world day.{' '}
                {scaleUnit === 'units' && 'Set the map scale unit in map settings to use real distances.'}</>}
    >
            <div className="flex items-center gap-2">
              <Footprints className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              <Input
                className="h-8 flex-1 text-xs"
                aria-label="New travel mode name"
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
                aria-label={`New travel mode speed, in ${scaleUnit} per day`}
                placeholder="Speed"
                value={newSpeed}
                onChange={(e) => setNewSpeed(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{scaleUnit}/day</span>
              <Button size="sm" variant="outline" aria-label="Add travel mode" onClick={handleAdd} disabled={!newName.trim() || !newSpeed}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            {/* X-9: two fields, and the greyed-out + said which of them. */}
            <BlockingReason
              checks={[
                { met: !!newName.trim(), need: 'a name' },
                { met: !!newSpeed, need: 'a speed' },
              ]}
            />

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
          </SettingsSection>

          {/* Continuity */}
          <SettingsSection id="settings-continuity" label="Continuity"
      blurb={<>Number of consecutive scenes a character can be involved in without a snapshot update before a stale-state warning is raised.</>}
    >
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
              <span className="text-xs text-[hsl(var(--muted-foreground))]">scenes</span>
            </div>
          </SettingsSection>

          {/* Manuscript */}
          <SettingsSection id="settings-manuscript" label="Manuscript"
      blurb={<>A book-level word target and an optional deadline. The dashboard's Writing Progress panel
                shows a burndown, the words/day needed, and a projected finish date.</>}
    >
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
          </SettingsSection>

          {/* Timelines — per-timeline day offsets for multi-era worlds */}
          {timelines.length > 1 && (
            <SettingsSection id="settings-timelines" label="Timelines"
      blurb={<>Each timeline's clock starts at its own day. Give a historically-shifted timeline
                  (a frame narrative's past, an earlier era) a start day so it lines up with the others
                  in chronological merges and on the calendar.</>}
    >
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
            </SettingsSection>
          )}

          {/* Calendar */}
          {world && <CalendarEditor world={world} />}

          {/* Share */}
          <SettingsSection id="settings-share" label="Share"
      blurb={<>Export a read-only HTML snapshot of this world — characters, timeline, locations, items and relationships — that anyone can open in a browser.</>}
    >
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
          </SettingsSection>

          {/* DB Health */}
          {worldId && <DbHealthPanel worldId={worldId} />}

          {/* Cloud Sync */}
          {worldId && (
            <CloudSyncPanel worldId={worldId} worldName={world?.name ?? ''} />
          )}
        </>
      )}
    </div>
  )
}

/**
 * The fold state is shared by every section *and* by the index above them, so
 * it is provided around the whole screen rather than held inside it.
 */
export default function WorldSettingsView() {
  return (
    <SettingsFoldProvider>
      <WorldSettingsBody />
    </SettingsFoldProvider>
  )
}
