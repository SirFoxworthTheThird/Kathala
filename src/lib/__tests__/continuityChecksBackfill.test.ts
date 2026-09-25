import { describe, it, expect } from 'vitest'
import { computeContinuityIssues, type ContinuityInput } from '@/lib/continuity/computeIssues'
import type { IssueKind } from '@/lib/continuity/issueKinds'

/**
 * The checks that had no test.
 *
 * Extracting `computeIssues.ts` made every rule directly testable and only a
 * few were ever covered. Running the checker across the forty-six shipped books
 * showed why that matters in both directions: three checks were producing 89%
 * of all output and were wrong, and several others had **never fired on any
 * book at all** — which from the outside is indistinguishable from a check that
 * cannot fire.
 *
 * Each rule below is driven twice, because a check is two claims: it speaks
 * when the world is wrong, and it stays quiet when the world is right. An
 * absence on its own is satisfied by a rule that has been deleted.
 */

const base = (over: Partial<ContinuityInput> = {}): ContinuityInput => ({
  worldId: 'w', world: undefined,
  chapters: [ch('c1', 1), ch('c2', 2)],
  allEvents: [], characters: [], rels: [], items: [], snapshots: [],
  knowledgeFacts: [], knowledgeReveals: [], sceneTexts: [], allRelSnaps: [],
  allItemPlacements: [], allLocationSnapshots: [], allMarkers: [], allLayers: [],
  travelModes: [], allMovements: [], artifacts: [], allMapRoutes: [],
  allMapRegions: [], allRegionSnapshots: [], allFactions: [], allMemberships: [],
  allFactionRels: [], allItemSnapshots: [], plotThreads: [],
  ...over,
})

const ch = (id: string, number: number) =>
  ({ id, worldId: 'w', timelineId: 't', number, title: `Ch ${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }) as never
const ev = (id: string, chapterId: string, sortOrder: number, over: Record<string, unknown> = {}) =>
  ({
    id, worldId: 'w', chapterId, timelineId: 't', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null,
    structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0, ...over,
  }) as never
const person = (id: string, name: string) =>
  ({ id, worldId: 'w', name, aliases: [], description: '', portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: 0, updatedAt: 0 }) as never
const snap = (characterId: string, eventId: string, over: Record<string, unknown> = {}) =>
  ({
    id: `s-${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true,
    currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
    inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: 0, updatedAt: 0, ...over,
  }) as never
const marker = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, worldId: 'w', mapLayerId: 'l1', name: id, description: '', x: 0, y: 0, iconType: 'city', factionId: null, linkedMapLayerId: null, imageId: null, tags: [], createdAt: 0, updatedAt: 0, ...over }) as never

const kinds = (input: ContinuityInput): IssueKind[] => computeContinuityIssues(input).map((i) => i.kind)

describe('a snapshot that has not been touched for five scenes', () => {
  const world = (snapshots: unknown[]) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [0, 1, 2, 3, 4].map((n) => ev(`e${n}`, 'c1', n, { involvedCharacterIds: ['a'] })),
    snapshots: snapshots as never[],
  })

  it('is reported once the run reaches the threshold', () => {
    expect(kinds(world([]))).toContain('stale-snapshot')
  })

  it('is not reported when the run is broken by a record', () => {
    // The default threshold is five involved scenes; a snapshot at the third
    // resets the count, so no run ever reaches it.
    expect(kinds(world([snap('a', 'e2')]))).not.toContain('stale-snapshot')
  })
})

describe('a character standing in a place that has been destroyed', () => {
  const world = (status: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    allMarkers: [marker('m1')],
    allLocationSnapshots: [{ id: 'ls1', worldId: 'w', locationMarkerId: 'm1', eventId: 'e1', status, notes: '', createdAt: 0, updatedAt: 0 } as never],
    snapshots: [snap('a', 'e2', { currentLocationMarkerId: 'm1' })],
  })

  it('is reported when the place was destroyed earlier', () => {
    expect(kinds(world('destroyed'))).toContain('loc-destroyed')
  })

  it('is not reported when the place is still standing', () => {
    expect(kinds(world('intact'))).not.toContain('loc-destroyed')
  })
})

describe('a character standing in hostile territory', () => {
  const world = (stance: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0)],
    allMarkers: [marker('m1', { factionId: 'f2' })],
    allFactions: [
      { id: 'f1', worldId: 'w', name: 'The Guild', description: '', color: null, createdAt: 0, updatedAt: 0 } as never,
      { id: 'f2', worldId: 'w', name: 'The Crown', description: '', color: null, createdAt: 0, updatedAt: 0 } as never,
    ],
    allMemberships: [{ id: 'fm1', worldId: 'w', factionId: 'f1', characterId: 'a', role: null, startEventId: null, endEventId: null, createdAt: 0, updatedAt: 0 } as never],
    allFactionRels: [{ id: 'fr1', worldId: 'w', factionAId: 'f1', factionBId: 'f2', stance, notes: '', createdAt: 0, updatedAt: 0 } as never],
    snapshots: [snap('a', 'e1', { currentLocationMarkerId: 'm1' })],
  })

  it('is reported when the two sides are hostile', () => {
    expect(kinds(world('hostile'))).toContain('hostile-loc')
  })

  it('is not reported when they are allied', () => {
    expect(kinds(world('allied'))).not.toContain('hostile-loc')
  })
})

describe('a relationship snapshot outside the relationship', () => {
  const world = (startEventId: string) => base({
    characters: [person('a', 'Ayla'), person('b', 'Bran')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    rels: [{ id: 'r1', worldId: 'w', characterAId: 'a', characterBId: 'b', type: 'ally', description: '', startEventId, endEventId: null, createdAt: 0, updatedAt: 0 } as never],
    allRelSnaps: [{ id: 'rs1', worldId: 'w', relationshipId: 'r1', eventId: 'e1', sentiment: 0, strength: 1, notes: '', createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when the snapshot comes before the relationship starts', () => {
    expect(kinds(world('e2'))).toContain('rel-before-start')
  })

  it('is not reported when the relationship had already started', () => {
    expect(kinds(world('e1'))).not.toContain('rel-before-start')
  })
})

describe('a relationship snapshot involving someone who has died', () => {
  const world = (isAlive: boolean) => base({
    characters: [person('a', 'Ayla'), person('b', 'Bran')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    rels: [{ id: 'r1', worldId: 'w', characterAId: 'a', characterBId: 'b', type: 'ally', description: '', startEventId: 'e1', endEventId: null, createdAt: 0, updatedAt: 0 } as never],
    snapshots: [snap('b', 'e1', { isAlive })],
    allRelSnaps: [{ id: 'rs1', worldId: 'w', relationshipId: 'r1', eventId: 'e2', sentiment: 0, strength: 1, notes: '', createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when one of them is dead by that scene', () => {
    expect(kinds(world(false))).toContain('dead-char-in-rel-snap')
  })

  it('is not reported while both are alive', () => {
    expect(kinds(world(true))).not.toContain('dead-char-in-rel-snap')
  })
})

describe('a destroyed item still in somebody’s hands', () => {
  const world = (condition: string) => base({
    characters: [person('a', 'Ayla')],
    items: [{ id: 'i1', worldId: 'w', name: 'The Horn', description: '', iconType: 'weapon', imageId: null, tags: [] } as never],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    allItemSnapshots: [{ id: 'is1', worldId: 'w', itemId: 'i1', eventId: 'e1', condition, notes: '', createdAt: 0, updatedAt: 0 } as never],
    snapshots: [snap('a', 'e2', { inventoryItemIds: ['i1'] })],
  })

  it('is reported when the item was destroyed earlier', () => {
    expect(kinds(world('destroyed'))).toContain('item-after-destroyed-inv')
  })

  it('is not reported when the item is merely worn', () => {
    expect(kinds(world('damaged'))).not.toContain('item-after-destroyed-inv')
  })
})

describe('knowing something before it is true', () => {
  const world = (revealEventId: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    knowledgeFacts: [{ id: 'f1', worldId: 'w', title: 'The heir lives', description: '', tags: [], readerLearnsAtEventId: null, originEventId: 'e2', createdAt: 0, updatedAt: 0 } as never],
    knowledgeReveals: [{ id: 'kr1', worldId: 'w', factId: 'f1', characterId: 'a', eventId: revealEventId, notes: '', createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when a character learns it before it happens', () => {
    expect(kinds(world('e1'))).toContain('knowledge-anachronism')
  })

  it('is not reported when they learn it afterwards', () => {
    expect(kinds(world('e2'))).not.toContain('knowledge-anachronism')
  })
})

describe('learning something after dying', () => {
  const world = (deathEventId: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    snapshots: [snap('a', deathEventId, { isAlive: false })],
    knowledgeFacts: [{ id: 'f1', worldId: 'w', title: 'The heir lives', description: '', tags: [], readerLearnsAtEventId: null, originEventId: 'e1', createdAt: 0, updatedAt: 0 } as never],
    knowledgeReveals: [{ id: 'kr1', worldId: 'w', factId: 'f1', characterId: 'a', eventId: 'e2', notes: '', createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when the reveal comes after the death', () => {
    expect(kinds(world('e1'))).toContain('dead-knower')
  })

  it('is not reported when they die afterwards', () => {
    expect(kinds(world('e2'))).not.toContain('dead-knower')
  })
})

/*
  ── The three checks added after the shelf-wide census ─────────────────────

  Each was measured against all forty-six books before it was written, and one
  candidate was dropped on the measurement: *a character in two places on the
  same in-world day* fires 2,496 times, because a day is long enough to walk
  across, and `travel-dist` already asks the question that matters.
*/

describe('joining a faction before the story has met you', () => {
  const world = (startEventId: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0, { involvedCharacterIds: ['a'] })],
    allFactions: [{ id: 'f1', worldId: 'w', name: 'The Guild', description: '', color: null, createdAt: 0, updatedAt: 0 } as never],
    allMemberships: [{ id: 'fm1', worldId: 'w', factionId: 'f1', characterId: 'a', role: null, startEventId, endEventId: null, createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when the membership starts before they appear', () => {
    expect(kinds(world('e1'))).toContain('faction-before-intro')
  })

  it('is not reported when it starts as they appear', () => {
    expect(kinds(world('e2'))).not.toContain('faction-before-intro')
  })

  /*
    A starting state written before the character walks on is ordinary — the
    first appearance is the earlier of the two, so this must stay quiet.
  */
  it('counts a snapshot as an appearance', () => {
    const w = world('e1')
    w.snapshots = [snap('a', 'e1')]
    expect(kinds(w)).not.toContain('faction-before-intro')
  })
})

describe('learning something while recorded somewhere else', () => {
  const world = (over: { charAt?: string; sceneAt?: string; inCast?: boolean } = {}) => base({
    characters: [person('a', 'Ayla')],
    allMarkers: [marker('m1'), marker('m2')],
    allEvents: [
      ev('e1', 'c1', 0),
      ev('e2', 'c2', 0, {
        locationMarkerId: over.sceneAt ?? 'm1',
        involvedCharacterIds: over.inCast ? ['a'] : [],
      }),
    ],
    snapshots: over.charAt ? [snap('a', 'e1', { currentLocationMarkerId: over.charAt })] : [],
    knowledgeFacts: [{ id: 'f1', worldId: 'w', title: 'The heir lives', description: '', tags: [], readerLearnsAtEventId: null, originEventId: 'e1', createdAt: 0, updatedAt: 0 } as never],
    knowledgeReveals: [{ id: 'kr1', worldId: 'w', factId: 'f1', characterId: 'a', eventId: 'e2', notes: '', createdAt: 0, updatedAt: 0 } as never],
  })

  it('is reported when the record puts them at another place', () => {
    expect(kinds(world({ charAt: 'm2' }))).toContain('reveal-elsewhere')
  })

  it('is not reported when they are where the reveal happens', () => {
    expect(kinds(world({ charAt: 'm1' }))).not.toContain('reveal-elsewhere')
  })

  /*
    The two halves that keep this from becoming the naive version, which fires
    130 times across the shelf and is usually right: news travels. Silence is
    the correct answer when the record does not contradict the reveal.
  */
  it('says nothing when the character is in the scene', () => {
    expect(kinds(world({ charAt: 'm2', inCast: true }))).not.toContain('reveal-elsewhere')
  })

  it('says nothing when nothing places the character anywhere', () => {
    expect(kinds(world({}))).not.toContain('reveal-elsewhere')
  })
})

describe('a scene marked done with no draft', () => {
  const world = (status: string, drafted: boolean) => base({
    allEvents: [ev('e1', 'c1', 0, { status }), ev('e2', 'c2', 0, { status: 'final' })],
    sceneTexts: [
      ...(drafted ? [{ id: 'st1', worldId: 'w', eventId: 'e1', text: 'The gate opened.', wordCount: 3, createdAt: 0, updatedAt: 0 } as never] : []),
      // The world has prose somewhere, which is what turns this check on.
      { id: 'st2', worldId: 'w', eventId: 'e2', text: 'Rain on the roof.', wordCount: 4, createdAt: 0, updatedAt: 0 } as never,
    ],
  })

  it('is reported for a final scene with nothing written', () => {
    expect(kinds(world('final', false))).toContain('scene-undrafted')
  })

  it('is not reported once the scene has text', () => {
    expect(kinds(world('final', true))).not.toContain('scene-undrafted')
  })

  it('is not reported for a scene still in progress', () => {
    expect(kinds(world('draft', false))).not.toContain('scene-undrafted')
  })

  /*
    The guard that matters most. A world that is purely structure — a reference
    built from a published book, which is most of the shipped Library — marks
    its scenes final and has no drafts by design. Without this, the check fires
    793 times across the shelf.
  */
  it('says nothing at all in a world with no prose anywhere', () => {
    const structureOnly = base({ allEvents: [ev('e1', 'c1', 0, { status: 'final' })], sceneTexts: [] })
    expect(kinds(structureOnly)).not.toContain('scene-undrafted')
  })
})

/*
  ── The map and the clock ──────────────────────────────────────────────────

  The four checks below all read the same two things the rest of the checker
  never touches: where a marker sits in pixels, and how many in-world days
  passed between two scenes. Their pure halves — `pointInPolygon`,
  `pathCrossesPolygon`, `assessTravel`, `computeInWorldDays` — each have their
  own tests. What none of them can tell you is whether `computeContinuityIssues`
  still calls them, with the right arguments, on data in the shape the database
  actually stores. That wiring is what these drive.
*/

const layer = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id, worldId: 'w', parentMapId: null, name: id, description: '', imageId: null,
    imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null,
    levelGroupId: null, levelIndex: null, levelLabel: null, createdAt: 0, updatedAt: 0, ...over,
  }) as never

/** A square, given its corners — the shape every polygon test here needs. */
const box = (x1: number, y1: number, x2: number, y2: number) =>
  [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]

const region = (id: string, vertices: Array<{ x: number; y: number }>, over: Record<string, unknown> = {}) =>
  ({
    id, worldId: 'w', mapLayerId: 'l1', name: id, vertices, fillColor: '#f00', opacity: 0.3,
    linkedMapLayerId: null, factionId: null, createdAt: 0, updatedAt: 0, ...over,
  }) as never

const regionSnap = (regionId: string, eventId: string, status: string) =>
  ({ id: `rs-${regionId}-${eventId}`, worldId: 'w', regionId, eventId, status, updatedAt: 0 }) as never

describe('a character standing inside a region that has fallen', () => {
  const world = (status: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    allLayers: [layer('l1')],
    // Inside the square, so the finding is about the region rather than the pin.
    allMarkers: [marker('m1', { x: 50, y: 50 })],
    allMapRegions: [region('r1', box(0, 0, 100, 100))],
    allRegionSnapshots: [regionSnap('r1', 'e1', status)],
    snapshots: [snap('a', 'e2', { currentLocationMarkerId: 'm1', currentMapLayerId: 'l1' })],
  })

  it('is reported once the region is destroyed', () => {
    expect(kinds(world('destroyed'))).toContain('char-in-region')
  })

  it('is not reported while the region is intact', () => {
    // `active` is the ordinary state; only `destroyed` and `occupied` are faults,
    // so a region that has a recorded history but a healthy one stays quiet.
    expect(kinds(world('active'))).not.toContain('char-in-region')
  })
})

describe('a journey that goes straight through a ruined region', () => {
  /*
    Both markers sit *outside* the region, so a finding here can only have come
    from the path between them. Otherwise `char-in-region` would fire on the
    same data and this test would pass without the traversal rule existing.
  */
  const world = (status: string) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0)],
    allLayers: [layer('l1')],
    allMarkers: [marker('m1', { x: 0, y: 50 }), marker('m2', { x: 200, y: 50 })],
    allMapRegions: [region('r1', box(80, 0, 120, 100))],
    allRegionSnapshots: [regionSnap('r1', 'e1', status)],
    snapshots: [
      snap('a', 'e1', { currentLocationMarkerId: 'm1', currentMapLayerId: 'l1' }),
      snap('a', 'e2', { currentLocationMarkerId: 'm2', currentMapLayerId: 'l1' }),
    ],
  })

  it('is reported when the region between them is destroyed', () => {
    const issues = computeContinuityIssues(world('destroyed'))
    expect(issues.map((i) => i.kind)).toContain('region-traversal')
    // And the pin checks stay silent, which is what proves the path was walked.
    expect(issues.map((i) => i.kind)).not.toContain('char-in-region')
  })

  it('is not reported when the region between them is fine', () => {
    expect(kinds(world('active'))).not.toContain('region-traversal')
  })
})

describe('a journey longer than the days available for it', () => {
  /*
    A thousand pixels at one pixel per km, on foot at ten km a day: a hundred
    days of walking. The scene's own `travelDays` is the clock — one day is not
    enough and two hundred is plenty — so the same distance is read twice and
    only the time between the scenes changes.
  */
  const world = (travelDays: number) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0, { travelDays })],
    allLayers: [layer('l1', { scalePixelsPerUnit: 1, scaleUnit: 'km' })],
    allMarkers: [marker('m1', { x: 0, y: 0 }), marker('m2', { x: 1000, y: 0 })],
    travelModes: [{ id: 'tm', worldId: 'w', name: 'On foot', speedPerDay: 10, createdAt: 0, updatedAt: 0 } as never],
    snapshots: [
      snap('a', 'e1', { currentLocationMarkerId: 'm1', currentMapLayerId: 'l1', travelModeId: 'tm' }),
      snap('a', 'e2', { currentLocationMarkerId: 'm2', currentMapLayerId: 'l1', travelModeId: 'tm' }),
    ],
  })

  it('is reported when there is nowhere near enough time', () => {
    expect(kinds(world(1))).toContain('travel-dist')
  })

  it('is not reported once the story allows the days it needs', () => {
    expect(kinds(world(200))).not.toContain('travel-dist')
  })

  it('offers the days it is short by, rather than only naming the problem', () => {
    /*
      The fix is the half a writer can act on, and it is computed from the
      shortfall rather than from a constant: 100 days needed, 1 available, so
      99 more. Asserting the number keeps the arithmetic honest — a fix that
      offered a token extra day would look identical from the kind alone.
    */
    const issue = computeContinuityIssues(world(1)).find((i) => i.kind === 'travel-dist')
    expect(issue?.fix).toMatchObject({ kind: 'travelDays', eventId: 'e2', setTravelDays: 100 })
  })
})

describe('an item carried outside the timelines it belongs to', () => {
  const chIn = (id: string, number: number, timelineId: string) =>
    ({ id, worldId: 'w', timelineId, number, title: `Ch ${number}`, synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }) as never

  const world = (encounterTimelineId: string) => base({
    // Two chapters on two different clocks — a frame narrative's shape.
    chapters: [chIn('c1', 1, 't1'), chIn('c2', 2, 't2')],
    characters: [person('a', 'Ayla')],
    items: [{ id: 'i1', worldId: 'w', name: 'The letters', description: '', tags: [], imageId: null, isCollective: false, createdAt: 0, updatedAt: 0 } as never],
    allEvents: [ev('e1', 'c1', 0, { timelineId: 't1' }), ev('e2', 'c2', 0, { timelineId: 't2' })],
    artifacts: [{ id: 'art1', worldId: 'w', itemId: 'i1', originTimelineId: 't1', encounterTimelineId, encounterNotes: '', createdAt: 0, updatedAt: 0 } as never],
    snapshots: [snap('a', 'e2', { inventoryItemIds: ['i1'] })],
  })

  it('is reported when it turns up on a third clock', () => {
    // Declared to exist and be found in t1, but held in a t2 chapter.
    expect(kinds(world('t1'))).toContain('artifact-wrong-timeline')
  })

  it('is not reported where the writer said it would be encountered', () => {
    expect(kinds(world('t2'))).not.toContain('artifact-wrong-timeline')
  })
})

/*
  ── Subplot cadence ────────────────────────────────────────────────────────

  `computeThreadIssues` is tested on its own, and the checker maps its three
  kinds onto issues by string concatenation — `thread-${ti.kind}`. That is
  exactly the sort of seam a rename slips through silently: the ids would keep
  building, the panel would group them under a label that no longer exists, and
  nothing would throw.
*/

const thread = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, worldId: 'w', name, color: '#6366f1', description: '', resolvedEventId: null, createdAt: 0, updatedAt: 0, ...over }) as never

const chapterRun = (n: number) => Array.from({ length: n }, (_, i) => ch(`c${i + 1}`, i + 1))

/** One scene per chapter, tagged with the thread in the chapters named. */
const taggedIn = (chapterCount: number, tagged: number[]) =>
  Array.from({ length: chapterCount }, (_, i) =>
    ev(`e${i + 1}`, `c${i + 1}`, 0, tagged.includes(i + 1) ? { threadIds: ['t1'] } : {}))

describe('a subplot that is raised and then dropped', () => {
  const world = (resolvedEventId: string | null) => base({
    chapters: chapterRun(5),
    plotThreads: [thread('t1', 'The missing ledger', { resolvedEventId })],
    // A beat in the first chapter and nothing after it: four chapters of silence
    // at the end, past the three that read as dangling.
    allEvents: taggedIn(5, [1]),
  })

  it('is reported when nothing says where it lands', () => {
    expect(kinds(world(null))).toContain('thread-dangling')
  })

  it('is not reported once the writer says where it lands', () => {
    // Not a "hide this" flag — `resolvedEventId` states the scene it resolves
    // in, so there is nothing left to report rather than a silenced report.
    expect(kinds(world('e1'))).not.toContain('thread-dangling')
  })
})

describe('a subplot that disappears for a third of its own life', () => {
  const world = (tagged: number[]) => base({
    chapters: chapterRun(12),
    plotThreads: [thread('t1', 'The truth of Yanina')],
    allEvents: taggedIn(12, tagged),
  })

  it('is reported when the gap runs most of the way through', () => {
    // Ten quiet chapters out of the twelve it spans.
    expect(kinds(world([1, 12]))).toContain('thread-dormant')
  })

  it('is not reported when the thread keeps a steady beat', () => {
    // The same twelve chapters, a beat in every one of them.
    expect(kinds(world([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).not.toContain('thread-dormant')
  })

  /*
    **The two negatives below are the rule.** It asks for a gap of five chapters
    *and* more than a third of the thread's own life, "both, because either
    alone is wrong" — and the steady-beat world above does not prove that,
    because a gap of zero fails each half on its own. A mutant that destroyed
    either threshold left it green.

    So each of these trips one half and not the other, and they are drawn from
    the measurements in `threadContinuity.ts`: Benedetto's 12-chapter silence
    across 68 chapters of Monte Cristo is ordinary rhythm, and a three-chapter
    hole in a six-chapter subplot is a pause, not a disappearance.
  */
  it('is not reported for a long silence that is a small part of a long thread', () => {
    // Ten quiet chapters — past the five — but ten of sixty is not a third.
    const quiet = new Set([21, 22, 23, 24, 25, 26, 27, 28, 29, 30])
    const tagged = Array.from({ length: 60 }, (_, i) => i + 1).filter((n) => !quiet.has(n))
    expect(kinds(base({
      chapters: chapterRun(60),
      plotThreads: [thread('t1', 'The Benedetto affair')],
      allEvents: taggedIn(60, tagged),
    }))).not.toContain('thread-dormant')
  })

  it('is not reported for a big share of a thread too short to lose', () => {
    // Three quiet chapters of six is half its life, but three chapters is not
    // long enough for a reader to lose the thread at all.
    expect(kinds(base({
      chapters: chapterRun(6),
      plotThreads: [thread('t1', 'The locked drawer')],
      allEvents: taggedIn(6, [1, 5, 6]),
    }))).not.toContain('thread-dormant')
  })
})

describe('a subplot nobody ever tagged a scene with', () => {
  const world = (threadIds: string[]) => base({
    plotThreads: [thread('t1', 'The inheritance')],
    allEvents: [ev('e1', 'c1', 0, { threadIds }), ev('e2', 'c2', 0)],
  })

  it('is reported while it exists on paper only', () => {
    expect(kinds(world([]))).toContain('thread-unstarted')
  })

  it('is not reported once a scene carries it', () => {
    expect(kinds(world(['t1']))).not.toContain('thread-unstarted')
  })
})

/*
  ── A place that is not on a map ──────────────────────────────────────────

  Places may now exist before they are drawn anywhere, which the distance and
  region checks are the only ones that care about: they are the only two that
  read a marker's `x` and `y`.

  The trap is that they are guarded by *"are these two on the same layer"*, and
  two unmapped places both have `mapLayerId === null` — so `null !== null` is
  false and the pair sails through to be measured by coordinates that mean
  nothing. The guard has to say what it means.
*/
describe('a journey between two places that are on no map', () => {
  /*
    The reachable shape, which took two attempts to construct.

    A snapshot only reaches the distance check if it has a `currentMapLayerId`,
    so a place that was *never* mapped is already excluded upstream and proves
    nothing. The case that gets here is a place that **was** on a map when the
    state was recorded and has since been taken off one — which the new "Not on
    a map yet" control makes an ordinary thing to do.

    Then the marker's own `mapLayerId` is null while the snapshot still names a
    layer, and the guard is what stops a thousand pixels of nothing being read
    as a hundred days on foot. My first version of this test put null on the
    snapshots too, passed, and was vacuous: a mutant that defaulted the missing
    layer instead of skipping survived it.
  */
  const world = (mapLayerId: string | null) => base({
    characters: [person('a', 'Ayla')],
    allEvents: [ev('e1', 'c1', 0), ev('e2', 'c2', 0, { travelDays: 1 })],
    allLayers: [layer('l1', { scalePixelsPerUnit: 1, scaleUnit: 'km' })],
    // A thousand units apart, which on a real map is a hundred days on foot.
    allMarkers: [
      marker('m1', { x: 0, y: 0, mapLayerId }),
      marker('m2', { x: 1000, y: 0, mapLayerId }),
    ],
    travelModes: [{ id: 'tm', worldId: 'w', name: 'On foot', speedPerDay: 10, createdAt: 0, updatedAt: 0 } as never],
    snapshots: [
      snap('a', 'e1', { currentLocationMarkerId: 'm1', currentMapLayerId: 'l1', travelModeId: 'tm' }),
      snap('a', 'e2', { currentLocationMarkerId: 'm2', currentMapLayerId: 'l1', travelModeId: 'tm' }),
    ],
  })

  it('is not measured, because there is no distance to measure', () => {
    expect(kinds(world(null))).not.toContain('travel-dist')
  })

  it('while the same journey on a map still is', () => {
    // The pair, and the half that makes the absence mean something: identical
    // coordinates, speed and days — only the places' map differs.
    expect(kinds(world('l1'))).toContain('travel-dist')
  })
})
