import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { undoLast } from '@/db/hooks/useOperations'
import { custodyOf, inventoryOf, rederiveCustodyAt } from '@/db/hooks/useCustody'

/**
 * An item change corrected at an earlier scene holds past the later records
 * that only copied the one before (writer run 11, W-3 and W-8). A person's
 * record holds their whole inventory, copied from their last, so a correction
 * used to stop at the next record — and was then carried over the copies
 * (`staleCopies`, `docs/records/run-11-record-drift-plan.md`). With custody
 * (Part B1) a copy says nothing, and the correction is one statement read at
 * every scene after it, until the next word about the thing.
 */

const now = Date.now()
// Whole records, as a store from before custody held them: the inventories custody is derived from (`derive`).
const state = (characterId: string, eventId: string, inventoryItemIds: string[]) => db.characterSnapshots.put({
  id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true,
  currentLocationMarkerId: 'quay', currentMapLayerId: null, inventoryItemIds,
  inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
})
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

const held = (characterId: string, eventId: string) => inventoryOf('w', characterId, eventId)
const record = async (characterId: string, eventId: string) =>
  (await db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first())?.inventoryItemIds
/** The world's items, and custody derived from its records, as the v61 migration has it. */
async function derive() {
  for (const id of ['book', 'pen', 'leaf']) {
    await db.items.put({ id, worldId: 'w', name: id, description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now } as never)
  }
  await rederiveCustodyAt('w', (await db.events.toCollection().primaryKeys()) as string[])
}
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

  it('reaches every later scene whose record only copied it, and stops at the next word about the book (W-3)', async () => {
    await derive()
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    expect(await held('bruno', 'e1')).toEqual(['book'])
    expect(await held('anna', 'e1')).toEqual([])
    // Past the copies: out of Anna's hands, in Bruno's — and Anna keeps what else she had.
    expect(await held('anna', 'e2')).toEqual([])
    expect(await held('bruno', 'e2')).toEqual(['book'])
    expect(await held('anna', 'e3')).toEqual(['pen'])
    expect(await held('bruno', 'e3')).toEqual(['book'])
    // S4 said Carla has it: that and everything after it stand.
    expect(await held('carla', 'e4')).toEqual(['book'])
    expect(await held('carla', 'e5')).toEqual(['book'])
    expect(await held('bruno', 'e4')).toEqual([])
    // And past it: Anna's book at S6 is the writer's, and Bruno has none there.
    expect(await held('anna', 'e6')).toEqual(['book', 'pen'])
    expect(await held('bruno', 'e6')).toEqual([])
    // Nothing written past the scene corrected: the copies are as they were.
    expect(await record('anna', 'e2')).toEqual(['book'])
  })

  it('stops at a scene where the book was put down', async () => {
    await db.itemPlacements.add({ id: 'pl', worldId: 'w', itemId: 'book', eventId: 'e3', locationMarkerId: 'vault', notes: '', createdAt: now, updatedAt: now })
    await derive()
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    // Paired: Bruno's up to the placement, in the vault from it.
    expect(await held('bruno', 'e2')).toEqual(['book'])
    expect(await held('bruno', 'e3')).toEqual([])
    expect(await custodyOf('w', 'book', 'e3')).toEqual({ holderId: null, placeId: 'vault' })
  })

  it('is one step for Undo', async () => {
    await derive()
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
    await derive()
    await recordItemChanges('w', 'e1', { ...none, takeBack: [{ itemId: 'book', characterId: 'anna' }], give: [{ itemId: 'book', characterId: 'bruno' }] })
    // Paired: this era is reached, the other era is not.
    expect(await held('anna', 'e2')).toEqual([])
    expect(await held('anna', 'f1')).toEqual(['book'])
  })
})

describe('an item destroyed', () => {
  /*
    W-8: the copies of its holder's inventory after the scene it was burned in
    kept it in her hands. Mended later, it is in nobody's until somebody is
    given it: a copy that lists it is not that word.
  */
  it('is out of its holder’s hands at every later scene that only copied her inventory (W-8)', async () => {
    await state('lucia', 'e1', ['leaf'])
    await state('lucia', 'e3', ['leaf'])
    await state('lucia', 'e4', ['leaf'])
    await state('lucia', 'e6', ['leaf'])
    await upsertItemSnapshot({ worldId: 'w', itemId: 'leaf', eventId: 'e5', condition: 'repaired', notes: '' })
    await derive()
    // Burned at S3, where Lucia is.
    await recordItemChanges('w', 'e3', { ...none, condition: [{ itemId: 'leaf', condition: 'destroyed' }] })
    expect(await held('lucia', 'e1')).toEqual(['leaf'])
    expect(await held('lucia', 'e3')).toEqual([])
    expect(await held('lucia', 'e4')).toEqual([])
    expect(await held('lucia', 'e6')).toEqual([])
    // Given back to her at S6: hers.
    await recordItemChanges('w', 'e6', { ...none, give: [{ itemId: 'leaf', characterId: 'lucia' }] })
    expect(await held('lucia', 'e6')).toEqual(['leaf'])
  })
})
