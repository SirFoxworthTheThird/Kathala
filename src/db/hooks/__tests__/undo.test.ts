import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createCharacter, updateCharacter, deleteCharacter } from '@/db/hooks/useCharacters'
import { createRelationship } from '@/db/hooks/useRelationships'
import { createCharacterGoal } from '@/db/hooks/useCharacterGoals'
import {
  createTimeline, createChapter, createEvent, updateChapter, updateEvent, bulkDeleteEvents,
} from '@/db/hooks/useTimeline'
import {
  listOperations, pendingUndo, undoLast, journalGroup, onDeletion, markJournalDiscontinuity,
} from '@/db/hooks/useOperations'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed() {
  return createWorld({ name: 'Undo World', description: '' })
}

describe('undo of an update', () => {
  it('puts the previous value back', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: 'a scout' })
    await updateCharacter(char.id, { name: 'Vela Sunborn' })

    await undoLast(world.id)

    expect((await db.characters.get(char.id))?.name).toBe('Vela')
  })

  it('leaves fields the edit never touched alone', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: 'a scout' })
    await updateCharacter(char.id, { name: 'Renamed' })

    await undoLast(world.id)

    const after = await db.characters.get(char.id)
    expect(after?.name).toBe('Vela')
    expect(after?.description).toBe('a scout')
  })

  it('walks backwards through several edits rather than toggling one', async () => {
    // The failure this guards: an undo recorded as an ordinary operation
    // becomes the next thing to undo, so the user flips one change forever.
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'One', description: '' })
    await updateCharacter(char.id, { name: 'Two' })
    await updateCharacter(char.id, { name: 'Three' })

    await undoLast(world.id)
    expect((await db.characters.get(char.id))?.name).toBe('Two')

    await undoLast(world.id)
    expect((await db.characters.get(char.id))?.name).toBe('One')
  })
})

describe('undo of a create', () => {
  it('removes the record again', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Temporary', description: '' })

    await undoLast(world.id)

    expect(await db.characters.get(char.id)).toBeUndefined()
  })
})

describe('undo of a delete', () => {
  it('brings the record back', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Aldric', description: 'a knight' })
    await deleteCharacter(char.id)
    expect(await db.characters.get(char.id)).toBeUndefined()

    await undoLast(world.id)

    const back = await db.characters.get(char.id)
    expect(back?.name).toBe('Aldric')
    expect(back?.description).toBe('a knight')
  })

  it('brings back everything the delete cascaded over', async () => {
    // A character takes its goals and relationships with it. Restoring only the
    // character would hand back a hollow one and silently drop the rest.
    const world = await seed()
    const a = await createCharacter({ worldId: world.id, name: 'Aldric', description: '' })
    const b = await createCharacter({ worldId: world.id, name: 'Bree', description: '' })
    const rel = await createRelationship({
      worldId: world.id, characterAId: a.id, characterBId: b.id, label: 'ally',
      strength: 'strong', sentiment: 'positive', description: '', isBidirectional: true,
    })
    const goal = await createCharacterGoal({
      worldId: world.id, characterId: a.id, type: 'want', text: 'Find the sword',
    })

    await deleteCharacter(a.id)
    expect(await db.relationships.get(rel.id)).toBeUndefined()
    expect(await db.characterGoals.get(goal.id)).toBeUndefined()

    await undoLast(world.id)

    expect(await db.characters.get(a.id)).toBeDefined()
    expect(await db.relationships.get(rel.id)).toBeDefined()
    expect((await db.characterGoals.get(goal.id))?.text).toBe('Find the sword')
  })

  it('clears the tombstone, so a later merge does not delete it again', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Aldric', description: '' })
    await deleteCharacter(char.id)
    expect(await db.tombstones.where('entityId').equals(char.id).count()).toBe(1)

    await undoLast(world.id)

    expect(await db.tombstones.where('entityId').equals(char.id).count()).toBe(0)
  })
})

describe('grouped acts', () => {
  it('undoes every record in the group together', async () => {
    const world = await seed()
    const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
    const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
    const e1 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'First', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const e2 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Second', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })

    const before1 = (await db.events.get(e1.id))!.sortOrder
    const before2 = (await db.events.get(e2.id))!.sortOrder

    await journalGroup(() => Promise.all([
      updateEvent(e1.id, { sortOrder: before2 }),
      updateEvent(e2.id, { sortOrder: before1 }),
    ]))

    const batch = await pendingUndo(world.id)
    expect(batch).toHaveLength(2)

    await undoLast(world.id)

    // Half-applied would be worse than not undoing at all.
    expect((await db.events.get(e1.id))?.sortOrder).toBe(before1)
    expect((await db.events.get(e2.id))?.sortOrder).toBe(before2)
  })

  it('restores a bulk delete in one step', async () => {
    const world = await seed()
    const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
    const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
    const e1 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'First', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const e2 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Second', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })

    await bulkDeleteEvents([e1.id, e2.id])
    expect(await db.events.where('chapterId').equals(chapter.id).count()).toBe(0)

    await undoLast(world.id)

    expect(await db.events.where('chapterId').equals(chapter.id).count()).toBe(2)
  })
})

describe('coalescing a debounced editor', () => {
  it('folds a burst of edits into one undo step', async () => {
    const world = await seed()
    const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
    const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })

    const before = await listOperations(world.id)
    for (const notes of ['A', 'A pa', 'A paragraph']) {
      await updateChapter(chapter.id, { notes }, { coalesce: true })
    }
    const after = await listOperations(world.id)

    // Three saves, one journal entry.
    expect(after.length - before.length).toBe(1)
    expect((await db.chapters.get(chapter.id))?.notes).toBe('A paragraph')

    await undoLast(world.id)

    // Undo takes back the whole burst, not the last keystroke.
    expect((await db.chapters.get(chapter.id))?.notes ?? '').toBe('')
  })

  it('starts a new step once the window has passed', async () => {
    const world = await seed()
    const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
    const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })

    const before = (await listOperations(world.id)).length
    await updateChapter(chapter.id, { notes: 'First thought' }, { coalesce: true })

    // Backdate the pending entry rather than faking the clock — fake timers and
    // fake-indexeddb deadlock on each other.
    const [pending] = await pendingUndo(world.id)
    await db.operations.update(pending.id, { createdAt: Date.now() - 60_000 })

    await updateChapter(chapter.id, { notes: 'First thought. Second.' }, { coalesce: true })

    expect((await listOperations(world.id)).length - before).toBe(2)

    await undoLast(world.id)
    expect((await db.chapters.get(chapter.id))?.notes).toBe('First thought')
  })

  it('does not fold discrete edits that never asked for it', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'One', description: '' })

    const before = (await listOperations(world.id)).length
    await updateCharacter(char.id, { name: 'Two' })
    await updateCharacter(char.id, { name: 'Three' })

    expect((await listOperations(world.id)).length - before).toBe(2)
  })
})

describe('the undo stack', () => {
  it('is empty for a world with no journalled edits', async () => {
    const world = await seed()
    expect(await pendingUndo(world.id)).toEqual([])
    expect(await undoLast(world.id)).toEqual([])
  })

  it('is empty after a bulk path resets the journal', async () => {
    // The honest limit: AI generation and world import are one authorial act,
    // not hundreds, so they reset the journal rather than leaving a partial one.
    const world = await seed()
    await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    expect(await pendingUndo(world.id)).toHaveLength(1)

    await markJournalDiscontinuity(world.id)

    expect(await pendingUndo(world.id)).toEqual([])
  })

  it('does not reach into another world', async () => {
    const a = await seed()
    const b = await createWorld({ name: 'Other', description: '' })
    await createCharacter({ worldId: a.id, name: 'Mine', description: '' })

    expect(await pendingUndo(b.id)).toEqual([])
    expect(await undoLast(b.id)).toEqual([])
  })
})

describe('deletion notices', () => {
  it('announces a single deletion once', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Aldric', description: '' })

    const seen: { count: number; name: unknown }[] = []
    const off = onDeletion((n) => seen.push({ count: n.count, name: n.payload.name }))
    await deleteCharacter(char.id)
    off()

    expect(seen).toEqual([{ count: 1, name: 'Aldric' }])
  })

  it('announces a bulk delete once, with the count', async () => {
    // One toast offering one undo — not one per record.
    const world = await seed()
    const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
    const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
    const e1 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'First', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
    })
    const e2 = await createEvent({
      worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Second', description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })

    const counts: number[] = []
    const off = onDeletion((n) => counts.push(n.count))
    await bulkDeleteEvents([e1.id, e2.id])
    off()

    expect(counts).toEqual([2])
  })

  it('says nothing when a record is only edited', async () => {
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })

    const seen: unknown[] = []
    const off = onDeletion((n) => seen.push(n))
    await updateCharacter(char.id, { name: 'Vela Sunborn' })
    off()

    expect(seen).toEqual([])
  })
})

describe('the journal after an undo', () => {
  it('keeps the history rather than erasing it', async () => {
    // The journal exists to be a complete account of what happened; an undo
    // that deleted its own cause would leave a store the journal can't explain.
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Vela', description: '' })
    await updateCharacter(char.id, { name: 'Renamed' })
    const before = (await listOperations(world.id)).length

    await undoLast(world.id)

    const ops = await listOperations(world.id)
    expect(ops.length).toBe(before + 1)
    expect(ops.some((o) => o.undoOf)).toBe(true)
    expect(ops.some((o) => o.undoneBy)).toBe(true)
  })
})

describe('undo and the merge story', () => {
  it('leaves a tombstone when it undoes a create', async () => {
    // Undoing a create is a deletion to every other device. Without the
    // headstone, a merge would treat the record as merely absent and revive it
    // — the resurrection bug tombstones exist to prevent.
    const world = await seed()
    const char = await createCharacter({ worldId: world.id, name: 'Temporary', description: '' })

    await undoLast(world.id)

    expect(await db.characters.get(char.id)).toBeUndefined()
    expect(await db.tombstones.where('entityId').equals(char.id).count()).toBe(1)
  })
})
