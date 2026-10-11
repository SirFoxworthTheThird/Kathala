import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordPlaceStatus, upsertLocationSnapshot } from '@/db/hooks/useLocationSnapshots'
import { scenePlaceStatus } from '@/lib/sceneHeader'

/**
 * A place's status on the Place line — `#The Drowned Chapel:ruined` — written
 * as the place's state at the scene, drawn where it changes, and taken back.
 */

const now = Date.now()

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (const [id, sortOrder] of [['e1', 1], ['e2', 2], ['e3', 3]] as const) {
    await db.events.add({
      id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder,
      tags: [], locationMarkerId: 'chapel', involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }
  // The chapel is in use from the first scene, with a note on it.
  await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'chapel', eventId: 'e1', status: 'active', notes: 'The bell still rings.' })
})
afterAll(async () => { await db.delete() })

const at = (eventId: string) => db.locationSnapshots.where('[locationMarkerId+eventId]').equals(['chapel', eventId]).first()
const drawn = async (eventId: string) => scenePlaceStatus(eventId, 'chapel', await db.locationSnapshots.toArray())

describe('a status on the Place line, written', () => {
  it('#Chapel:ruined: its state here says so, keeps the note it had, and is drawn here and not a scene later', async () => {
    await recordPlaceStatus('w', 'e2', { set: { placeId: 'chapel', status: 'ruined' }, unset: null })
    expect(await at('e2')).toMatchObject({ status: 'ruined', notes: 'The bell still rings.' })
    expect(await at('e1')).toMatchObject({ status: 'active' })
    expect(await drawn('e2')).toBe('ruined')
    expect(await drawn('e3')).toBeNull()
  })

  it('the status it already has makes no state', async () => {
    await recordPlaceStatus('w', 'e2', { set: { placeId: 'chapel', status: 'active' }, unset: null })
    expect(await at('e2')).toBeUndefined()
  })

  it('taken off: a state that said nothing else goes, and one with a note written here keeps it', async () => {
    await recordPlaceStatus('w', 'e2', { set: { placeId: 'chapel', status: 'ruined' }, unset: null })
    await recordPlaceStatus('w', 'e2', { set: null, unset: 'chapel' })
    expect(await at('e2')).toBeUndefined()
    expect(await db.tombstones.count()).toBe(1)

    await upsertLocationSnapshot({ worldId: 'w', locationMarkerId: 'chapel', eventId: 'e3', status: 'destroyed', notes: 'Fire in the nave.' })
    await recordPlaceStatus('w', 'e3', { set: null, unset: 'chapel' })
    expect(await at('e3')).toMatchObject({ status: 'active', notes: 'Fire in the nave.' })
  })

  it('changed here to another: the state here takes it, and stays one state', async () => {
    await recordPlaceStatus('w', 'e2', { set: { placeId: 'chapel', status: 'ruined' }, unset: null })
    await recordPlaceStatus('w', 'e2', { set: { placeId: 'chapel', status: 'abandoned' }, unset: null })
    expect(await db.locationSnapshots.where('eventId').equals('e2').toArray()).toMatchObject([{ status: 'abandoned', notes: 'The bell still rings.' }])
  })
})
