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

describe('destroyed in a holder’s hands', () => {
  const hers = (eventId: string) => db.characterSnapshots.where('[characterId+eventId]').equals(['isolde', eventId]).first()
  beforeEach(async () => {
    // Isolde is in the scene where it is destroyed.
    await db.events.update('e2', { involvedCharacterIds: ['isolde'] })
    // Isolde has carried the ledger since the first scene; Silas carries nothing.
    for (const [characterId, inventoryItemIds] of [['isolde', ['ledger', 'lamp']], ['silas', []]] as const) {
      await db.characterSnapshots.add({
        id: `${characterId}-e1`, worldId: 'w', characterId, eventId: 'e1', sortKey: 1.000001, isAlive: true,
        currentLocationMarkerId: 'chapel', currentMapLayerId: 'map', inventoryItemIds: [...inventoryItemIds], inventoryNotes: 'a satchel',
        statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
      })
    }
  })

  it(':destroyed takes it out of her hands from this scene, keeping the rest of her state; taken off, she has it again', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect(await hers('e2')).toMatchObject({ inventoryItemIds: ['lamp'], currentLocationMarkerId: 'chapel', inventoryNotes: 'a satchel', isAlive: true })
    expect((await hers('e1'))?.inventoryItemIds).toEqual(['ledger', 'lamp'])
    // Nobody who did not hold it is touched.
    expect(await db.characterSnapshots.where('characterId').equals('silas').count()).toBe(1)

    await recordItemChanges('w', 'e2', { ...none, uncondition: ['ledger'] })
    expect((await hers('e2'))?.inventoryItemIds.sort()).toEqual(['lamp', 'ledger'])
  })

  it('changed here from destroyed to damaged: back in her hands; a condition short of destroyed never took it', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'damaged' }] })
    expect(await hers('e2')).toBeUndefined()
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect((await hers('e2'))?.inventoryItemIds).toEqual(['lamp'])
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'damaged' }] })
    expect((await hers('e2'))?.inventoryItemIds.sort()).toEqual(['lamp', 'ledger'])
  })
})

describe('destroyed while its holder is elsewhere (W5-7)', () => {
  const hers = (eventId: string) => db.characterSnapshots.where('[characterId+eventId]').equals(['isolde', eventId]).first()
  beforeEach(async () => {
    await db.characterSnapshots.add({
      id: 'isolde-e1', worldId: 'w', characterId: 'isolde', eventId: 'e1', sortKey: 1.000001, isAlive: true,
      currentLocationMarkerId: 'mill', currentMapLayerId: null, inventoryItemIds: ['ledger'], inventoryNotes: '',
      statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
    for (const [id, name] of [['isolde', 'The Bellwoman'], ['lydia', 'Lydia Marrick']]) {
      await db.characters.add({ id, worldId: 'w', name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
  })

  it('is left in her hands, and she is given no state at a scene she is not in', async () => {
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect(await hers('e2')).toBeUndefined()
    expect((await hers('e1'))?.inventoryItemIds).toEqual(['ledger'])
  })

  it('but somebody in the scene she is revealed to be is her: it leaves her hands', async () => {
    await db.characters.update('isolde', { revealedAs: { characterId: 'lydia', eventId: 'e1' } })
    await db.events.update('e2', { involvedCharacterIds: ['lydia'] })
    await recordItemChanges('w', 'e2', { ...none, condition: [{ itemId: 'ledger', condition: 'destroyed' }] })
    expect((await hers('e2'))?.inventoryItemIds).toEqual([])
  })
})
