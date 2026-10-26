import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { recordFates, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { sceneFates } from '@/lib/sceneHeader'
import { wholeRecords } from '@/lib/personState'
import { loadStory } from '@/db/hooks/useStory'

/**
 * `@@Corwen Dask:dead` in a scene's header (docs/records/scene-header-block-plan.md,
 * part 2): the state it writes, and the one it leaves.
 */

const now = Date.now()
async function seed() {
  await db.chapters.add({ id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
  for (const [id, sortOrder] of [['e1', 1], ['e2', 2], ['e3', 3]] as const) {
    await db.events.add({
      id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder,
      tags: [], locationMarkerId: null, involvedCharacterIds: ['dask'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }
  // Dask at the chapel at the first scene, holding the pistol, with a note about that moment.
  await upsertSnapshot({
    worldId: 'w', characterId: 'dask', eventId: 'e1', isAlive: true,
    currentLocationMarkerId: 'chapel', currentMapLayerId: 'city', inventoryItemIds: ['pistol'],
    inventoryNotes: 'loaded', statusNotes: 'Bleeding from the shoulder.', travelModeId: 'foot',
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seed()
})
afterAll(async () => { await db.delete() })

const at = (eventId: string) => db.characterSnapshots.where('[characterId+eventId]').equals(['dask', eventId]).first()
/** Every record whole at its scene (Part B2), as the header reads them. */
const whole = async () => wholeRecords(await db.characterSnapshots.toArray(), await loadStory('w'))

describe('recording a fate from the header', () => {
  it('a death at a scene with no state there: a state at that scene saying so, the rest read from the last one but its note', async () => {
    await recordFates('w', 'e2', [{ characterId: 'dask', isAlive: false, revived: false }])
    // What it says (Part B2): dead, and the note cleared — nothing it only carried.
    const here = await at('e2')
    expect(here).toMatchObject({ eventId: 'e2', isAlive: false, statusNotes: '' })
    // Not revived: absent, which is no.
    expect(here?.revived ?? false).toBe(false)
    expect(here).not.toHaveProperty('currentLocationMarkerId')
    // Read whole, it is where he was, as he was.
    expect((await whole()).find((r) => r.eventId === 'e2')).toMatchObject({
      isAlive: false, currentLocationMarkerId: 'chapel', currentMapLayerId: 'city', inventoryNotes: 'loaded', travelModeId: 'foot', statusNotes: '',
    })
    // The state it was carried from is still the first scene's, and still says he is alive.
    expect((await whole()).find((r) => r.eventId === 'e1')).toMatchObject({ isAlive: true, statusNotes: 'Bleeding from the shoulder.' })
    // And the header draws it: dead here, after alive.
    expect(sceneFates('e2', ['dask'], await whole())).toEqual({ dead: ['dask'], alive: [], elsewhere: [] })
  })

  it('a fate at a scene that has a state: only alive and revived change, the rest of what it says stays', async () => {
    await upsertSnapshot({
      worldId: 'w', characterId: 'dask', eventId: 'e3', isAlive: false,
      currentLocationMarkerId: 'quay', currentMapLayerId: 'city', inventoryItemIds: [],
      inventoryNotes: '', statusNotes: 'Pulled from the water.', travelModeId: null,
    })
    await recordFates('w', 'e3', [{ characterId: 'dask', isAlive: true, revived: true }])
    expect(await at('e3')).toMatchObject({ isAlive: true, revived: true, currentLocationMarkerId: 'quay', statusNotes: 'Pulled from the water.' })
    expect(await db.characterSnapshots.count()).toBe(2)
  })

  it('taking a death back sets the state at that scene alive again, and writes nowhere else', async () => {
    await recordFates('w', 'e2', [{ characterId: 'dask', isAlive: false, revived: false }])
    await recordFates('w', 'e2', [{ characterId: 'dask', isAlive: true, revived: false }])
    expect(await at('e2')).toMatchObject({ isAlive: true, revived: false })
    expect(await db.characterSnapshots.count()).toBe(2)
    expect(sceneFates('e2', ['dask'], await whole())).toEqual({ dead: [], alive: [], elsewhere: [] })
  })

  it('several fates are one act, for undo', async () => {
    await recordFates('w', 'e2', [
      { characterId: 'dask', isAlive: false, revived: false },
      { characterId: 'sab', isAlive: false, revived: false },
    ])
    const ops = (await db.operations.orderBy('seq').toArray()).filter((o) => o.entityType === 'characterSnapshot')
    const last = ops.slice(-2)
    expect(last.map((o) => o.entityId)).toHaveLength(2)
    // One group, and a different one from the state written before it.
    expect(last[0].groupId).toBeTruthy()
    expect(last[1].groupId).toBe(last[0].groupId)
    expect(ops[0].groupId).not.toBe(last[0].groupId)
  })
})
