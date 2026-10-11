import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { upsertItemSnapshot } from '@/db/hooks/useItemSnapshots'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { sceneItems } from '@/lib/sceneHeader'

/**
 * An item's condition on the Items line — `^Ash Ledger:damaged` — written as
 * the item's state at the scene, drawn where it changes, and taken back.
 */

const now = Date.now()

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
  // The ledger is intact from the first scene, with a note on it.
  await upsertItemSnapshot({ worldId: 'w', itemId: 'ledger', eventId: 'e1', condition: 'intact', notes: 'Bound in grey calf.' })
})
afterAll(async () => { await db.delete() })

const none = { give: [], put: [], takeBack: [], unput: [] }
const at = (eventId: string) => db.itemSnapshots.where('[itemId+eventId]').equals(['ledger', eventId]).first()
const drawn = async (eventId: string) => sceneItems(eventId, [], [], [], await db.itemSnapshots.toArray()).conditions

describe('a condition on the Items line, written', () => {
  it('^Ledger:damaged: its state here says so, keeps the note it had, and is drawn here and not a scene later', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'damaged' }] })
    expect(await at('e2')).toMatchObject({ condition: 'damaged', notes: 'Bound in grey calf.' })
    expect(await at('e1')).toMatchObject({ condition: 'intact' })
    expect(await drawn('e2')).toEqual([{ itemId: 'ledger', condition: 'damaged' }])
    expect(await drawn('e3')).toBeUndefined()
  })

  it('the condition it already has makes no state', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'intact' }] })
    expect(await at('e2')).toBeUndefined()
  })

  it('taken off: a state that said nothing else goes, and one with a note written here keeps it', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'damaged' }] })
    await recordItemChanges('w', 'e2', { ...none, uncondition: ['ledger'] })
    expect(await at('e2')).toBeUndefined()
    expect(await db.tombstones.count()).toBe(1)

    await upsertItemSnapshot({ worldId: 'w', itemId: 'ledger', eventId: 'e3', condition: 'destroyed', notes: 'Burnt in the grate.' })
    await recordItemChanges('w', 'e3', { ...none, uncondition: ['ledger'] })
    expect(await at('e3')).toMatchObject({ condition: 'intact', notes: 'Burnt in the grate.' })
    expect(await drawn('e3')).toBeUndefined()
  })

  it('changed here to another: the state here takes it, and stays one state', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'damaged' }] })
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect(await db.itemSnapshots.where('eventId').equals('e2').toArray()).toMatchObject([{ condition: 'destroyed', notes: 'Bound in grey calf.' }])
  })
})
