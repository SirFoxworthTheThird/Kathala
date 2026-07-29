import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createItem } from '@/db/hooks/useItems'
import { createPlotThread } from '@/db/hooks/usePlotThreads'
import {
  createTimeline, createChapter, createEvent, deleteChapter, bulkAddTag, bulkDeleteEvents,
  moveEventOnBoard,
} from '@/db/hooks/useTimeline'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { addCharactersToWorld } from '@/lib/sectionImport'
import {
  listOperations, operationsForEntity, listTombstones, isDeleted, pruneJournal, clearJournal,
  latestSeq,
} from '@/db/hooks/useOperations'
import { replay, invertOperation } from '@/lib/operations'
import { getDeviceId } from '@/lib/deviceId'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed() {
  const world = await createWorld({ name: 'Journal World', description: '' })
  return world
}

describe('journalled character writes', () => {
  it('records a create alongside the record, in one transaction', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })

    const ops = await operationsForEntity('character', char.id)
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({
      type: 'create',
      entityType: 'character',
      entityId: char.id,
      worldId: world.id,
      baseVersion: 0,
      deviceId: getDeviceId(),
    })
    expect(char.version).toBe(1)
  })

  it('records an update with its base version and changed fields', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    await updateCharacter(char.id, { name: 'Vela Reyn' })

    const ops = await operationsForEntity('character', char.id)
    expect(ops.map((o) => o.type)).toEqual(['create', 'update'])
    expect(ops[1].baseVersion).toBe(1)
    expect(ops[1].changedFields).toContain('name')
    expect((await db.characters.get(char.id))?.version).toBe(2)
  })

  it('records a delete with the whole prior record, plus a tombstone', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    await deleteCharacter(char.id)

    const ops = await operationsForEntity('character', char.id)
    expect(ops.map((o) => o.type)).toEqual(['create', 'delete'])
    // The payload carries enough to rebuild the record.
    expect(ops[1].payload).toMatchObject({ id: char.id, name: 'Vela' })

    expect(await isDeleted('character', char.id)).toBe(true)
    const stones = await listTombstones(world.id)
    expect(stones).toHaveLength(1)
    expect(stones[0]).toMatchObject({ entityId: char.id, entityType: 'character' })
  })

  it('assigns monotonic sequence numbers per world', async () => {
    const world = await seed()
    const a = await createCharacter({ worldId: world.id, name: 'A', description: '' })
    const b = await createCharacter({ worldId: world.id, name: 'B', description: '' })
    await updateCharacter(a.id, { description: 'x' })

    const seqs = (await listOperations(world.id)).map((o) => o.seq)
    expect(seqs).toEqual([1, 2, 3])
    expect(b.id).not.toBe(a.id)
  })

  it('keeps each world on its own sequence', async () => {
    const w1 = await createWorld({ name: 'One', description: '' })
    const w2 = await createWorld({ name: 'Two', description: '' })
    await createCharacter({ worldId: w1.id, name: 'A', description: '' })
    await createCharacter({ worldId: w2.id, name: 'B', description: '' })

    expect((await listOperations(w1.id)).map((o) => o.seq)).toEqual([1])
    expect((await listOperations(w2.id)).map((o) => o.seq)).toEqual([1])
  })

  it('journals nothing when the target does not exist', async () => {
    const world = await seed()
    await updateCharacter('missing', { name: 'x' })
    await deleteCharacter('missing')
    expect(await listOperations(world.id)).toHaveLength(0)
  })
})

describe('replay against the real journal', () => {
  it('rebuilds the current record from its operations alone', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: 'a knight' })
    await updateCharacter(char.id, { name: 'Vela Reyn' })
    await updateCharacter(char.id, { tags: ['exile'] })

    const ops = await operationsForEntity('character', char.id)
    const rebuilt = replay<{ id: string; version: number; name: string; tags: string[] }>(undefined, ops)
    const actual = await db.characters.get(char.id)

    expect(rebuilt?.name).toBe(actual?.name)
    expect(rebuilt?.tags).toEqual(actual?.tags)
    expect(rebuilt?.version).toBe(actual?.version)
  })

  it('replaying the journal twice is safe', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    await updateCharacter(char.id, { name: 'Vela Reyn' })

    const ops = await operationsForEntity('character', char.id)
    const once = replay<{ id: string; version: number; name: string }>(undefined, ops)!
    const twice = replay<{ id: string; version: number; name: string }>(once, ops)
    expect(twice).toEqual(once)
  })

  it('an inverted delete restores the record as it was', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: 'a knight' })
    await updateCharacter(char.id, { tags: ['exile'] })
    const before = await db.characters.get(char.id)
    await deleteCharacter(char.id)

    const ops = await operationsForEntity('character', char.id)
    const del = ops.find((o) => o.type === 'delete')!
    const undo = invertOperation(del, undefined, { id: 'undo', seq: 99 })!
    expect(undo.type).toBe('create')
    expect(undo.payload).toMatchObject({ id: char.id, name: 'Vela', tags: ['exile'] })
    expect((undo.payload as { version: number }).version).toBe(before?.version)
  })
})

describe('journal maintenance', () => {
  it('prunes old entries but keeps the newest per entity', async () => {
    const world = await seed()
    const a = await createCharacter({ worldId: world.id, name: 'A', description: '' })
    const b = await createCharacter({ worldId: world.id, name: 'B', description: '' })
    for (let i = 0; i < 6; i++) await updateCharacter(a.id, { description: `v${i}` })

    const before = await listOperations(world.id)
    expect(before.length).toBe(8)

    const removed = await pruneJournal(world.id, 3)
    expect(removed).toBeGreaterThan(0)

    const after = await listOperations(world.id)
    // Both entities still explainable: each retains at least its newest entry.
    const entities = new Set(after.map((o) => o.entityId))
    expect(entities.has(a.id)).toBe(true)
    expect(entities.has(b.id)).toBe(true)
    expect(after.length).toBeLessThan(before.length)
  })

  it('does nothing when the journal is already short', async () => {
    const world = await seed()
    await createCharacter({ worldId: world.id, name: 'A', description: '' })
    expect(await pruneJournal(world.id, 500)).toBe(0)
  })

  it('clearJournal drops operations and tombstones for one world only', async () => {
    const w1 = await createWorld({ name: 'One', description: '' })
    const w2 = await createWorld({ name: 'Two', description: '' })
    const c1 = await createCharacter({ worldId: w1.id, name: 'A', description: '' })
    await createCharacter({ worldId: w2.id, name: 'B', description: '' })
    await deleteCharacter(c1.id)

    await clearJournal(w1.id)
    expect(await listOperations(w1.id)).toHaveLength(0)
    expect(await listTombstones(w1.id)).toHaveLength(0)
    expect(await listOperations(w2.id)).toHaveLength(1)
  })

  it('deleting a world takes its journal with it', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'A', description: '' })
    await deleteCharacter(char.id)
    expect(await db.operations.count()).toBeGreaterThan(0)

    await deleteWorld(world.id)
    expect(await db.operations.count()).toBe(0)
    expect(await db.tombstones.count()).toBe(0)
  })
})

describe('records predating the journal', () => {
  it('treats a missing version as 1 and journals from there', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    // Simulate a pre-v52 record (or an older .pwk import) with no version.
    await db.characters.update(char.id, { version: undefined })
    expect((await db.characters.get(char.id))?.version).toBeUndefined()

    await updateCharacter(char.id, { name: 'Vela Reyn' })
    const ops = await operationsForEntity('character', char.id)
    const update = ops.find((o) => o.type === 'update')!
    expect(update.baseVersion).toBe(1)
    expect((await db.characters.get(char.id))?.version).toBe(2)
  })
})

describe('the widened seam', () => {
  it('journals every entity group on the seam', async () => {
    const world = await createWorld({ name: 'Wide', description: '' })
    const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const ev = await createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: 'Scene', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    const item = await createItem({ worldId: world.id, name: 'Sword', description: '', iconType: 'weapon', tags: [] })
    const thread = await createPlotThread({ worldId: world.id, name: 'Revenge', color: '#f00' })

    const kinds = new Set((await listOperations(world.id)).map((o) => o.entityType))
    for (const k of ['timeline', 'chapter', 'event', 'character', 'item', 'plotThread']) {
      expect(kinds.has(k as never)).toBe(true)
    }
    expect([tl.id, ch.id, ev.id, char.id, item.id, thread.id].every(Boolean)).toBe(true)
  })

  it('journals bulk event operations one row at a time', async () => {
    const world = await createWorld({ name: 'Bulk', description: '' })
    const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const ev = await createEvent({
        worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `E${i}`, description: '',
        locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: i,
      })
      ids.push(ev.id)
    }

    await bulkAddTag(ids, 'battle')
    const tagged = (await listOperations(world.id)).filter(
      (o) => o.entityType === 'event' && o.type === 'update' && o.changedFields.includes('tags'),
    )
    expect(tagged).toHaveLength(3)

    await bulkDeleteEvents(ids)
    const deletes = (await listOperations(world.id)).filter((o) => o.entityType === 'event' && o.type === 'delete')
    expect(deletes).toHaveLength(3)
    expect(await db.events.count()).toBe(0)
    // Every removed row left a tombstone rather than just vanishing.
    expect((await listTombstones(world.id)).filter((t) => t.entityType === 'event')).toHaveLength(3)
  })

  it('deleting a chapter journals the chapter itself', async () => {
    const world = await createWorld({ name: 'Cascade', description: '' })
    const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    await deleteChapter(ch.id)

    const ops = await operationsForEntity('chapter', ch.id)
    expect(ops.map((o) => o.type)).toEqual(['create', 'delete'])
    expect(await isDeleted('chapter', ch.id)).toBe(true)
  })
})

describe('journal discontinuities', () => {
  it('a bulk AI import resets the journal rather than leaving a partial one', async () => {
    const world = await createWorld({ name: 'AI', description: '' })
    await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    expect((await listOperations(world.id)).length).toBeGreaterThan(0)

    await addCharactersToWorld(world.id, [{ name: 'Imported One' }, { name: 'Imported Two' }] as never)

    // The store changed wholesale, so the journal no longer explains it — and
    // says so by being empty instead of half-right.
    expect(await listOperations(world.id)).toHaveLength(0)
    expect(await db.characters.where('worldId').equals(world.id).count()).toBe(3)
  })

  it('leaves other worlds journals alone', async () => {
    const w1 = await createWorld({ name: 'One', description: '' })
    const w2 = await createWorld({ name: 'Two', description: '' })
    await createCharacter({ worldId: w1.id, name: 'A', description: '' })
    await createCharacter({ worldId: w2.id, name: 'B', description: '' })

    await addCharactersToWorld(w1.id, [{ name: 'Imported' }] as never)
    expect(await listOperations(w1.id)).toHaveLength(0)
    expect(await listOperations(w2.id)).toHaveLength(1)
  })
})

describe('ordering', () => {
  async function chapterWithEvents(n: number) {
    const world = await createWorld({ name: 'Ordered', description: '' })
    const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const ev = await createEvent({
        worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `E${i}`, description: '',
        locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: i,
      })
      ids.push(ev.id)
    }
    return { world, ch, ids }
  }

  const orderNow = async (chapterId: string) =>
    (await db.events.where('chapterId').equals(chapterId).toArray())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => e.title)

  it('journals a reorder as a per-row update, not an untracked sweep', async () => {
    const { world, ch, ids } = await chapterWithEvents(3)
    const before = (await listOperations(world.id)).length

    // Move the last card to the front.
    await moveEventOnBoard(ids[2], ch.id, 0)
    expect(await orderNow(ch.id)).toEqual(['E2', 'E0', 'E1'])

    const added = (await listOperations(world.id)).slice(before)
    expect(added.length).toBeGreaterThan(0)
    // Every row whose position changed is accounted for by an operation.
    for (const op of added) {
      expect(op.entityType).toBe('event')
      expect(op.type).toBe('update')
    }
  })

  it('replaying the journal reproduces the final order deterministically', async () => {
    const { world, ch, ids } = await chapterWithEvents(4)
    await moveEventOnBoard(ids[3], ch.id, 0)
    await moveEventOnBoard(ids[1], ch.id, 3)
    const expected = await orderNow(ch.id)

    // Rebuild each event from its own operations and sort by the replayed
    // sortOrder — the journal alone has to explain the order on screen.
    const ops = await listOperations(world.id)
    const byEntity = new Map<string, typeof ops>()
    for (const op of ops.filter((o) => o.entityType === 'event')) {
      byEntity.set(op.entityId, [...(byEntity.get(op.entityId) ?? []), op])
    }
    const rebuilt = [...byEntity.values()]
      .map((entityOps) => replay<{ id: string; version: number; title: string; sortOrder: number }>(undefined, entityOps))
      .filter((r): r is { id: string; version: number; title: string; sortOrder: number } => r != null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.title)

    expect(rebuilt).toEqual(expected)
  })

  it('sequence numbers order operations independently of wall-clock time', async () => {
    const { world } = await chapterWithEvents(3)
    const ops = await listOperations(world.id)
    const seqs = ops.map((o) => o.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
    expect(new Set(seqs).size).toBe(seqs.length)
  })
})

describe('per-event snapshots on the seam', () => {
  it('journals a character state change at an event', async () => {
    const world = await createWorld({ name: 'Snap', description: '' })
    const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
    const ev = await createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: 'Scene', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })

    const snap = await upsertSnapshot({
      worldId: world.id, characterId: char.id, eventId: ev.id,
      isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'wounded', travelModeId: null,
    })
    const created = await operationsForEntity('characterSnapshot', snap.id)
    expect(created.map((o) => o.type)).toEqual(['create'])

    // Editing the same event's state updates in place, and journals an update.
    await upsertSnapshot({
      worldId: world.id, characterId: char.id, eventId: ev.id,
      isAlive: false, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: 'dead', travelModeId: null,
    })
    const after = await operationsForEntity('characterSnapshot', snap.id)
    expect(after.map((o) => o.type)).toEqual(['create', 'update'])
    expect(after[1].changedFields).toContain('statusNotes')
    expect((await db.characterSnapshots.get(snap.id))?.isAlive).toBe(false)
  })
})

describe('latestSeq (folder sync uses this to spot local edits)', () => {
  it('is 0 for a world with no journal', async () => {
    const world = await createWorld({ name: 'Quiet', description: '' })
    expect(await latestSeq(world.id)).toBe(0)
  })

  it('tracks the highest seq and is scoped per world', async () => {
    const w1 = await createWorld({ name: 'One', description: '' })
    const w2 = await createWorld({ name: 'Two', description: '' })
    await createCharacter({ worldId: w1.id, name: 'A', description: '' })
    await createCharacter({ worldId: w1.id, name: 'B', description: '' })
    await createCharacter({ worldId: w2.id, name: 'C', description: '' })

    expect(await latestSeq(w1.id)).toBe(2)
    expect(await latestSeq(w2.id)).toBe(1)
  })

  it('goes backwards after a discontinuity, which sync reads as dirty', async () => {
    const world = await createWorld({ name: 'Reset', description: '' })
    await createCharacter({ worldId: world.id, name: 'A', description: '' })
    await createCharacter({ worldId: world.id, name: 'B', description: '' })
    expect(await latestSeq(world.id)).toBe(2)

    await addCharactersToWorld(world.id, [{ name: 'Imported' }] as never)
    // The journal was reset, so seq drops — resolveFolderSyncState treats a
    // seq below the last synced value as "everything changed", not "clean".
    expect(await latestSeq(world.id)).toBe(0)
  })
})
