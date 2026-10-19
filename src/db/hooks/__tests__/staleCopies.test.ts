import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { undoLast } from '@/db/hooks/useOperations'

/**
 * An item change carried over the later records it made stale (writer run 11,
 * W-3 and W-8; `docs/records/run-11-record-drift-plan.md`, option A). A
 * person's record holds their whole inventory, copied from their last, so a
 * correction at one scene used to stop at the next record.
 */

const now = Date.now()
const state = (characterId: string, eventId: string, inventoryItemIds: string[]) => upsertSnapshot({
  worldId: 'w', characterId, eventId, isAlive: true,
  currentLocationMarkerId: 'quay', currentMapLayerId: null, inventoryItemIds,
  inventoryNotes: '', statusNotes: '', travelModeId: null,
}, { confirmUnchanged: true })
const scene = (id: string, chapterId: string, timelineId: string, sortOrder: number, cast: string[] = []) => db.events.add({
  id, worldId: 'w', chapterId, timelineId, title: id, description: '', sortOrder,
  tags: [], locationMarkerId: null, involvedCharacterIds: cast, mentionedCharacterIds: [], involvedItemIds: [],
  threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
  povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.timelines.add({ id: 'tl', worldId: 'w', name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now })
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (let i = 1; i <= 6; i++) await scene(`e${i}`, 'c1', 'tl', i, i === 3 ? ['lucia'] : [])
})
afterAll(async () => { await db.delete() })

const held = async (characterId: string, eventId: string) =>
  (await db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first())?.inventoryItemIds
const none = { give: [], put: [], takeBack: [], unput: [] }

describe('a hand-off corrected at an earlier scene', () => {
  beforeEach(async () => {
    // S1: Anna has the Book. S2 and S3: recorded again, so the Book is copied into her records there, and Bruno's lacks it.
    await state('anna', 'e1', ['book'])
    await state('anna', 'e2', ['book'])
    await state('bruno', 'e2', [])
    await state('anna', 'e3', ['book', 'pen'])
    // S4: the writer gives it to Carla — a statement — and her later record copies it.
    await state('anna', 'e4', ['pen'])
    await state('carla', 'e4', ['book'])
    await state('carla', 'e5', ['book'])
    // S6: and she gives it back to Anna — another statement — with Bruno there too.
    await state('carla', 'e6', [])
    await state('anna', 'e6', ['pen', 'book'])
    await state('bruno', 'e6', [])
  })

  it('reaches every later record that only copied it, and stops at the next word about the book (W-3)', async () => {
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    expect(await held('bruno', 'e1')).toEqual(['book'])
    expect(await held('anna', 'e1')).toEqual([])
    // The copies: out of Anna's, into Bruno's — and Anna keeps what else she had.
    expect(await held('anna', 'e2')).toEqual([])
    expect(await held('bruno', 'e2')).toEqual(['book'])
    expect(await held('anna', 'e3')).toEqual(['pen'])
    // S4 said Carla has it: that and everything after it stand.
    expect(await held('carla', 'e4')).toEqual(['book'])
    expect(await held('carla', 'e5')).toEqual(['book'])
    expect(await held('anna', 'e4')).toEqual(['pen'])
    // And past it: Anna's book at S6 is the writer's, and Bruno is not given one there.
    expect(await held('anna', 'e6')).toEqual(['pen', 'book'])
    expect(await held('bruno', 'e6')).toEqual([])
  })

  it('stops at a scene where the book was put down', async () => {
    await db.itemPlacements.add({ id: 'pl', worldId: 'w', itemId: 'book', eventId: 'e3', locationMarkerId: 'vault', notes: '', createdAt: now, updatedAt: now })
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    expect(await held('anna', 'e2')).toEqual([])
    // Paired with the scene before it: the placement's scene is the writer's word, and untouched.
    expect(await held('anna', 'e3')).toEqual(['book', 'pen'])
  })

  it('is one step for Undo, the later records included', async () => {
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    expect(await held('anna', 'e3')).toEqual(['pen'])
    await undoLast('w')
    expect(await held('anna', 'e1')).toEqual(['book'])
    expect(await held('anna', 'e2')).toEqual(['book'])
    expect(await held('bruno', 'e2')).toEqual([])
    expect(await held('anna', 'e3')).toEqual(['book', 'pen'])
  })
})

describe('across eras', () => {
  it('never reaches into another era', async () => {
    await db.timelines.add({ id: 'far', worldId: 'w', name: 'Far', description: '', color: '#f59e0b', dayOffset: 100_000, createdAt: now })
    await db.chapters.add({ id: 'c2', worldId: 'w', timelineId: 'far', number: 2, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await scene('f1', 'c2', 'far', 1)
    await state('anna', 'e1', ['book'])
    await state('anna', 'e2', ['book'])
    await state('bruno', 'e1', [])
    await state('anna', 'f1', ['book'])
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    // Paired: this era's copy is reached, the other era's is not.
    expect(await held('anna', 'e2')).toEqual([])
    expect(await held('anna', 'f1')).toEqual(['book'])
  })
})

describe('an item destroyed', () => {
  it('leaves the later copies of its holder’s inventory, until it is mended (W-8)', async () => {
    await state('lucia', 'e1', ['leaf'])
    await state('lucia', 'e3', ['leaf'])
    await state('lucia', 'e4', ['leaf'])
    await state('lucia', 'e6', ['leaf'])
    await upsertItemSnapshot({ worldId: 'w', itemId: 'leaf', eventId: 'e5', condition: 'repaired', notes: '' })
    // Burned at S3, where Lucia is.
    await recordItemChanges('w', 'e3', { ...none, condition: [{ itemId: 'leaf', condition: 'destroyed' }] })
    expect(await held('lucia', 'e3')).toEqual([])
    expect(await held('lucia', 'e4')).toEqual([])
    // Mended at S5: the writer's word, and what comes after it, stand.
    expect(await held('lucia', 'e6')).toEqual(['leaf'])
    expect(await held('lucia', 'e1')).toEqual(['leaf'])
  })
})
