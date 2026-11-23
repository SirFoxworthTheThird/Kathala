import { describe, it, expect } from 'vitest'
import {
  axisOf, BLOCK_W, BREAK_PX, EDGE_PX, FIT_PX, laneSteps, lanesOf, MAX_GAP_PX, openingZoom, packLane, placesOnOneDay,
  pxPerDay, spanLabel, timeScenes, UNIT_PX, type StoryTimeScene, type TimedScene,
} from '@/lib/storyTime'
import { buildCalendarMonths } from '@/lib/calendarView'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { Chapter, Character, CharacterSnapshot, LocationMarker, Timeline, WorldCalendar, WorldEvent } from '@/types'

/*
  Story time against telling order (issue #703): docs/records/story-time-plan.md.
*/

const fixtures = import.meta.glob('../../test/fixtures/worlds/*.pwk', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function chapter(id: string, number: number, timelineId = 't1'): Chapter {
  return { id, worldId: 'w', timelineId, number, title: `Ch ${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function scene(id: string, chapterId: string, sortOrder: number, opts: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null,
    structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0, ...opts,
  }
}

const byId = (timed: TimedScene[]) => new Map(timed.map((t) => [t.id, t]))

describe('the days are the Calendar’s (D-4)', () => {
  const books = ['v7-strange-case-of-dr-jekyll-and-mr-hyde', 'v16-neuromancer', 'v18-harry-potter-and-the-philosopher-s-stone']
  for (const name of books) {
    it(`for every scene of ${name}`, () => {
      const raw = Object.entries(fixtures).find(([p]) => p.includes(name))?.[1]
      expect(raw, name).toBeTruthy()
      const book = JSON.parse(raw!) as { world: { calendar: WorldCalendar; pinsSetClock?: boolean }; events: WorldEvent[]; chapters: Chapter[]; timelines: Timeline[] }
      const rules = { pinsSetClock: book.world.pinsSetClock }
      const months = buildCalendarMonths({ events: book.events, chapters: book.chapters, calendar: book.world.calendar, timelines: book.timelines, rules })
      const calendarDay = new Map<string, number>()
      for (const m of months) for (const list of m.eventsByDay.values()) for (const e of list) calendarDay.set(e.id, e.dayNumber)
      const timed = timeScenes(book.events, book.chapters, book.timelines, rules)
      expect(timed).toHaveLength(book.events.length)
      expect(calendarDay.size).toBe(book.events.length)
      for (const t of timed) expect(t.day, t.title).toBe(calendarDay.get(t.id))
      // The undated are the Calendar's provisional ones, scene for scene.
      const provisional = new Set<string>()
      for (const m of months) for (const list of m.eventsByDay.values()) for (const e of list) if (e.provisional) provisional.add(e.id)
      expect(new Set(timed.filter((t) => t.undated).map((t) => t.id))).toEqual(provisional)
    })
  }

  it('and Jekyll and Hyde jumps back where its telling does', () => {
    const raw = Object.entries(fixtures).find(([p]) => p.includes('jekyll'))![1]
    const book = JSON.parse(raw) as { events: WorldEvent[]; chapters: Chapter[]; timelines: Timeline[] }
    const timed = timeScenes(book.events, book.chapters, book.timelines)
    const jumps = timed.filter((t) => t.jumpBack !== null)
    expect(jumps.length).toBeGreaterThan(0)
    for (const j of jumps) {
      const before = timed.slice(0, j.telling - 1).filter((t) => !t.undated).at(-1)!
      expect(j.wholeDay).toBeLessThan(before.wholeDay)
      expect(j.jumpBack).toBe(before.wholeDay - j.wholeDay)
    }
  })
})

describe('telling order and jumps back (D-6)', () => {
  const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)]

  it('numbers the scenes in the telling, across chapters, whatever order they come in', () => {
    const scenes = [
      scene('c', 'c3', 0, { inWorldTime: 30 }),
      scene('a', 'c1', 0, { inWorldTime: 10 }),
      scene('b2', 'c2', 1, { inWorldTime: 21 }),
      scene('b1', 'c2', 0, { inWorldTime: 20 }),
    ]
    expect(timeScenes(scenes, chapters).map((t) => [t.id, t.telling])).toEqual([['a', 1], ['b1', 2], ['b2', 3], ['c', 4]])
  })

  it('marks a scene set before the scene told just before it, with how far back', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 100 }),
      scene('b', 'c2', 0, { inWorldTime: 48, isFlashback: true }),
      scene('c', 'c3', 0, { inWorldTime: 101 }),
    ]
    const t = byId(timeScenes(scenes, chapters))
    expect(t.get('a')!.jumpBack).toBeNull()
    expect(t.get('b')!.jumpBack).toBe(52)
    expect(t.get('b')!.flashback).toBe(true)
    // Forward again from the flashback is not a jump.
    expect(t.get('c')!.jumpBack).toBeNull()
  })

  it('counts a jump in whole days: a later hour of the same day is not one', () => {
    const scenes = [scene('a', 'c1', 0, { inWorldTime: 10.75 }), scene('b', 'c2', 0, { inWorldTime: 10.1 })]
    expect(byId(timeScenes(scenes, chapters)).get('b')!.jumpBack).toBeNull()
  })

  it('compares a scene with the dated scene before it, stepping over the undated', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 40 }),
      scene('u', 'c2', 0, { isFlashback: true }), // a flashback with no date of its own
      scene('b', 'c3', 0, { inWorldTime: 30 }),
    ]
    const t = byId(timeScenes(scenes, chapters))
    expect(t.get('u')!.undated).toBe(true)
    expect(t.get('u')!.jumpBack).toBeNull()
    expect(t.get('b')!.jumpBack).toBe(10)
  })

  it('places an undated scene where the telling puts it, and says it is undated', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 5 }),
      scene('u', 'c2', 0), // no timing: the clock stands still
      scene('b', 'c3', 0, { travelDays: 3 }),
    ]
    const t = byId(timeScenes(scenes, chapters))
    expect(t.get('u')).toMatchObject({ undated: true, day: 0, telling: 2 })
    expect(t.get('a')!.undated).toBe(false)
    expect(t.get('b')!.undated).toBe(false)
    // The first scene on a timeline is dated by being first.
    expect(byId(timeScenes([scene('first', 'c1', 0)], chapters)).get('first')!.undated).toBe(false)
  })

  it('lays timelines on one axis by their offsets, as the Calendar does', () => {
    const chs = [chapter('c1', 1, 't1'), chapter('c2', 2, 't2')]
    const scenes = [scene('now', 'c1', 0, { inWorldTime: 5 }), scene('then', 'c2', 0, { timelineId: 't2', inWorldTime: 5 })]
    const t = byId(timeScenes(scenes, chs, [{ id: 't1', dayOffset: 1000 }, { id: 't2', dayOffset: 0 }]))
    expect(t.get('now')!.day).toBe(1005)
    expect(t.get('then')!.day).toBe(5)
    expect(t.get('then')!.jumpBack).toBe(1000)
  })
})

describe('lanes (D-7)', () => {
  const chapters = [chapter('c1', 1)]
  const scenes: StoryTimeScene[] = [
    scene('s1', 'c1', 0, { involvedCharacterIds: ['mina', 'jon'], threadIds: ['hunt'], povCharacterId: 'mina' }),
    scene('s2', 'c1', 1, { involvedCharacterIds: ['mina'], threadIds: ['hunt', 'love'], povCharacterId: 'jon' }),
    scene('s3', 'c1', 2, { involvedCharacterIds: ['mina', 'mina', 'van'], povCharacterId: 'mina' }),
  ]
  const named = [{ id: 'mina', name: 'Mina' }, { id: 'jon', name: 'Jonathan' }, { id: 'van', name: 'Van Helsing' }, { id: 'hunt', name: 'The hunt' }, { id: 'love', name: 'Love' }]
  const timed = timeScenes(scenes, chapters)

  it('a character’s lane is the scenes they are on stage in, most scenes first, then by name', () => {
    expect(lanesOf('characters', scenes, timed, named).map((l) => [l.name, l.sceneIds])).toEqual([
      ['Mina', ['s1', 's2', 's3']],
      ['Jonathan', ['s1']],
      ['Van Helsing', ['s3']],
    ])
  })

  it('a thread’s is the scenes on it, and a point of view’s the scenes told from it', () => {
    expect(lanesOf('threads', scenes, timed, named).map((l) => [l.id, l.sceneIds])).toEqual([['hunt', ['s1', 's2']], ['love', ['s2']]])
    expect(lanesOf('pov', scenes, timed, named).map((l) => [l.id, l.sceneIds])).toEqual([['mina', ['s1', 's3']], ['jon', ['s2']]])
  })

  it('has no lane for anyone not named — a reader’s unmet — and none for a scene not given', () => {
    const lanes = lanesOf('characters', scenes, timed.filter((t) => t.id !== 's3'), named.filter((n) => n.id !== 'jon'))
    expect(lanes.map((l) => [l.id, l.sceneIds])).toEqual([['mina', ['s1', 's2']]])
  })
})

describe('places on one day (D-1)', () => {
  const chapters = [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3), chapter('c4', 4)]

  /** Mina: Whitby on day 10, then day 11, then the telling comes back to day 10 with her in London. */
  const braided = () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('b', 'c2', 0, { inWorldTime: 11, involvedCharacterIds: ['mina'] }),
      scene('c', 'c3', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string> = { a: 'whitby', b: 'whitby', c: 'london' }
    return { timed: timeScenes(scenes, chapters), at }
  }
  const appearances = (ids: string[]) => new Map([['mina', ids]])

  it('reports coming back to a day with someone elsewhere as back', () => {
    const { timed, at } = braided()
    expect(placesOnOneDay(timed, appearances(['a', 'b', 'c']), (_p, s) => at[s])).toEqual([
      { personId: 'mina', day: 10, sceneIds: ['a', 'c'], places: ['whitby', 'london'], backSceneIds: ['c'] },
    ])
  })

  it('a move through the day is two places and not back', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('b', 'c2', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('c', 'c3', 0, { inWorldTime: 11, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string> = { a: 'whitby', b: 'london', c: 'london' }
    expect(placesOnOneDay(timeScenes(scenes, chapters), appearances(['a', 'b', 'c']), (_p, s) => at[s])).toEqual([
      { personId: 'mina', day: 10, sceneIds: ['a', 'b'], places: ['whitby', 'london'], backSceneIds: [] },
    ])
  })

  it('coming back to the place the telling left them in is nothing', () => {
    const { timed } = braided()
    const at: Record<string, string> = { a: 'whitby', b: 'london', c: 'whitby' }
    expect(placesOnOneDay(timed, appearances(['a', 'b', 'c']), (_p, s) => at[s])).toEqual([])
  })

  it('compares the return with where they were last on that day, not first', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('a2', 'c1', 1, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('b', 'c2', 0, { inWorldTime: 11, involvedCharacterIds: ['mina'] }),
      scene('c', 'c3', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string> = { a: 'whitby', a2: 'london', b: 'london', c: 'london' }
    const [day] = placesOnOneDay(timeScenes(scenes, chapters), appearances(['a', 'a2', 'b', 'c']), (_p, s) => at[s])
    expect(day.backSceneIds).toEqual([])
    expect(day.places).toEqual(['whitby', 'london'])
  })

  it('needs a scene of theirs on another day between: another person’s scene is not leaving their day', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('x', 'c2', 0, { inWorldTime: 11, involvedCharacterIds: ['jon'] }),
      scene('c', 'c3', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string> = { a: 'whitby', c: 'london' }
    const [day] = placesOnOneDay(timeScenes(scenes, chapters), appearances(['a', 'c']), (_p, s) => at[s])
    expect(day.backSceneIds).toEqual([])
  })

  it('leaves out undated scenes and places nobody said', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      scene('u', 'c2', 0, { isFlashback: true, involvedCharacterIds: ['mina'] }), // clock says day 10; not its date
      scene('n', 'c3', 0, { travelDays: 0, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string | null> = { a: 'whitby', u: 'london', n: null }
    expect(placesOnOneDay(timeScenes(scenes, chapters), appearances(['a', 'u', 'n']), (_p, s) => at[s])).toEqual([])
  })

  it('takes whole days: two hours of one day are one day', () => {
    const scenes = [
      scene('a', 'c1', 0, { inWorldTime: 10.2, involvedCharacterIds: ['mina'] }),
      scene('b', 'c2', 0, { inWorldTime: 11, involvedCharacterIds: ['mina'] }),
      scene('c', 'c3', 0, { inWorldTime: 10.9, involvedCharacterIds: ['mina'] }),
    ]
    const at: Record<string, string> = { a: 'whitby', b: 'whitby', c: 'london' }
    expect(placesOnOneDay(timeScenes(scenes, chapters), appearances(['a', 'b', 'c']), (_p, s) => at[s])[0].backSceneIds).toEqual(['c'])
  })
})

describe('the Continuity Checker reports coming back to a day elsewhere (D-1)', () => {
  function input(cPlace: string): ContinuityInput {
    const character = (id: string, name: string): Character => ({ id, worldId: 'w', name, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 })
    const marker = (id: string, name: string): LocationMarker => ({ id, worldId: 'w', mapLayerId: 'map1', linkedMapLayerId: null, name, description: '', x: 0, y: 0, imageId: null, iconType: 'building', tags: [], factionId: null, createdAt: 0, updatedAt: 0 })
    const placed = (id: string, eventId: string, markerId: string): CharacterSnapshot => ({
      id, worldId: 'w', characterId: 'mina', eventId, isAlive: true, currentLocationMarkerId: markerId, currentMapLayerId: 'map1',
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0,
    })
    return {
      worldId: 'w', world: undefined, timelines: [{ id: 't1', dayOffset: 0 } as Timeline],
      chapters: [chapter('c1', 1), chapter('c2', 2), chapter('c3', 3)],
      allEvents: [
        scene('a', 'c1', 0, { title: 'At the abbey', inWorldTime: 10, involvedCharacterIds: ['mina'] }),
        scene('b', 'c2', 0, { title: 'Next morning', inWorldTime: 11, involvedCharacterIds: ['mina'] }),
        scene('c', 'c3', 0, { title: 'Meanwhile', inWorldTime: 10, involvedCharacterIds: ['mina'] }),
      ],
      characters: [character('mina', 'Mina')],
      snapshots: [placed('s1', 'a', 'whitby'), placed('s3', 'c', cPlace)],
      allMarkers: [marker('whitby', 'Whitby'), marker('london', 'London')],
      rels: [], items: [], knowledgeFacts: [], knowledgeReveals: [], sceneTexts: [], allRelSnaps: [],
      allItemPlacements: [], allLocationSnapshots: [], allLayers: [], travelModes: [], allMovements: [], artifacts: [],
      allMapRoutes: [], allMapRegions: [], allRegionSnapshots: [], allFactions: [], allMemberships: [], allFactionRels: [],
      allItemSnapshots: [], plotThreads: [],
    }
  }

  it('naming both places and both scenes, as a warning at the scene that comes back', () => {
    const found = computeContinuityIssues(input('london')).filter((i) => i.kind === 'same-day-elsewhere')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ severity: 'warning', category: 'character', eventId: 'c' })
    expect(found[0].message).toBe('Mina is at "London" in "Meanwhile" and at "Whitby" in "At the abbey", on the same day')
    expect(found[0].detail).toContain('Ch. 3 comes back to day 10 after Ch. 1')
  })

  it('and not where the return finds them where the telling left them', () => {
    expect(computeContinuityIssues(input('whitby')).filter((i) => i.kind === 'same-day-elsewhere')).toEqual([])
  })
})

describe('the axis (D-5)', () => {
  it('puts days a zoom unit apart UNIT_PX apart, and cuts a gap wider than MAX_GAP_PX into a labelled break', () => {
    const axis = axisOf([0, 1, 3, 400, 401], 'days')
    expect(axis.x(0)).toBe(EDGE_PX)
    expect(axis.x(1) - axis.x(0)).toBe(UNIT_PX)
    expect(axis.x(3) - axis.x(1)).toBe(2 * UNIT_PX) // 96 px: under the cut
    expect(axis.breaks).toEqual([{ x: axis.x(3) + BREAK_PX / 2, days: 397 }])
    expect(axis.x(400) - axis.x(3)).toBe(BREAK_PX)
    expect(axis.x(401) - axis.x(400)).toBe(UNIT_PX)
  })

  it('cuts by pixels at the zoom: a gap cut at days is kept at years', () => {
    expect(axisOf([0, 400], 'days').breaks).toHaveLength(1)
    expect(axisOf([0, 400], 'years').breaks).toEqual([])
    expect(axisOf([0, 400], 'years').x(400) - EDGE_PX).toBeCloseTo(400 * pxPerDay('years'))
    // Just under and just over the cut.
    const under = Math.floor(MAX_GAP_PX / UNIT_PX)
    expect(axisOf([0, under], 'days').breaks).toEqual([])
    expect(axisOf([0, under + 1], 'days').breaks).toHaveLength(1)
  })

  it('places a day no scene is on within its run', () => {
    const axis = axisOf([0, 2], 'days')
    expect(axis.x(1)).toBe(EDGE_PX + UNIT_PX)
  })

  it('ticks each run from its first day, a unit at a time', () => {
    const axis = axisOf([0, 3, 500], 'days')
    expect(axis.ticks.map((t) => t.day)).toEqual([0, 1, 2, 3, 500])
    expect(axis.ticks.map((t) => t.x)).toEqual([0, 1, 2, 3].map((d) => axis.x(d)).concat(axis.x(500)))
    expect(axisOf([0, 20], 'weeks').ticks.map((t) => t.day)).toEqual([0, 7, 14])
  })

  it('opens at the finest zoom that fits, else years', () => {
    expect(openingZoom([0, 10])).toBe('days')
    // 60 consecutive days: 60 × 48 px at days is over the fit, 9 weeks is not.
    const sixty = Array.from({ length: 60 }, (_, i) => i)
    expect(axisOf(sixty, 'days').width).toBeGreaterThan(FIT_PX)
    expect(openingZoom(sixty)).toBe('weeks')
    // Ten thousand days with a scene each fit nowhere.
    expect(openingZoom(Array.from({ length: 10_000 }, (_, i) => i))).toBe('years')
  })

  it('says a gap’s length in words', () => {
    expect([1, 13, 14, 60, 61, 729, 730, 912501].map(spanLabel)).toEqual(['1 day', '13 days', '2 weeks', '9 weeks', '2 months', '24 months', '2 years', '2498 years'])
  })
})

describe('blocks and paths (D-5, D-6)', () => {
  const chapters = [chapter('c1', 1)]
  const lane = (ids: string[]) => ({ id: 'mina', name: 'Mina', sceneIds: ids })

  it('stacks scenes on one day in telling order, and a far day back on the top row', () => {
    const timed = timeScenes([
      scene('a', 'c1', 0, { inWorldTime: 5 }),
      scene('b', 'c1', 1, { inWorldTime: 5 }),
      scene('c', 'c1', 2, { inWorldTime: 5 }),
      scene('d', 'c1', 3, { inWorldTime: 9 }),
    ], chapters)
    const axis = axisOf(timed.map((t) => t.wholeDay), 'days')
    const { blocks, rows } = packLane(lane(['a', 'b', 'c', 'd']), byId(timed), axis)
    expect(blocks.map((b) => [b.sceneId, b.row])).toEqual([['a', 0], ['b', 1], ['c', 2], ['d', 0]])
    expect(rows).toBe(3)
    expect(blocks[0].x).toBe(axis.x(5) - BLOCK_W / 2)
  })

  it('stacks blocks that would touch at a coarse zoom, and never overlaps two in a row', () => {
    const timed = timeScenes(Array.from({ length: 30 }, (_, i) => scene(`s${i}`, 'c1', i, { inWorldTime: i })), chapters)
    const axis = axisOf(timed.map((t) => t.wholeDay), 'months')
    const { blocks, rows } = packLane(lane(timed.map((t) => t.id)), byId(timed), axis)
    expect(rows).toBeGreaterThan(1)
    const byRow = new Map<number, number[]>()
    for (const b of blocks) byRow.set(b.row, [...(byRow.get(b.row) ?? []), b.x])
    for (const xs of byRow.values()) for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(BLOCK_W)
  })

  it('a lane with nothing has one row', () => {
    expect(packLane(lane([]), new Map(), axisOf([], 'days')).rows).toBe(1)
  })

  it('a lane’s path goes scene to scene in telling order, marking each step back in time', () => {
    const timed = timeScenes([
      scene('a', 'c1', 0, { inWorldTime: 10 }),
      scene('b', 'c1', 1, { inWorldTime: 3 }),
      scene('u', 'c1', 2, { isFlashback: true }),
      scene('c', 'c1', 3, { inWorldTime: 12 }),
    ], chapters)
    expect(laneSteps(lane(['a', 'b', 'u', 'c']), byId(timed))).toEqual([
      { from: 'a', to: 'b', back: true },
      { from: 'b', to: 'u', back: false },
      { from: 'u', to: 'c', back: false },
    ])
  })
})
