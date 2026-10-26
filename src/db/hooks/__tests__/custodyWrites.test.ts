import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordItemChanges } from '@/db/hooks/useItemPlacements'
import { custodyOf, rederiveCustodyAt, sayInventory, sharesOf } from '@/db/hooks/useCustody'
import { undoLast } from '@/db/hooks/useOperations'

/**
 * The header's Items line writes custody statements (Part B1, step 2): a
 * hand-off, a placement, a taking-back and a destruction are each one
 * statement at their scene, and nothing is copied to later scenes.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seed()
})
afterAll(async () => { await db.delete() })

const now = 1
async function seed() {
  await db.worlds.add({ id: 'w', name: 'W', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: now, updatedAt: now })
  await db.timelines.add({ id: 'tl', worldId: 'w', name: 'Main', description: '', color: '#fff', dayOffset: 0, createdAt: now } as never)
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (const [i, id] of ['e1', 'e2', 'e3', 'e4', 'e5'].entries()) {
    await db.events.add({
      id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder: i + 1, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['anna', 'bruno'], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    } as never)
  }
  for (const id of ['anna', 'bruno']) {
    await db.characters.add({ id, worldId: 'w', name: id, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now } as never)
  }
  await db.items.add({ id: 'ledger', worldId: 'w', name: 'The Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now } as never)
  await db.items.add({ id: 'lembas', worldId: 'w', name: 'Lembas', description: '', iconType: 'misc', tags: [], imageId: null, isCollective: true, createdAt: now, updatedAt: now } as never)
  await db.locationMarkers.add({ id: 'altar', worldId: 'w', mapLayerId: null, name: 'The Altar', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now } as never)
}

const none = { give: [], put: [], takeBack: [], unput: [] }
const at = (eventId: string) => custodyOf('w', 'ledger', eventId)
const rows = () => db.itemCustody.toArray()

describe('the Items line writes custody', () => {
  it('a hand-off is one statement at its scene, read at every scene after it', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e3', { ...none, give: [{ itemId: 'ledger', characterId: 'bruno' }] })
    expect((await rows()).map((r) => [r.eventId, r.holderId])).toEqual([['e1', 'anna'], ['e3', 'bruno']])
    expect(await at('e2')).toEqual({ holderId: 'anna', placeId: null })
    // W-3: e5 is Bruno's whatever any record copied, and nothing was written there to say so.
    expect(await at('e5')).toEqual({ holderId: 'bruno', placeId: null })
  })

  it('taken back, it reads as it did before: with whoever had it', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e3', { ...none, give: [{ itemId: 'ledger', characterId: 'bruno' }] })
    await recordItemChanges('w', 'e3', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'bruno' }] })
    expect(await at('e4')).toEqual({ holderId: 'anna', placeId: null })
    expect(await rows()).toHaveLength(1)
  })

  it('taken back from somebody the scene did not give it to, what the scene said stays', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e3', { ...none, give: [{ itemId: 'ledger', characterId: 'bruno' }] })
    await recordItemChanges('w', 'e3', { ...none, takeBack: [{ itemId: 'ledger', characterId: 'anna' }] })
    expect(await at('e4')).toEqual({ holderId: 'bruno', placeId: null })
  })

  it('put down, it lies there; the placement taken off, it is back in the hands it left', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e2', { ...none, put: [{ itemId: 'ledger', placeId: 'altar' }] })
    expect(await at('e4')).toEqual({ holderId: null, placeId: 'altar' })
    await recordItemChanges('w', 'e2', { ...none, unput: ['ledger'] })
    expect(await at('e4')).toEqual({ holderId: 'anna', placeId: null })
  })

  it('destroyed in a scene, it is in nobody’s hands from there; the word taken off, it is theirs again', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e3', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect(await at('e2')).toEqual({ holderId: 'anna', placeId: null })
    expect(await at('e4')).toEqual({ holderId: null, placeId: null })
    await recordItemChanges('w', 'e3', { ...none, uncondition: ['ledger'] })
    expect(await at('e4')).toEqual({ holderId: 'anna', placeId: null })
  })

  it('a collective item is given to each person on their own', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'lembas', characterId: 'anna' }] })
    await recordItemChanges('w', 'e2', { ...none, give: [{ itemId: 'lembas', characterId: 'bruno' }] })
    expect((await sharesOf('w', 'lembas', 'e3')).sort()).toEqual(['anna', 'bruno'])
    await recordItemChanges('w', 'e2', { ...none, takeBack: [{ itemId: 'lembas', characterId: 'bruno' }] })
    expect(await sharesOf('w', 'lembas', 'e3')).toEqual(['anna'])
  })

  it('is one undo with the rest of the line', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    await recordItemChanges('w', 'e3', { ...none, give: [{ itemId: 'ledger', characterId: 'bruno' }] })
    await undoLast('w')
    expect(await at('e4')).toEqual({ holderId: 'anna', placeId: null })
    expect(await rows()).toHaveLength(1)
  })
})

describe('a person’s inventory set by hand writes custody as what changed', () => {
  it('added is theirs, taken out is out of their hands, and what was shown and kept says nothing', async () => {
    await sayInventory('w', 'anna', 'e1', [], ['ledger'])
    expect(await at('e2')).toEqual({ holderId: 'anna', placeId: null })
    // Saved again unchanged at a later scene: nothing written.
    await sayInventory('w', 'anna', 'e3', ['ledger'], ['ledger'])
    expect(await rows()).toHaveLength(1)
    // Taken out at e4: nobody has it from there.
    await sayInventory('w', 'anna', 'e4', ['ledger'], [])
    expect(await at('e4')).toEqual({ holderId: null, placeId: null })
    expect(await at('e3')).toEqual({ holderId: 'anna', placeId: null })
  })

  /*
    A stale copy on the panel — Anna's record still listing what Bruno was
    given — taken out of her list says nothing about Bruno's ledger; given
    back to her by hand, it is hers.
  */
  it('taking out what somebody else has says nothing; giving it back is a hand-off', async () => {
    await sayInventory('w', 'anna', 'e1', [], ['ledger'])
    await sayInventory('w', 'bruno', 'e2', [], ['ledger'])
    await sayInventory('w', 'anna', 'e3', ['ledger'], [])
    expect(await at('e4')).toEqual({ holderId: 'bruno', placeId: null })
    await sayInventory('w', 'anna', 'e4', [], ['ledger'])
    expect(await at('e5')).toEqual({ holderId: 'anna', placeId: null })
  })

  it('given and taken out at one scene, the scene says nothing of it', async () => {
    await sayInventory('w', 'anna', 'e1', [], ['ledger'])
    await sayInventory('w', 'bruno', 'e3', [], ['ledger'])
    await sayInventory('w', 'bruno', 'e3', ['ledger'], [])
    expect(await at('e4')).toEqual({ holderId: 'anna', placeId: null })
    expect(await rows()).toHaveLength(1)
  })
})

describe('a bulk write of whole-state records', () => {
  it('has custody at its scenes derived again from what the records there say', async () => {
    await recordItemChanges('w', 'e1', { ...none, give: [{ itemId: 'ledger', characterId: 'anna' }] })
    // As the chapter AI import writes: every person's whole state at every scene, Bruno taking the ledger at e3.
    const state = (characterId: string, eventId: string, inventoryItemIds: string[]) => ({
      id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds, inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
    await db.characterSnapshots.bulkPut([state('anna', 'e1', ['ledger']), state('anna', 'e3', ['ledger']), state('bruno', 'e3', ['ledger'])])
    await rederiveCustodyAt('w', ['e3'])
    // Anna's e3 repeats her e1, and says nothing; Bruno takes it in.
    expect(await at('e4')).toEqual({ holderId: 'bruno', placeId: null })
    // The statement at e1 is as it was said, not derived again.
    expect((await rows()).map((r) => [r.eventId, r.holderId])).toEqual([['e1', 'anna'], ['e3', 'bruno']])
  })
})
