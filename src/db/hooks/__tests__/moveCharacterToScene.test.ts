import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { moveCharacterToScene, upsertSnapshot } from '@/db/hooks/useSnapshots'
import { storyOf } from '@/lib/stateEngine'
import { wholeRecords } from '@/lib/personState'
import type { CharacterSnapshot } from '@/types'
/** These scenes as a one-timeline story, for the engine (`stateEngine`). */
function story(events: ReadonlyArray<{ id: string; chapterId: string; sortOrder: number }> = EVENTS, chapters: ReadonlyArray<{ id: string; number: number }> = CHAPTERS) {
  return storyOf(events.map((e) => ({ timelineId: 'tl', ...e })), chapters, [])
}


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

/** The record the fix writes, at the scene it was applied to: what it says (Part B2). */
async function snapshotAt(eventId: string) {
  return db.characterSnapshots
    .where('[characterId+eventId]').equals([CHAR, eventId]).first()
}

/** That record read whole: what it says, and the rest from the records before it. */
async function readAt(eventId: string) {
  return wholeRecords(await db.characterSnapshots.where('characterId').equals(CHAR).toArray(), story()).find((r) => r.eventId === eventId)
}

/**
 * Callers build a new state by spreading an existing snapshot — the item
 * hand-off did, the map panel does — and an `id` riding along in that spread
 * used to win over `generateId()`, so a record for a *new* scene was created
 * under an old row's primary key.
 */
describe('upsertSnapshot given a whole record to copy', () => {
  it('writes a new row rather than reusing the id it was handed', async () => {
    const first = await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    // Exactly what a caller does with a resolved snapshot: spread it, change
    // the scene and one field.
    const second = await upsertSnapshot({ ...(first as CharacterSnapshot), eventId: 'ev-ch3', statusNotes: 'footsore' })

    expect(second.id).not.toBe(first.id)
    expect(await db.characterSnapshots.count()).toBe(2)
    // …and the record it was copied from is untouched.
    expect((await db.characterSnapshots.get(first.id))?.statusNotes ?? '').toBe('')
  })
})

/**
 * The fault the whole `snapshotWriteScenes` rule exists for, at the data layer:
 * a *resolved* snapshot — one whose `eventId` is an earlier scene — spread into
 * a write. The write must land where the caller says, leaving the earlier record
 * exactly as the writer left it.
 */
describe('writing from a record resolved at an earlier scene', () => {
  it('lands where it is told and leaves the earlier scene alone', async () => {
    const earlier = await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    // What every caller now does: drop the identity fields, name the scene.
    const { id: _id, sortKey: _k, createdAt: _c, updatedAt: _u, ...held } = earlier as CharacterSnapshot
    await upsertSnapshot({ ...held, eventId: 'ev-ch3', currentLocationMarkerId: HERE })

    expect((await db.characterSnapshots.get(earlier.id))?.currentLocationMarkerId).toBe(THERE)
    const written = await snapshotAt('ev-ch3')
    expect(written?.currentLocationMarkerId).toBe(HERE)
    expect(written?.id).not.toBe(earlier.id)
  })
})

/*
  A record says only what its scene says (Part B2), so the fix writes where
  they are and nothing else: their hands, their notes and the rest are read
  from the records before it, and cannot be emptied by it.
*/
describe('moveCharacterToScene', () => {
  it('says where they are, and leaves the rest of what was true to be read', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryNotes: 'sealed', statusNotes: 'footsore', travelModeId: 'mode-walk',
    })

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
    )

    const written = await snapshotAt('ev-ch3')
    expect(written?.currentLocationMarkerId).toBe(HERE)
    expect(written).not.toHaveProperty('statusNotes')
    expect(written).not.toHaveProperty('inventoryItemIds')
    // Read at the scene, all of it is still theirs.
    expect(await readAt('ev-ch3')).toMatchObject({ currentLocationMarkerId: HERE, inventoryNotes: 'sealed', statusNotes: 'footsore', travelModeId: 'mode-walk' })
  })

  it('does not revive a character who was dead before the scene', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: false, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryNotes: '', statusNotes: '', travelModeId: null,
    })

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
    )

    expect(await snapshotAt('ev-ch3')).toBeDefined()
    expect((await readAt('ev-ch3'))?.isAlive).toBe(false)
  })

  it('starts a character with no prior record alive', async () => {
    // The defaults are right when there is genuinely nothing to carry — which
    // is the case the old code applied to everyone.
    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
    )

    expect(await readAt('ev-ch3')).toMatchObject({ isAlive: true, currentLocationMarkerId: HERE })
  })

  it('ignores a later record, reading only what was true by this scene', async () => {
    await upsertSnapshot({
      worldId: W, characterId: CHAR, eventId: 'ev-ch2',
      isAlive: true, currentLocationMarkerId: THERE, currentMapLayerId: MAP,
      inventoryNotes: '', statusNotes: 'footsore', travelModeId: null,
    })
    // A record after the scene being fixed must not be the one read.
    await db.characterSnapshots.add({
      id: 'snap-later', worldId: W, characterId: CHAR, eventId: 'ev-later',
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryNotes: '', statusNotes: 'rested',
      travelModeId: null, sortKey: 9, createdAt: Date.now(), updatedAt: Date.now(),
    } as never)

    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: HERE },
    )

    expect((await readAt('ev-ch3'))?.statusNotes).toBe('footsore')
  })

  it('does nothing when the marker is gone', async () => {
    await moveCharacterToScene(
      { worldId: W, characterId: CHAR, eventId: 'ev-ch3', markerId: 'marker-deleted' },
    )
    expect(await snapshotAt('ev-ch3')).toBeUndefined()
  })
})
