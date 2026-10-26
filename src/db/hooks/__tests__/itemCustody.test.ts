import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'
import { deleteEvent } from '@/db/hooks/useTimeline'
import { deleteItem } from '@/db/hooks/useItems'
import { deleteCharacter } from '@/db/hooks/useCharacters'
import { joinWithNext } from '@/db/hooks/useSceneStructure'

/**
 * The custody table (Part B1, v61): derived from the records a world already
 * has when the store is upgraded and when a file from before it is imported,
 * carried by export, import and merge, and gone with the scene, item or
 * person it is about.
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
const scene = (id: string, sortOrder: number) => ({
  id, worldId: 'w', chapterId: 'c1', timelineId: 'tl', title: id, description: '', sortOrder, tags: [], locationMarkerId: null,
  involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
  structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
})
const person = (id: string) => ({ id, worldId: 'w', name: id, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
const item = (id: string, isCollective = false) => ({ id, worldId: 'w', name: id, description: '', iconType: 'misc', tags: [], imageId: null, isCollective, createdAt: now, updatedAt: now })
const record = (characterId: string, eventId: string, inventoryItemIds: string[]) => ({
  id: `${characterId}-${eventId}`, worldId: 'w', characterId, eventId, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
  inventoryItemIds, inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
})

/*
  W-3's shape: the ledger Anna's from e1, given to Bruno at e3, and Anna's e4
  record a copy of her e1. Lembas, a collective item, held by both.
*/
const records = [
  record('anna', 'e1', ['ledger', 'lembas']), record('bruno', 'e3', ['ledger', 'lembas']), record('anna', 'e4', ['ledger', 'lembas']),
]
const file = () => ({
  version: 7, exportedAt: now, world, mapLayers: [], locationMarkers: [], characters: [person('anna'), person('bruno')],
  items: [item('ledger'), item('lembas', true)], characterSnapshots: records, characterMovements: [], itemPlacements: [],
  locationSnapshots: [], itemSnapshots: [], relationships: [], relationshipSnapshots: [], timelines: [timeline], chapters: [chapter],
  events: [scene('e1', 1), scene('e2', 2), scene('e3', 3), scene('e4', 4)], blobs: [],
})

/** Each statement as [scene, item, holder or place or nobody, has]. */
const statements = async () => (await db.itemCustody.toArray())
  .sort((a, b) => a.eventId.localeCompare(b.eventId) || a.itemId.localeCompare(b.itemId) || String(a.holderId).localeCompare(String(b.holderId)))
  .map((c) => [c.eventId, c.itemId, c.holderId ?? c.placeId ?? 'nobody', ...(c.has === undefined ? [] : [c.has])])

const W3 = [
  ['e1', 'ledger', 'anna'], ['e1', 'lembas', 'anna', true],
  ['e3', 'ledger', 'bruno'], ['e3', 'lembas', 'bruno', true],
]

describe('the custody table', () => {
  it('is derived from a store from before v61, keeping only the changes', async () => {
    await db.close()
    await db.delete()
    // A store at v60: the tables the walk reads, as an older app left them.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('KathalaDB', 600)
      req.onupgradeneeded = () => {
        for (const name of ['worlds', 'events', 'chapters', 'timelines', 'items', 'characters', 'characterSnapshots', 'itemPlacements']) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => {
        const handle = req.result
        const tx = handle.transaction(['worlds', 'events', 'chapters', 'timelines', 'items', 'characters', 'characterSnapshots'], 'readwrite')
        const f = file()
        tx.objectStore('worlds').put(f.world)
        for (const e of f.events) tx.objectStore('events').put(e)
        tx.objectStore('chapters').put(chapter)
        tx.objectStore('timelines').put(timeline)
        for (const i of f.items) tx.objectStore('items').put(i)
        for (const c of f.characters) tx.objectStore('characters').put(c)
        for (const r of records) tx.objectStore('characterSnapshots').put(r)
        tx.oncomplete = () => { handle.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
    await db.open()
    // Anna's e4 copy says nothing: the ledger stays Bruno's. Her lembas share is her own, and stays.
    expect(await statements()).toEqual(W3)
    // And the records it read are as they were.
    expect((await db.characterSnapshots.get('anna-e4'))?.inventoryItemIds).toEqual(['ledger', 'lembas'])
  })

  it('is derived on importing a file from before it, carried by export, and not doubled by importing or merging it again', async () => {
    await importWorldFromJson(JSON.stringify(file()))
    expect(await statements()).toEqual(W3)
    const exported = JSON.parse(await serializeWorldForSync('w'))
    expect(exported.itemCustody).toHaveLength(4)

    // The same file again, and merged into itself: the rows are the derivation's, so they are the same rows.
    await importWorldFromJson(JSON.stringify(file()))
    // As the app merges: previewed, then applied.
    await applyWorldImport((await previewWorldMerge(JSON.stringify(file()))).parsed, 'merge')
    expect(await statements()).toEqual(W3)
    // Paired: a file that carries its own statements is taken as it says, not derived again.
    await importWorldFromJson(JSON.stringify({ ...exported, itemCustody: exported.itemCustody.slice(0, 1) }))
    expect(await statements()).toEqual([W3[0]])
  })

  it('goes with the scene, the item or the person it is about', async () => {
    await importWorldFromJson(JSON.stringify(file()))
    await deleteEvent('e3')
    expect(await statements()).toEqual([W3[0], W3[1]])
    await deleteItem('lembas')
    expect(await statements()).toEqual([W3[0]])
    await deleteCharacter('anna')
    expect(await statements()).toEqual([])
  })

  it('moves with a scene joined into the one before it', async () => {
    await importWorldFromJson(JSON.stringify(file()))
    await joinWithNext('e2')
    // e3's statements are e2's now: the scene that stays.
    expect(await statements()).toEqual([W3[0], W3[1], ['e2', 'ledger', 'bruno'], ['e2', 'lembas', 'bruno', true]])
  })
})
