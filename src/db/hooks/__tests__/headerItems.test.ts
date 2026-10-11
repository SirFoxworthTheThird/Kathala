import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { sceneItems } from '@/lib/sceneHeader'

/**
 * The Items line in a scene's header (docs/records/scene-header-block-plan.md,
 * part 3): `^Ash Ledger:@Sabine` and `^Pistol:#The Chapel`, written as the
 * hand-off and the placement the panels write, and taken back.
 */

const now = Date.now()
const state = (characterId: string, eventId: string, inventoryItemIds: string[], place = 'quay') => upsertSnapshot({
  worldId: 'w', characterId, eventId: eventId, isAlive: true,
  currentLocationMarkerId: place, currentMapLayerId: null, inventoryItemIds,
  inventoryNotes: '', statusNotes: '', travelModeId: null,
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
  // Pell has the ledger from the first scene; Sabine is at the chapel with nothing.
  await state('pell', 'e1', ['ledger'])
  await state('sab', 'e1', [], 'chapel')
})
afterAll(async () => { await db.delete() })

const at = (characterId: string, eventId: string) => db.characterSnapshots.where('[characterId+eventId]').equals([characterId, eventId]).first()
const none = { give: [], put: [], takeBack: [], unput: [] }
const drawn = async (eventId: string) => sceneItems(eventId, [], await db.characterSnapshots.toArray(), await db.itemPlacements.toArray())

describe('the Items line, written', () => {
  it('^Ledger:@Sabine: hers from this scene, out of Pell’s hands here, and his first scene untouched', async () => {
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    expect(await at('sab', 'e2')).toMatchObject({ eventId: 'e2', inventoryItemIds: ['ledger'], currentLocationMarkerId: 'chapel' })
    expect(await at('pell', 'e2')).toMatchObject({ eventId: 'e2', inventoryItemIds: [] })
    expect(await at('pell', 'e1')).toMatchObject({ inventoryItemIds: ['ledger'] })
    expect((await drawn('e2')).handoffs).toEqual([{ itemId: 'ledger', characterId: 'sab' }])
  })

  it('taken back: out of Sabine’s hands here, and back in Pell’s, who had it before', async () => {
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    await recordItemChanges('w', 'e2', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'sab' }] })
    expect(await at('sab', 'e2')).toMatchObject({ inventoryItemIds: [] })
    expect(await at('pell', 'e2')).toMatchObject({ inventoryItemIds: ['ledger'] })
    expect((await drawn('e2')).handoffs).toEqual([])
  })

  it('moved from Sabine to somebody else: taken back, then given, in one act', async () => {
    await state('ilse', 'e1', [], 'chapel')
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'ledger', characterId: 'sab' }] })
    await recordItemChanges('w', 'e2', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'sab' }], give: [{ itemId: 'ledger', characterId: 'ilse' }] })
    expect(await at('ilse', 'e2')).toMatchObject({ inventoryItemIds: ['ledger'] })
    expect(await at('sab', 'e2')).toMatchObject({ inventoryItemIds: [] })
    expect(await at('pell', 'e2')).toMatchObject({ inventoryItemIds: [] })
    const last = (await db.operations.orderBy('seq').toArray()).filter((o) => o.groupLabel === 'Items at this scene')
    expect(new Set(last.map((o) => o.groupId)).size).toBe(2)
  })

  it('^Ledger:#The Chapel: put down there, out of Pell’s hands; taken off, back in them', async () => {
    await recordItemChanges('w', 'e2', { ...none, put: [{ itemId: 'ledger', placeId: 'chapel' }] })
    expect(await db.itemPlacements.where('[itemId+eventId]').equals(['ledger', 'e2']).first()).toMatchObject({ locationMarkerId: 'chapel' })
    expect(await at('pell', 'e2')).toMatchObject({ inventoryItemIds: [] })
    await recordItemChanges('w', 'e2', { ...none, unput: ['ledger'] })
    expect(await db.itemPlacements.count()).toBe(0)
    expect(await at('pell', 'e2')).toMatchObject({ inventoryItemIds: ['ledger'] })
  })

  it('gives nothing back where two people had it before: guessing which would be the app deciding', async () => {
    await state('sab', 'e1', ['ledger'], 'chapel')
    await recordItemChanges('w', 'e2', { ...none, put: [{ itemId: 'ledger', placeId: 'chapel' }] })
    await recordItemChanges('w', 'e2', { ...none, unput: ['ledger'] })
    expect(await at('pell', 'e2')).toMatchObject({ inventoryItemIds: [] })
    expect(await at('sab', 'e2')).toMatchObject({ inventoryItemIds: [] })
  })
})
