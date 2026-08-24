import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { moveCharacterToScene, upsertSnapshot } from '@/db/hooks/useSnapshots'

/**
 * The continuity checker's "Move to <place>" fix, which a writer reaches by
 * clearing a warning list and which "Fix all" applies to a whole ensemble.
 *
 * It used to look for the state to carry forward at the very scene it was
 * fixing — a snapshot that is never there, because a snapshot there is what
 * makes the warning not fire. So every fallback fired: alive, empty-handed, no
 * notes. A writer clearing eight warnings emptied eight characters' hands and
 * revived the dead among them.
 */

const W = 'world-1'
const CHAR = 'char-mira'
const MAP = 'map-1'
const HERE = 'marker-ferrow'
const THERE = 'marker-hallowmere'

/** Ch.2 scene, then Ch.3 scene — the fix is applied at the Ch.3 one. */
const EVENTS = [
  { id: 'ev-ch2', chapterId: 'ch-2', sortOrder: 0 },
  { id: 'ev-ch3', chapterId: 'ch-3', sortOrder: 0 },
]
const CHAPTERS = [
  { id: 'ch-2', number: 2 },
  { id: 'ch-3', number: 3 },
]

beforeEach(async () => {
  await db.delete()
  await db.open()
  const now = Date.now()
  await db.mapLayers.add({
    id: MAP, worldId: W, name: 'The Salt Road', parentMapId: null,
    imageBlobId: null, width: 1000, height: 1000, createdAt: now, updatedAt: now,
  } as never)
  for (const [id, name] of [[HERE, 'Ferrow Crossing'], [THERE, 'Hallowmere Lock']]) {
    await db.locationMarkers.add({
      id, worldId: W, mapLayerId: MAP, name, x: 0, y: 0,
      linkedMapLayerId: null, createdAt: now, updatedAt: now,
    } as never)
  }
  for (const { id, number } of CHAPTERS) {
    await db.chapters.add({
      id, worldId: W, timelineId: 'tl-1', number, title: '', description: '',
      createdAt: now, updatedAt: now,
    } as never)
  }
  for (const { id, chapterId, sortOrder } of EVENTS) {
    await db.events.add({
      id, worldId: W, chapterId, timelineId: 'tl-1', sortOrder, title: id,
      description: '', tags: [], locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    } as never)
  }
})

afterAll(async () => {
  await db.delete()
})

/** The record the fix writes, at the scene it was applied to. */
async function snapshotAt(eventId: string) {
  return db.characterSnapshots
    .where('[characterId+eventId]').equals([CHAR, eventId]).first()
}

/**
 * Callers build a new state by spreading an existing snapshot — the item
 * hand-off does, the map panel does — and an `id` riding along in that spread
 * used to win over `generateId()`, so a record for a *new* scene was created
 * under an old row's primary key.
 */
describe('upsertSnapshot given a whole record to copy', () => {
  it('writes a new row rather than reusing the id it was handed', async () => {
    const first = await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryItemIds: ['item-letter'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    // Exactly what a caller does with a resolved snapshot: spread it, change
    // the scene and one field.
    const second = await upsertSnapshot({ ...first, eventId: 'ev-ch3', inventoryItemIds: [] })

    expect(second.id).not.toBe(first.id)
    expect(await db.characterSnapshots.count()).toBe(2)
    // …and the record it was copied from is untouched.
    expect((await db.characterSnapshots.get(first.id))?.inventoryItemIds).toEqual(['item-letter'])
  })
})

describe('moveCharacterToScene', () => {
  it('carries the inventory forward from the last record', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryItemIds: ['item-letter', 'item-tally'], inventoryNotes: 'sealed',
      statusNotes: 'footsore', travelModeId: 'mode-walk',
    })

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
      EVENTS, CHAPTERS,
    )

    const written = await snapshotAt('ev-ch3')
    expect(written?.currentLocationMarkerId).toBe(HERE)
    // The whole of the finding: the letter the book is about is still in hand.
    expect(written?.inventoryItemIds).toEqual(['item-letter', 'item-tally'])
    expect(written?.inventoryNotes).toBe('sealed')
    expect(written?.statusNotes).toBe('footsore')
    expect(written?.travelModeId).toBe('mode-walk')
  })

  it('does not revive a character who was dead before the scene', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: false, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
      EVENTS, CHAPTERS,
    )

    expect((await snapshotAt('ev-ch3'))?.isAlive).toBe(false)
  })

  it('starts a character with no prior record alive and empty-handed', async () => {
    // The defaults are right when there is genuinely nothing to carry — which
    // is the case the old code applied to everyone.
    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
      EVENTS, CHAPTERS,
    )

    const written = await snapshotAt('ev-ch3')
    expect(written?.isAlive).toBe(true)
    expect(written?.inventoryItemIds).toEqual([])
    expect(written?.currentLocationMarkerId).toBe(HERE)
  })

  it('ignores a later record, carrying only what was true by this scene', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryItemIds: ['item-letter'], inventoryNotes: '', statusNotes: '', travelModeId: null,
    })
    // A record after the scene being fixed must not be the one carried.
    await db.characterSnapshots.add({
      id: 'snap-later', worldId: W, characterId: CHAR, eventId: 'ev-later',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: ['item-lantern'], inventoryNotes: '', statusNotes: '',
      travelModeId: null, sortKey: 9, createdAt: Date.now(), updatedAt: Date.now(),
    } as never)

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
      EVENTS, CHAPTERS,
    )

    expect((await snapshotAt('ev-ch3'))?.inventoryItemIds).toEqual(['item-letter'])
  })

  it('does nothing when the marker is gone', async () => {
    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: 'marker-deleted' },
      EVENTS, CHAPTERS,
    )
    expect(await snapshotAt('ev-ch3')).toBeUndefined()
  })
})
