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
