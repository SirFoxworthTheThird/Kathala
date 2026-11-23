import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BookOpen, CircleDashed, History, Search, Spline, Undo2 } from 'lucide-react'
import { useWorld } from '@/db/hooks/useWorlds'
import { useTimelines, useWorldChapters, useWorldEvents } from '@/db/hooks/useTimeline'
import { useCharacters } from '@/db/hooks/useCharacters'
import { usePlotThreads } from '@/db/hooks/usePlotThreads'
import { useWorldSnapshots, resolveCharacterSnapshot } from '@/db/hooks/useSnapshots'
import { useAllLocationMarkers } from '@/db/hooks/useLocationMarkers'
import { useStory } from '@/db/hooks/useStory'
import { useShowMoment } from '@/db/hooks/useShowMoment'
import { EmptyState } from '@/components/EmptyState'
import { dayLabel, dayNumberToDate, formatYear } from '@/lib/calendar'
import { charColor } from '@/lib/characterColor'
import { plural } from '@/lib/plural'
import { cn } from '@/lib/utils'
import {
  axisOf, BLOCK_H, BLOCK_W, FIRST_LANES, laneSteps, lanesOf, openingZoom, packLane, placesOnOneDay, spanLabel,
  timeScenes, ZOOMS, type Lane, type LaneKind, type TimedScene, type Zoom,
} from '@/lib/storyTime'
import type { WorldCalendar } from '@/types'
import { TimeSwitch, laneKindOf } from './TimeSwitch'

/*
  Story time against telling order (issue #703): the Arc screen's second mode
  (D-3). In-world time runs across; each lane is a character, a thread or a
  point of view; each block is a scene at its day, numbered by its place in the
  book. It writes nothing (D-2). See docs/records/story-time-plan.md.
*/

const LANE_LABEL_W = 168
const AXIS_H = 34
const ROW_H = BLOCK_H + 4
const LANE_PAD = 6

const KIND_LABEL: Record<LaneKind, string> = { characters: 'Characters', threads: 'Threads', pov: 'POV' }
const ZOOM_LABEL: Record<Zoom, string> = { days: 'Days', weeks: 'Weeks', months: 'Months', years: 'Years' }

/** A tick's label, as coarse as its zoom. */
function tickLabel(cal: WorldCalendar | null | undefined, day: number, zoom: Zoom): string {
  if (!cal || cal.months.length === 0) {
    return zoom === 'years' ? `Year ${Math.floor(day / 365.25) + 1}` : `Day ${day}`
  }
  const d = dayNumberToDate(cal, day)
  if (zoom === 'years') return formatYear(cal, d.year)
  if (zoom === 'months') return `${cal.months[d.month]?.name ?? `Month ${d.month + 1}`} ${formatYear(cal, d.year)}`
  return dayLabel(cal, day)
}

const pressed = (on: boolean) => cn(
  'px-2.5 py-1 transition-colors',
  on ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]',
)

interface Placed {
  key: string
  lane: Lane
  scene: TimedScene
  x: number
  y: number
  /** `moved` during the day, or `back` on it somewhere else (D-1). */
  elsewhere: 'moved' | 'back' | null
}

export default function StoryTimeView() {
  const { worldId } = useParams<{ worldId: string }>()
  const navigate = useNavigate()
  const showMoment = useShowMoment()
  const [params, setParams] = useSearchParams()
  const kind = laneKindOf(params.get('lanes'))

  const world      = useWorld(worldId ?? null)
  const events     = useWorldEvents(worldId ?? null)
  const chapters   = useWorldChapters(worldId ?? null)
  const timelines  = useTimelines(worldId ?? null)
  const characters = useCharacters(worldId ?? null)
  const threads    = usePlotThreads(worldId ?? null)
  const snapshots  = useWorldSnapshots(worldId ?? null)
  const markers    = useAllLocationMarkers(worldId ?? null)
  const story      = useStory(worldId ?? null)
  const calendar   = world?.calendar ?? null

  const [zoomChoice, setZoomChoice] = useState<Zoom | null>(null)
  const [chosen, setChosen] = useState<Partial<Record<LaneKind, string[]>>>({})
  const [showPath, setShowPath] = useState(false)
  const [lanesOpen, setLanesOpen] = useState(false)
  const [laneQuery, setLaneQuery] = useState('')
  const [focus, setFocus] = useState(0)
  const blocksRef = useRef<HTMLDivElement>(null)

  // D-4: the Calendar's days, from the same scenes and rules. D-9: the scenes are the reading gate's.
  const timed = useMemo(
    () => timeScenes(events, chapters, timelines, { pinsSetClock: world?.pinsSetClock }),
    [events, chapters, timelines, world?.pinsSetClock],
  )
  const timedById = useMemo(() => new Map(timed.map((t) => [t.id, t])), [timed])
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events])
  const markerName = useMemo(() => new Map(markers.map((m) => [m.id, m.name])), [markers])

  const named = useMemo(
    () => kind === 'threads' ? threads.map((t) => ({ id: t.id, name: t.name })) : characters.map((c) => ({ id: c.id, name: c.name })),
    [kind, threads, characters],
  )
  const allLanes = useMemo(() => lanesOf(kind, events, timed, named), [kind, events, timed, named])
  const chosenIds = chosen[kind]
  const lanes = useMemo(
    () => chosenIds ? allLanes.filter((l) => chosenIds.includes(l.id)) : allLanes.slice(0, FIRST_LANES),
    [allLanes, chosenIds],
  )

  const zoom = zoomChoice ?? openingZoom(timed.map((t) => t.wholeDay))
  const axis = useMemo(() => axisOf(timed.map((t) => t.wholeDay), zoom), [timed, zoom])

  // Where a person is at a scene: their state there (D-1).
  const placeOf = useMemo(() => {
    const byChar = new Map<string, typeof snapshots>()
    for (const s of snapshots) byChar.set(s.characterId, [...(byChar.get(s.characterId) ?? []), s])
    return (personId: string, sceneId: string) => {
      const own = byChar.get(personId)
      return own ? resolveCharacterSnapshot(own, sceneId, story)?.currentLocationMarkerId ?? null : null
    }
  }, [snapshots, story])

  // Places on one day, for the people the lanes are about. A thread is no one.
  const elsewhere = useMemo(() => {
    const marks = new Map<string, Map<string, 'moved' | 'back'>>() // personId → sceneId → mark
    if (kind === 'threads') return marks
    const people = new Set(lanes.map((l) => l.id))
    const appearances = new Map<string, string[]>()
    for (const t of timed) {
      for (const id of eventById.get(t.id)?.involvedCharacterIds ?? []) {
        if (!people.has(id)) continue
        appearances.set(id, [...(appearances.get(id) ?? []), t.id])
      }
    }
    for (const d of placesOnOneDay(timed, appearances, placeOf)) {
      const own = marks.get(d.personId) ?? new Map<string, 'moved' | 'back'>()
      for (const id of d.sceneIds) if (!own.has(id)) own.set(id, 'moved')
      for (const id of d.backSceneIds) own.set(id, 'back')
      marks.set(d.personId, own)
    }
    return marks
  }, [kind, lanes, timed, eventById, placeOf])

  // Lay the lanes out: each its rows tall, one under another.
  const layout = useMemo(() => {
    let y = AXIS_H
    const rows: Array<{ lane: Lane; y: number; h: number }> = []
    const placed: Placed[] = []
    for (const lane of lanes) {
      const { blocks, rows: n } = packLane(lane, timedById, axis)
      const h = n * ROW_H + LANE_PAD * 2
      rows.push({ lane, y, h })
      for (const b of blocks) {
        const scene = timedById.get(b.sceneId)!
        placed.push({ key: `${lane.id}:${scene.id}`, lane, scene, x: b.x, y: y + LANE_PAD + b.row * ROW_H, elsewhere: elsewhere.get(lane.id)?.get(scene.id) ?? null })
      }
      y += h
    }
    // D-8: the keyboard goes through them in telling order, lane by lane within a scene.
    placed.sort((a, b) => a.scene.telling - b.scene.telling || lanes.indexOf(a.lane) - lanes.indexOf(b.lane))
    return { rows, placed, height: y }
  }, [lanes, timedById, axis, elsewhere])

  const counts = useMemo(() => ({
    jumps: timed.filter((t) => t.jumpBack !== null).length,
    undated: timed.filter((t) => t.undated).length,
    back: [...elsewhere.values()].reduce((n, m) => n + [...m.values()].filter((v) => v === 'back').length, 0),
  }), [timed, elsewhere])

  function setKind(k: LaneKind) {
    setParams((p) => { p.set('lanes', k); return p }, { replace: true })
    setFocus(0)
  }

  function open(sceneId: string) {
    const ev = eventById.get(sceneId)
    // Looking at a scene is not the same as having read up to it.
    showMoment(sceneId)
    navigate(`/worlds/${worldId}/manuscript${ev ? `/${ev.chapterId}` : ''}`)
  }

  function describe(p: Placed): string {
    const s = p.scene
    const bits = [
      `${s.telling}. ${s.title || 'Untitled scene'}`,
      s.undated ? `${dayLabel(calendar, s.wholeDay)}, undated` : dayLabel(calendar, s.wholeDay),
      p.lane.name,
    ]
    if (s.flashback) bits.push('flashback')
    if (s.jumpBack !== null) bits.push(`jumps back ${plural(s.jumpBack, 'day')}`)
    if (p.elsewhere === 'back') bits.push('back on this day somewhere else')
    else if (p.elsewhere === 'moved') bits.push('in more than one place this day')
    const place = kind !== 'threads' ? placeOf(p.lane.id, s.id) : null
    if (place && markerName.get(place)) bits.push(`at ${markerName.get(place)}`)
    return bits.join(', ')
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const last = layout.placed.length - 1
    let next = focus
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(last, focus + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, focus - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    setFocus(next)
    const el = blocksRef.current?.querySelector<HTMLElement>(`[data-block="${next}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5">
      <span className="text-sm font-semibold">Character Arc</span>
      <TimeSwitch />
      <span className="text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite">
        {plural(timed.length, 'scene')} · {plural(counts.jumps, 'jump')} back
        {counts.back > 0 && <> · {plural(counts.back, 'return')} to a day elsewhere</>}
        {counts.undated > 0 && <> · <CircleDashed className="inline h-3 w-3" aria-hidden="true" /> {counts.undated} undated</>}
      </span>
      <div role="group" aria-label="Lanes are" className="ml-1 flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs">
        {(['characters', 'threads', 'pov'] as const).map((k, i) => (
          <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={cn(pressed(kind === k), i > 0 && 'border-l border-[hsl(var(--border))]')}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <button
        aria-expanded={lanesOpen}
        aria-controls="story-time-lanes"
        onClick={() => setLanesOpen((v) => !v)}
        className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--foreground))]"
      >
        Lanes ({lanes.length} of {allLanes.length})
      </button>
      <div role="group" aria-label="Zoom" className="ml-1 flex overflow-hidden rounded-md border border-[hsl(var(--border))] text-xs">
        {ZOOMS.map((z, i) => (
          <button key={z} aria-pressed={zoom === z} onClick={() => setZoomChoice(z)} className={cn(pressed(zoom === z), i > 0 && 'border-l border-[hsl(var(--border))]')}>
            {ZOOM_LABEL[z]}
          </button>
        ))}
      </div>
      <button
        aria-pressed={showPath}
        onClick={() => setShowPath((v) => !v)}
        title="Draw each lane's line from one scene to the next in telling order"
        className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
          showPath ? 'border-[hsl(var(--ring))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent)/0.4)]')}
      >
        <Spline className="h-3 w-3" aria-hidden="true" /> Path
      </button>
    </div>
  )

  if (timed.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {header}
        <EmptyState icon={BookOpen} title="No scenes yet" description="Story time lays the book's scenes out by when they happen. Add scenes first." className="flex-1" />
      </div>
    )
  }

  const shown = laneQuery.trim()
    ? allLanes.filter((l) => l.name.toLowerCase().includes(laneQuery.trim().toLowerCase()))
    : allLanes
  const isShown = (id: string) => lanes.some((l) => l.id === id)
  function toggleLane(id: string) {
    const now = lanes.map((l) => l.id)
    setChosen((c) => ({ ...c, [kind]: now.includes(id) ? now.filter((x) => x !== id) : [...now, id] }))
    setFocus(0)
  }

  const width = LANE_LABEL_W + axis.width
  const centre = (p: Placed) => ({ x: LANE_LABEL_W + p.x + BLOCK_W / 2, y: p.y + BLOCK_H / 2 })
  const byKey = new Map(layout.placed.map((p) => [p.key, p]))
  const safeFocus = Math.min(focus, Math.max(0, layout.placed.length - 1))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {header}
      {lanesOpen && (
        <div id="story-time-lanes" className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 h-3 w-3 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
              <input
                type="search"
                aria-label="Find a lane"
                value={laneQuery}
                onChange={(e) => setLaneQuery(e.target.value)}
                placeholder="Find…"
                className="h-7 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-6 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <button className="text-xs underline text-[hsl(var(--muted-foreground))]" onClick={() => setChosen((c) => ({ ...c, [kind]: allLanes.map((l) => l.id) }))}>All</button>
            <button className="text-xs underline text-[hsl(var(--muted-foreground))]" onClick={() => setChosen((c) => ({ ...c, [kind]: undefined }))}>First {FIRST_LANES}</button>
          </div>
          <ul className="mt-2 flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto text-xs">
            {shown.map((l) => (
              <li key={l.id}>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={isShown(l.id)} onChange={() => toggleLane(l.id)} />
                  {l.name} <span className="text-[hsl(var(--muted-foreground))]">({l.sceneIds.length})</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative flex-1 overflow-auto" data-testid="story-time">
        <div className="relative" style={{ width, height: layout.height + 8 }}>
          {/* The axis */}
          <div className="sticky top-0 z-20 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]" style={{ height: AXIS_H, width }} aria-hidden="true">
            {(() => {
              // A label only where the last has ended: about 6 px a character at this size.
              let lastEnd = -Infinity
              return axis.ticks.map((t) => {
                const x = LANE_LABEL_W + t.x
                const text = tickLabel(calendar, t.day, zoom)
                const label = x >= lastEnd + 12 && !axis.breaks.some((b) => Math.abs(LANE_LABEL_W + b.x - x) < 40)
                if (label) lastEnd = x + text.length * 6
                return (
                  <div key={`${t.day}`} className="absolute bottom-0" style={{ left: x }}>
                    <div className={cn('w-px bg-[hsl(var(--border))]', label ? 'h-3' : 'h-1.5')} />
                    {label && <span className="absolute bottom-3 left-1 whitespace-nowrap text-[10px] text-[hsl(var(--muted-foreground))]">{text}</span>}
                  </div>
                )
              })
            })()}
            {axis.breaks.map((b) => (
              <span key={b.x} className="absolute bottom-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-[hsl(var(--muted))] px-1 text-[10px] text-[hsl(var(--muted-foreground))]" style={{ left: LANE_LABEL_W + b.x }}>
                {spanLabel(b.days)}
              </span>
            ))}
          </div>

          {/* The cut stretches, down the whole height */}
          {axis.breaks.map((b) => (
            <div key={`cut-${b.x}`} aria-hidden="true" className="absolute border-x border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)]" style={{ left: LANE_LABEL_W + b.x - 6, width: 12, top: AXIS_H, height: layout.height - AXIS_H }} />
          ))}

          {/* Lanes */}
          {layout.rows.map(({ lane, y, h }) => {
            const person = kind !== 'threads' ? characters.find((c) => c.id === lane.id) : undefined
            return (
              <div key={lane.id} className="absolute left-0 border-b border-[hsl(var(--border)/0.6)]" style={{ top: y, height: h, width }}>
                <div
                  className="sticky left-0 z-10 flex h-full items-start gap-1.5 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 pt-2 text-xs font-medium"
                  style={{ width: LANE_LABEL_W, borderLeft: person ? `3px solid ${charColor(person)}` : undefined }}
                >
                  <span className="truncate" title={lane.name}>{lane.name}</span>
                  <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{lane.sceneIds.length}</span>
                </div>
              </div>
            )
          })}

          {/* The path, on request (D-6) */}
          {showPath && (
            <svg className="pointer-events-none absolute left-0 top-0 z-10" width={width} height={layout.height} aria-hidden="true" data-testid="story-time-path">
              {lanes.flatMap((lane) => laneSteps(lane, timedById).map((s) => {
                const a = byKey.get(`${lane.id}:${s.from}`)
                const b = byKey.get(`${lane.id}:${s.to}`)
                if (!a || !b) return null
                const p = centre(a), q = centre(b)
                return (
                  <line
                    key={`${lane.id}:${s.from}:${s.to}`}
                    x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                    data-back={s.back || undefined}
                    stroke={s.back ? 'rgb(217 119 6)' : 'hsl(var(--muted-foreground) / 0.5)'}
                    strokeWidth={s.back ? 2 : 1}
                    strokeDasharray={s.back ? '4 3' : undefined}
                  />
                )
              }))}
            </svg>
          )}

          {/* Blocks: one tab stop, in telling order (D-8) */}
          <div ref={blocksRef} role="group" aria-label="Scenes in telling order" onKeyDown={onKeyDown} className="absolute left-0 top-0 z-[15]">
            {layout.placed.map((p, i) => {
              const s = p.scene
              const label = describe(p)
              return (
                <button
                  key={p.key}
                  data-block={i}
                  data-scene={s.id}
                  tabIndex={i === safeFocus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onClick={() => open(s.id)}
                  aria-label={label}
                  title={label}
                  className={cn(
                    'absolute flex items-center justify-center gap-0.5 rounded border text-[10px] font-medium tabular-nums transition-colors',
                    'bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                    s.undated ? 'border-dashed border-amber-500/70' : 'border-[hsl(var(--border))]',
                    s.jumpBack !== null && 'border-2 border-amber-500',
                    p.elsewhere === 'back' && 'ring-2 ring-red-500',
                  )}
                  style={{ left: LANE_LABEL_W + p.x, top: p.y, width: BLOCK_W, height: BLOCK_H }}
                >
                  {s.jumpBack !== null && <Undo2 className="h-2.5 w-2.5 shrink-0 text-amber-600" aria-hidden="true" />}
                  {s.flashback && s.jumpBack === null && <History className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden="true" />}
                  <span>{s.telling}</span>
                  {p.elsewhere && (
                    <span
                      aria-hidden="true"
                      className={cn('absolute -right-1 -top-1 h-2 w-2 rounded-full', p.elsewhere === 'back' ? 'bg-red-500' : 'bg-sky-500')}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
        <span>Numbers are the order the book tells them in.</span>
        <span className="flex items-center gap-1"><Undo2 className="h-3 w-3 text-amber-600" aria-hidden="true" /> jumps back in time</span>
        <span className="flex items-center gap-1"><History className="h-3 w-3" aria-hidden="true" /> flashback</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" /> in more than one place that day</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> back on a day somewhere else</span>
        <span className="flex items-center gap-1"><CircleDashed className="h-3 w-3" aria-hidden="true" /> undated</span>
      </div>
    </div>
  )
}
