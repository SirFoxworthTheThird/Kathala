import type { Chapter, Timeline, WorldEvent } from '@/types'
import { computeInWorldDays, provisionallyDatedEvents, type ClockRules } from '@/lib/inWorldTime'
import { bookPosition } from '@/lib/bookOrder'

/*
  Story time against telling order (issue #703). The book's scenes laid out by
  when they happen, in lanes — a character, a thread, a point of view — with
  each scene's place in the telling on it. Pure: the view draws what this says.
  The decisions are in `docs/records/story-time-plan.md`.
*/

/** What story time reads of a scene. */
export type StoryTimeScene = Pick<WorldEvent, 'id' | 'chapterId' | 'sortOrder' | 'timelineId' | 'title'>
  & Partial<Pick<WorldEvent, 'travelDays' | 'inWorldTime' | 'isFlashback' | 'involvedCharacterIds' | 'threadIds' | 'povCharacterId'>>

/** A scene in story time. */
export interface TimedScene {
  id: string
  title: string
  /** The in-world day, as the Calendar has it (D-4): `computeInWorldDays`, fractions and all. */
  day: number
  /** The whole day it falls on, as the Calendar's grid has it. */
  wholeDay: number
  /** Its place in the telling, 1 to n over the scenes given. */
  telling: number
  /** The clock derived its day rather than anyone saying it (D-4): placed by the telling, drawn as undated. */
  undated: boolean
  flashback: boolean
  /**
   * Whole days it goes back from the dated scene told just before it (D-6), or
   * null where it does not. An undated scene neither jumps nor is jumped from:
   * its day is where the clock happened to be.
   */
  jumpBack: number | null
}

/**
 * Every scene given, in telling order, at its day. The days are the Calendar's,
 * by the same function and inputs (D-4), so the two views cannot disagree.
 */
export function timeScenes(
  scenes: readonly StoryTimeScene[],
  chapters: ReadonlyArray<Pick<Chapter, 'id' | 'number'>>,
  timelines?: ReadonlyArray<Pick<Timeline, 'id' | 'dayOffset'>>,
  rules: ClockRules = {},
): TimedScene[] {
  const days = computeInWorldDays(scenes, chapters, timelines, rules)
  const undated = provisionallyDatedEvents(scenes as WorldEvent[], chapters as Chapter[])
  const numbers = new Map(chapters.map((c) => [c.id, c.number]))
  const ordered = [...scenes].sort((a, b) =>
    bookPosition(numbers.get(a.chapterId) ?? 0, a.sortOrder) - bookPosition(numbers.get(b.chapterId) ?? 0, b.sortOrder))
  const out: TimedScene[] = []
  let lastDated: number | null = null
  for (const s of ordered) {
    const day = days.get(s.id)
    if (day === undefined) continue
    const wholeDay = Math.floor(day)
    const isUndated = undated.has(s.id)
    let jumpBack: number | null = null
    if (!isUndated) {
      if (lastDated !== null && wholeDay < lastDated) jumpBack = lastDated - wholeDay
      lastDated = wholeDay
    }
    out.push({
      id: s.id,
      title: s.title,
      day,
      wholeDay,
      telling: out.length + 1,
      undated: isUndated,
      flashback: !!s.isFlashback,
      jumpBack,
    })
  }
  return out
}

// ── Lanes (D-7) ──────────────────────────────────────────────────────────────

export type LaneKind = 'characters' | 'threads' | 'pov'

export interface Lane {
  /** The character's or the thread's id. */
  id: string
  name: string
  /** Its scenes, in telling order. */
  sceneIds: string[]
}

/** The ids a scene puts in lanes of this kind. */
function laneIdsOf(kind: LaneKind, s: StoryTimeScene): readonly string[] {
  if (kind === 'characters') return s.involvedCharacterIds ?? []
  if (kind === 'threads') return s.threadIds ?? []
  return s.povCharacterId ? [s.povCharacterId] : []
}

/**
 * Every lane of a kind that has a scene, most scenes first, then by name. A
 * character's lane is the scenes they are on stage in; a thread's, the scenes
 * on it; a point of view's, the scenes told from it. `named` is who and what
 * may have a lane — in reading mode, only those the reader has met.
 */
export function lanesOf(
  kind: LaneKind,
  scenes: readonly StoryTimeScene[],
  timed: readonly TimedScene[],
  named: ReadonlyArray<{ id: string; name: string }>,
): Lane[] {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  const names = new Map(named.map((n) => [n.id, n.name]))
  const lanes = new Map<string, Lane>()
  for (const t of timed) {
    const s = byId.get(t.id)
    if (!s) continue
    for (const id of new Set(laneIdsOf(kind, s))) {
      const name = names.get(id)
      if (name === undefined) continue
      const lane = lanes.get(id)
      if (lane) lane.sceneIds.push(t.id)
      else lanes.set(id, { id, name, sceneIds: [t.id] })
    }
  }
  return [...lanes.values()].sort((a, b) => b.sceneIds.length - a.sceneIds.length || a.name.localeCompare(b.name))
}

/** How many lanes are shown before anyone chooses (D-7). */
export const FIRST_LANES = 8

// ── Places on one day (D-1) ─────────────────────────────────────────────────

export interface DayPlaces {
  personId: string
  /** The whole day. */
  day: number
  /** Their dated scenes on that day, in telling order. */
  sceneIds: string[]
  /** The places they are in on it, in the order the telling reaches them. */
  places: string[]
  /**
   * The scenes at which the telling, having left this person's day for another
   * day, comes back to it with them somewhere else from where it left them.
   * Empty where they only move through the day (*moved during the day*).
   */
  backSceneIds: string[]
}

/**
 * Each day on which someone is in more than one place (D-1). `appearances` is
 * each person's scenes, any order; `placeOf` says where they are at a scene —
 * their state there — or nothing where nothing says. Undated scenes take no
 * part: their day is not when they happen.
 *
 * A move through the day is travel, and `travel-dist` asks whether it was
 * possible. What is reported as *back* is the braided case: the telling leaves
 * the day — the person is in a scene on another day — and returns to it with
 * them in a different place from the one it left them in.
 */
export function placesOnOneDay(
  timed: readonly TimedScene[],
  appearances: ReadonlyMap<string, readonly string[]>,
  placeOf: (personId: string, sceneId: string) => string | null | undefined,
): DayPlaces[] {
  const byId = new Map(timed.map((t) => [t.id, t]))
  const out: DayPlaces[] = []
  for (const [personId, ids] of appearances) {
    const own = ids
      .map((id) => byId.get(id))
      .filter((t): t is TimedScene => !!t && !t.undated)
      .sort((a, b) => a.telling - b.telling)
    const byDay = new Map<number, number[]>()
    own.forEach((t, i) => {
      const list = byDay.get(t.wholeDay)
      if (list) list.push(i)
      else byDay.set(t.wholeDay, [i])
    })
    for (const [day, at] of byDay) {
      const places: string[] = []
      for (const i of at) {
        const p = placeOf(personId, own[i].id)
        if (p && !places.includes(p)) places.push(p)
      }
      if (places.length < 2) continue
      const backSceneIds: string[] = []
      for (let k = 1; k < at.length; k++) {
        const i = at[k - 1]
        const j = at[k]
        // Consecutive among this day's scenes but not among theirs: the telling went to another of their days between.
        if (j === i + 1) continue
        const left = placeOf(personId, own[i].id)
        const back = placeOf(personId, own[j].id)
        if (left && back && left !== back) backSceneIds.push(own[j].id)
      }
      out.push({ personId, day, sceneIds: at.map((i) => own[i].id), places, backSceneIds })
    }
  }
  return out.sort((a, b) => a.day - b.day || a.personId.localeCompare(b.personId))
}

// ── The axis (D-5) ──────────────────────────────────────────────────────────

export type Zoom = 'days' | 'weeks' | 'months' | 'years'
export const ZOOMS: readonly Zoom[] = ['days', 'weeks', 'months', 'years']
export const DAYS_PER: Record<Zoom, number> = { days: 1, weeks: 7, months: 30.44, years: 365.25 }
/** Pixels per day, week, month or year. */
export const UNIT_PX = 48
/** A gap wider than this at the zoom is cut. */
export const MAX_GAP_PX = 160
/** And drawn this wide. */
export const BREAK_PX = 48
/** The space before the first day and after the last. */
export const EDGE_PX = 24
/** The widest the whole book may be at the opening zoom. */
export const FIT_PX = 2400

export interface AxisBreak {
  /** Where the break's middle is drawn. */
  x: number
  /** How many days it leaves out. */
  days: number
}

export interface Axis {
  zoom: Zoom
  /** Where a whole day is. Days between drawn days are interpolated; days past the ends extrapolated. */
  x(wholeDay: number): number
  width: number
  breaks: AxisBreak[]
  /** Days worth a tick: each run's first day, then one a unit along, while the run lasts. */
  ticks: Array<{ x: number; day: number }>
}

/** Pixels per day at a zoom. */
export function pxPerDay(zoom: Zoom): number {
  return UNIT_PX / DAYS_PER[zoom]
}

/**
 * The axis over these whole days at a zoom, with empty stretches cut (D-5).
 * Only time between days that hold scenes is ever cut, and a cut is said.
 */
export function axisOf(wholeDays: Iterable<number>, zoom: Zoom): Axis {
  const days = [...new Set(wholeDays)].sort((a, b) => a - b)
  const ppd = pxPerDay(zoom)
  const xs = new Map<number, number>()
  const breaks: AxisBreak[] = []
  const runs: Array<{ from: number; to: number; x: number }> = []
  let x = EDGE_PX
  days.forEach((d, i) => {
    if (i > 0) {
      const gap = d - days[i - 1]
      const px = gap * ppd
      if (px > MAX_GAP_PX) {
        breaks.push({ x: x + BREAK_PX / 2, days: gap })
        x += BREAK_PX
        runs.push({ from: d, to: d, x })
      } else {
        x += px
        runs[runs.length - 1].to = d
      }
    } else runs.push({ from: d, to: d, x })
    xs.set(d, x)
  })
  const width = days.length ? x + EDGE_PX + UNIT_PX : 0
  const ticks: Array<{ x: number; day: number }> = []
  const step = Math.max(1, Math.round(DAYS_PER[zoom]))
  for (const run of runs) {
    for (let d = run.from; d <= run.to; d += step) ticks.push({ x: run.x + (d - run.from) * ppd, day: d })
  }
  return {
    zoom,
    width,
    breaks,
    ticks,
    x(wholeDay) {
      const at = xs.get(wholeDay)
      if (at !== undefined) return at
      // A day no scene is on: where it would fall in its run, or at the run's edge.
      const run = runs.find((r) => wholeDay >= r.from && wholeDay <= r.to)
        ?? (wholeDay < (runs[0]?.from ?? 0) ? runs[0] : runs[runs.length - 1])
      return run ? run.x + (wholeDay - run.from) * ppd : EDGE_PX
    },
  }
}

/** The finest zoom at which these days fit the opening width, else years (D-5). */
export function openingZoom(wholeDays: Iterable<number>): Zoom {
  const days = [...wholeDays]
  for (const z of ZOOMS) if (axisOf(days, z).width <= FIT_PX) return z
  return 'years'
}

/** A gap's length, in words, for its break (D-5). */
export function spanLabel(days: number): string {
  const n = (v: number, one: string) => `${v} ${one}${v === 1 ? '' : 's'}`
  if (days < 14) return n(days, 'day')
  if (days < 61) return n(Math.round(days / 7), 'week')
  if (days < 730) return n(Math.round(days / 30.44), 'month')
  return n(Math.round(days / 365.25), 'year')
}

// ── Blocks (D-5, D-6) ───────────────────────────────────────────────────────

/** A block's width and height, and the room left between two in a row. */
export const BLOCK_W = 30
export const BLOCK_H = 22
export const BLOCK_GAP = 2

export interface Block {
  sceneId: string
  laneId: string
  /** Its left edge. */
  x: number
  /** Its row within the lane, 0 at the top. */
  row: number
}

/**
 * A lane's blocks, each at its day's x, stacked where they would touch: by
 * day, then in telling order, each in the first row with room (D-5).
 */
export function packLane(lane: Lane, timed: ReadonlyMap<string, TimedScene>, axis: Axis): { blocks: Block[]; rows: number } {
  const scenes = lane.sceneIds
    .map((id) => timed.get(id))
    .filter((t): t is TimedScene => !!t)
    .sort((a, b) => a.day - b.day || a.telling - b.telling)
  const rowEnds: number[] = []
  const blocks: Block[] = []
  for (const t of scenes) {
    const x = axis.x(t.wholeDay) - BLOCK_W / 2
    let row = rowEnds.findIndex((end) => end + BLOCK_GAP <= x)
    if (row < 0) {
      row = rowEnds.length
      rowEnds.push(x + BLOCK_W)
    } else rowEnds[row] = x + BLOCK_W
    blocks.push({ sceneId: t.id, laneId: lane.id, x, row })
  }
  return { blocks, rows: Math.max(1, rowEnds.length) }
}

/** A step of a lane's path (D-6): from one of its scenes to the next it is in, in telling order. */
export interface PathStep {
  from: string
  to: string
  /** The step goes to an earlier day. */
  back: boolean
}

/** A lane's path through its scenes in telling order. Undated scenes are stepped through but never go back. */
export function laneSteps(lane: Lane, timed: ReadonlyMap<string, TimedScene>): PathStep[] {
  const steps: PathStep[] = []
  for (let i = 1; i < lane.sceneIds.length; i++) {
    const a = timed.get(lane.sceneIds[i - 1])
    const b = timed.get(lane.sceneIds[i])
    if (!a || !b) continue
    steps.push({ from: a.id, to: b.id, back: !a.undated && !b.undated && b.wholeDay < a.wholeDay })
  }
  return steps
}
