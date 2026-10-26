import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { inventoryOf, rederiveCustodyAt } from '@/db/hooks/useCustody'
import { sceneItems } from '@/lib/sceneHeader'
import { wholeRecords } from '@/lib/personState'
import { loadStory } from '@/db/hooks/useStory'

/**
 * The Items line in a scene's header (docs/records/scene-header-block-plan.md,
 * part 3): `^Ash Ledger:@Sabine` and `^Pistol:#The Chapel`, written as the
 * hand-off and the placement the panels write, and taken back.
 */

const now = Date.now()
// Whole records, as a store from before custody held them: custody is derived from their inventories.
const state = (characterId: string, eventId: string, inventoryItemIds: string[], place = 'quay') => db.characterSnapshots.put({
  id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId: eventId, isAlive: true,
  currentLocationMarkerId: place, currentMapLayerId: null, inventoryItemIds,
  inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (const [id, sortOrder] of [['e1', 1], ['e2', 2], ['e3', 3]] as const) {
    await db.events.add({
      id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }
  await db.items.add({ id: 'ledger', worldId: 'w', name: 'Ash Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now } as never)
  // Pell has the ledger from the first scene; Sabine is at the chapel with nothing.
  await state('pell', 'e1', ['ledger'])
  await state('sab', 'e1', [], 'chapel')
  // Custody from those records, as a world that reached the store with records only has it derived.
  await rederiveCustodyAt('w', ['e1'])
})
afterAll(async () => { await db.delete() })

const at = (characterId: string, eventId: string) => db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first()
const none = { give: [], put: [], takeBack: [], unput: [] }
const holds = (characterId: string, eventId: string) => inventoryOf('w', characterId, eventId)
const drawn = async (eventId: string) => sceneItems(eventId, [], wholeRecords(await db.characterSnapshots.toArray(), await loadStory('w')), await db.itemPlacements.toArray(), [], undefined, await db.itemCustody.toArray())

describe('the Items line, written', () => {
  /*
    Custody (Part B1): the line says who has it from here, once, at its scene.
    Nobody's state record is written for it — a record would be a copy of the
    one before it, and copies outvoted hand-offs.
  */
  it('^Ledger:@Sabine: hers from this scene, out of Pell’s hands here, and his first scene untouched', async () => {
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    expect(await holds('sab', 'e2')).toEqual(['ledger'])
    expect(await holds('sab', 'e3')).toEqual(['ledger'])
    expect(await holds('pell', 'e2')).toEqual([])
    expect(await holds('pell', 'e1')).toEqual(['ledger'])
    expect(await at('sab', 'e2')).toBeUndefined()
    expect(await at('pell', 'e2')).toBeUndefined()
    expect((await drawn('e2')).handoffs).toEqual([{ itemId: 'ledger', characterId: 'sab' }])
  })

  it('taken back: out of Sabine’s hands here, and back in Pell’s, who had it before', async () => {
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    await recordItemChanges('w', 'e2', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'sab' }] })
    expect(await holds('sab', 'e2')).toEqual([])
    expect(await holds('pell', 'e2')).toEqual(['ledger'])
    expect((await drawn('e2')).handoffs).toEqual([])
  })

  it('moved from Sabine to somebody else: taken back, then given, in one act', async () => {
    await state('ilse', 'e1', [], 'chapel')
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    await recordItemChanges('w', 'e2', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'sab' }], give: [{ itemId: 'ledger', characterId: 'ilse' }] })
    expect(await holds('ilse', 'e2')).toEqual(['ledger'])
    expect(await holds('sab', 'e2')).toEqual([])
    expect(await holds('pell', 'e2')).toEqual([])
    const last = (await db.operations.orderBy('seq').toArray()).filter((o) => o.groupLabel === 'Items at this scene')
    expect(new Set(last.map((o) => o.groupId)).size).toBe(2)
  })

  it('^Ledger:#The Chapel: put down there, out of Pell’s hands; taken off, back in them', async () => {
    await recordItemChanges('w', 'e2', { ...none, put: [{ itemId: 'ledger', placeId: 'chapel' }] })
    expect(await db.itemPlacements.where('[itemId+eventId]').equals(['ledger', 'e2']).first()).toMatchObject({ locationMarkerId: 'chapel' })
    expect(await holds('pell', 'e2')).toEqual([])
    expect((await drawn('e2')).placements).toEqual([{ itemId: 'ledger', placeId: 'chapel' }])
    await recordItemChanges('w', 'e2', { ...none, unput: ['ledger'] })
    expect(await db.itemPlacements.count()).toBe(0)
    expect(await holds('pell', 'e2')).toEqual(['ledger'])
    expect(await db.itemCustody.where('eventId').equals('e2').count()).toBe(0)
  })
})
