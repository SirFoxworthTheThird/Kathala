import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { importWorldFromJson, serializeWorldForSync } from '@/lib/exportImport'
import { personAt } from '@/lib/personState'
import { loadStory } from '@/db/hooks/useStory'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'

/**
 * A person's records made sparse (Part B2, v62): when the store is upgraded,
 * and when a file from before it is imported. Each keeps only what changes at
 * its scene, and the header's places; every scene reads as it did.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterAll(async () => { await db.delete() })

const now = 1
const world = { id: 'w', name: 'Slack Water', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: now, updatedAt: now }
const timeline = { id: 'tl', worldId: 'w', name: 'Main', description: '', color: '#fff', dayOffset: 0, createdAt: now, updatedAt: now }
const chapter = { id: 'c1', worldId: 'w', timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now }
const scene = (id: string, sortOrder: number, locationMarkerId: string | null = null, involvedCharacterIds: string[] = []) => ({
  id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder, tags: [], locationMarkerId,
  involvedCharacterIds, mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
  structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
})
const record = (eventId: string, fields: Record<string, unknown>) => ({
  id: `anna-${eventId}`, worldId: 'w', characterId: 'anna', eventId, isAlive: true, currentLocationMarkerId: 'quay', currentMapLayerId: null,
  inventoryItemIds: ['ledger'], inventoryNotes: '', statusNotes: '', travelModeId: 'horse', createdAt: now, updatedAt: now, ...fields,
})

/*
  Anna at the quay on horseback from e1. At e2 she is wounded, the rest a
  copy; e3 is set at the quay with her in it, and its header placed her
  there; at e4 she moves to the vault, the wound copied.
*/
const events = [scene('e1', 1), scene('e2', 2), scene('e3', 3, 'quay', ['anna']), scene('e4', 4)]
const records = [record('e1', {}), record('e2', { statusNotes: 'wounded' }), record('e3', { statusNotes: 'wounded' }), record('e4', { statusNotes: 'wounded', currentLocationMarkerId: 'vault' })]
const file = () => ({
  version: 18, exportedAt: now, world, mapLayers: [], locationMarkers: [], characters: [{ id: 'anna', worldId: 'w', name: 'Anna', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now }],
  items: [{ id: 'ledger', worldId: 'w', name: 'Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now }],
  characterSnapshots: records, characterMovements: [], itemPlacements: [],
  locationSnapshots: [], itemSnapshots: [], relationships: [], relationshipSnapshots: [], timelines: [timeline], chapters: [chapter], events, blobs: [],
})

const FACET_FIELDS = ['isAlive', 'currentLocationMarkerId', 'currentMapLayerId', 'travelModeId', 'statusNotes', 'inventoryNotes', 'inventoryItemIds']
/** What each stored record says, by scene. */
const said = async () => Object.fromEntries((await db.characterSnapshots.toArray()).sort((a, b) => a.eventId.localeCompare(b.eventId))
  .map((r) => [r.eventId, Object.fromEntries(Object.entries(r).filter(([k]) => FACET_FIELDS.includes(k)))]))
const SPARSE = {
  // Alive with nothing said is what a person is: not said.
  e1: { currentLocationMarkerId: 'quay', currentMapLayerId: null, travelModeId: 'horse' },
  e2: { statusNotes: 'wounded' },
  // The header's place, kept though it repeats.
  e3: { currentLocationMarkerId: 'quay', currentMapLayerId: null },
  e4: { currentLocationMarkerId: 'vault', currentMapLayerId: null },
}
/** Every scene read as the screens read it. */
const readings = async () => {
  const story = await loadStory('w')
  const all = await db.characterSnapshots.toArray()
  return Object.fromEntries(events.map((e) => {
    const s = personAt(all, e.id, story)!
    return [e.id, [s.isAlive, s.currentLocationMarkerId, s.travelModeId, s.statusNotes]]
  }))
}
const READ = { e1: [true, 'quay', 'horse', ''], e2: [true, 'quay', 'horse', 'wounded'], e3: [true, 'quay', 'horse', 'wounded'], e4: [true, 'vault', 'horse', 'wounded'] }

describe('a person’s records, made sparse', () => {
  it('when a store from before v62 is upgraded', async () => {
    await db.close()
    await db.delete()
    // A store at v61, as an older app left it, whole records and all.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('KathalaDB', 610)
      req.onupgradeneeded = () => {
        for (const name of ['worlds', 'events', 'chapters', 'timelines', 'characterSnapshots']) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => {
        const handle = req.result
        const tx = handle.transaction(['worlds', 'events', 'chapters', 'timelines', 'characterSnapshots'], 'readwrite')
        tx.objectStore('worlds').put(world)
        for (const e of events) tx.objectStore('events').put(e)
        tx.objectStore('chapters').put(chapter)
        tx.objectStore('timelines').put(timeline)
        for (const r of records) tx.objectStore('characterSnapshots').put(r)
        tx.oncomplete = () => { handle.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
    await db.open()
    expect(await said()).toEqual(SPARSE)
    expect(await readings()).toEqual(READ)
  })

  it('when a file from before it is imported, and exported again as it is', async () => {
    await importWorldFromJson(JSON.stringify(file()))
    expect(await said()).toEqual(SPARSE)
    expect(await readings()).toEqual(READ)
    const exported = JSON.parse(await serializeWorldForSync('w'))
    expect(exported.version).toBe(19)
    // A file that is already sparse is taken as it says: e3's place is not dropped again, and nothing is restored.
    await importWorldFromJson(JSON.stringify(exported))
    expect(await said()).toEqual(SPARSE)
  })
})

/*
  W-2 and F2, at the store: a write says only what changes at its scene, so a
  record made at a later scene for something else no longer holds a copy of
  where she is — and a correction at the earlier scene reaches past it.
*/
describe('a write says only what changes', () => {
  const state = (eventId: string, fields: Record<string, unknown>) => upsertSnapshot({
    worldId: 'w', characterId: 'anna', eventId, isAlive: true, currentLocationMarkerId: 'quay', currentMapLayerId: null,
    inventoryNotes: '', statusNotes: '', travelModeId: 'horse', ...fields,
  }, { confirmUnchanged: true })

  it('so a correction at an earlier scene reaches past a later record made for something else', async () => {
    await importWorldFromJson(JSON.stringify({ ...file(), characterSnapshots: [] }))
    await state('e1', {})
    // At e4 she is wounded; the rest of the write is a copy of e1.
    await state('e4', { statusNotes: 'wounded' })
    expect((await db.characterSnapshots.toArray()).find((r) => r.eventId === 'e4')).not.toHaveProperty('currentLocationMarkerId')
    // The writer goes back: at e1 she was in the vault.
    await state('e1', { currentLocationMarkerId: 'vault' })
    expect((await readings()).e4).toEqual([true, 'vault', 'horse', 'wounded'])
  })
})

