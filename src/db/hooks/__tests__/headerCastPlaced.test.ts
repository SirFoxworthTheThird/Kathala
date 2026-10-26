import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { placeCastAtScene, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { createHeaderPlace } from '@/db/hooks/useMentions'
import { wholeRecords } from '@/lib/personState'
import { loadStory } from '@/db/hooks/useStory'

/**
 * Naming a scene's place and cast in its header records the cast there
 * (`placeCastAtScene`): the rules for who is written, and who is left alone.
 */

const now = Date.now()
const state = (characterId: string, eventId: string, place: string | null, isAlive = true) => upsertSnapshot({
  worldId: 'w', characterId, eventId: eventId, isAlive,
  currentLocationMarkerId: place, currentMapLayerId: null,
  inventoryNotes: '', statusNotes: 'A note about that moment.', travelModeId: 'foot',
}, { confirmUnchanged: true })
/** The record at this scene, read whole (Part B2): what it says, and the rest from the records before it. Undefined with none here. */
const at = async (characterId: string, eventId: string) => {
  const own = await db.characterSnapshots.where('characterId').equals(characterId).toArray()
  return own.some((r) => r.eventId === eventId) ? wholeRecords(own, await loadStory('w')).find((r) => r.eventId === eventId) : undefined
}

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
  for (const [id, layer] of [['chapel', 'city'], ['quay', 'city'], ['vault', 'under']] as const) {
    await db.locationMarkers.add({ id, worldId: 'w', mapLayerId: layer, linkedMapLayerId: null, name: id, description: '', x: 0, y: 0, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
  }
})
afterAll(async () => { await db.delete() })

describe('the cast, recorded where the header says the scene is', () => {
  it('records each of them there, at this scene, keeping the rest of their last state but its note', async () => {
    await state('sab', 'e1', 'quay')
    await placeCastAtScene('w', 'e2', ['sab', 'pell'], 'chapel', null)
    expect(await at('sab', 'e2')).toMatchObject({ eventId: 'e2', currentLocationMarkerId: 'chapel', currentMapLayerId: 'city', travelModeId: 'foot', statusNotes: '', isAlive: true })
    // Somebody with no state at all is recorded too.
    expect(await at('pell', 'e2')).toMatchObject({ currentLocationMarkerId: 'chapel' })
    // The scene before is untouched.
    expect(await at('sab', 'e1')).toMatchObject({ currentLocationMarkerId: 'quay', statusNotes: 'A note about that moment.' })
  })

  it('records somebody already there, at this scene; writes nothing for the dead', async () => {
    await state('sab', 'e1', 'chapel')
    await state('dask', 'e1', 'quay', false)
    await placeCastAtScene('w', 'e2', ['sab', 'dask'], 'chapel', null)
    // The header's word about this scene, not one carried from the scene before (writer run 11, W-2).
    expect(await at('sab', 'e2')).toMatchObject({ eventId: 'e2', currentLocationMarkerId: 'chapel' })
    expect(await at('dask', 'e2')).toBeUndefined()
  })

  it('so an earlier scene moved somewhere else later leaves this one where its header put them (W-2)', async () => {
    await state('sab', 'e1', 'chapel')
    await placeCastAtScene('w', 'e3', ['sab'], 'chapel', null)
    // The scene between is given a header putting her in the vault.
    await placeCastAtScene('w', 'e2', ['sab'], 'vault', null)
    expect(await at('sab', 'e2')).toMatchObject({ currentLocationMarkerId: 'vault' })
    expect(await at('sab', 'e3')).toMatchObject({ currentLocationMarkerId: 'chapel' })
  })

  it('leaves a state recorded at this scene where it says — unless it said the scene’s old place, which it follows', async () => {
    await state('sab', 'e2', 'quay')
    await state('pell', 'e2', 'chapel')
    await placeCastAtScene('w', 'e2', ['sab', 'pell'], 'vault', 'chapel')
    expect(await at('sab', 'e2')).toMatchObject({ currentLocationMarkerId: 'quay' })
    expect(await at('pell', 'e2')).toMatchObject({ currentLocationMarkerId: 'vault', currentMapLayerId: 'under' })
  })

  it('at a scene that had no place, a state that only carries the place before is put at the new one; one that moved is the writer’s word', async () => {
    // Sab's state here was written for something else (an item handed over) and carries the quay on; Pell's moved her to the vault.
    await state('sab', 'e1', 'quay')
    await state('sab', 'e2', 'quay')
    await state('pell', 'e1', 'quay')
    await state('pell', 'e2', 'vault')
    await placeCastAtScene('w', 'e2', ['sab', 'pell'], 'chapel', null)
    expect(await at('sab', 'e2')).toMatchObject({ currentLocationMarkerId: 'chapel' })
    expect(await at('pell', 'e2')).toMatchObject({ currentLocationMarkerId: 'vault' })
  })

  it('at a scene that already had its place, a state carrying the place before stays: there it says "not here"', async () => {
    await state('sab', 'e1', 'quay')
    await state('sab', 'e2', 'quay')
    await placeCastAtScene('w', 'e2', ['sab'], 'chapel', 'chapel')
    expect(await at('sab', 'e2')).toMatchObject({ currentLocationMarkerId: 'quay' })
  })

  it('a place made from the header note records the scene’s people there, as one named in the header does', async () => {
    await db.events.update('e2', { involvedCharacterIds: ['sab', 'pell'] })
    await state('sab', 'e1', 'quay')
    const larder = await createHeaderPlace('e2', 'The Larder')
    expect((await db.events.get('e2'))?.locationMarkerId).toBe(larder)
    expect(await at('sab', 'e2')).toMatchObject({ currentLocationMarkerId: larder })
    expect(await at('pell', 'e2')).toMatchObject({ currentLocationMarkerId: larder })
  })

  it('does nothing for a scene with no place, and is one act for undo', async () => {
    await placeCastAtScene('w', 'e2', ['sab'], null, null)
    expect(await db.characterSnapshots.count()).toBe(0)
    await placeCastAtScene('w', 'e2', ['sab', 'pell'], 'chapel', null)
    const ops = (await db.operations.orderBy('seq').toArray()).filter((o) => o.groupLabel === 'Where the cast is')
    expect(ops).toHaveLength(2)
    expect(new Set(ops.map((o) => o.groupId)).size).toBe(1)
  })
})

describe('two writes for one person at one scene, at once', () => {
  it('make one state, not two — the place made from the note while the line was applied (W5-4)', async () => {
    const ann = (statusNotes: string) => upsertSnapshot({
      worldId: 'w', characterId: 'ann', eventId: 'e2', isAlive: true,
      currentLocationMarkerId: 'quay', currentMapLayerId: null,
      inventoryNotes: '', statusNotes, travelModeId: null,
    }, { confirmUnchanged: true })
    await Promise.all([ann('first'), ann('second')])
    const rows = await db.characterSnapshots.where('[characterId+eventId]').equals(['ann', 'e2']).toArray()
    expect(rows).toHaveLength(1)
    // The later write is the state, as one after the other would leave it.
    expect(rows[0].statusNotes).toBe('second')
  })
})
