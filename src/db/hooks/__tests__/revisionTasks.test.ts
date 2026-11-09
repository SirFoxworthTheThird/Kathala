import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter } from '@/db/hooks/useTimeline'
import {
  addRevisionTask, addRevisionTasks, deleteRevisionTask, setRevisionTaskDone, sortTasks, updateRevisionTask,
} from '@/db/hooks/useRevisionTasks'
import { undoLast } from '@/db/hooks/useOperations'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync, EXPORT_VERSION } from '@/lib/exportImport'

/** Revision tasks (editorial-plan.md, R5): journalled, linked, carried by a backup, kept through a merge as deleted. */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function book() {
  const world = await createWorld({ name: 'Ferry', description: '' })
  const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
  return { world, chapter }
}

const tasks = async (worldId: string) => sortTasks(await db.revisionTasks.where('worldId').equals(worldId).toArray())

describe('a revision task', () => {
  it('is made open at the end of the list, linked, changed, done and opened again without being lost', async () => {
    const { world, chapter } = await book()
    const first = await addRevisionTask(world.id, { text: '  Cut the prologue.  ' })
    const second = await addRevisionTask(world.id, {
      text: 'Slow the chase in chapter one.',
      links: [{ kind: 'chapter', id: chapter.id }, { kind: 'chapter', id: chapter.id }],
    })
    expect(await addRevisionTask(world.id, { text: '   ' })).toBeNull()
    expect((await tasks(world.id)).map((t) => [t.text, t.order, t.done])).toEqual([
      ['Cut the prologue.', 0, false],
      ['Slow the chase in chapter one.', 1, false],
    ])
    // Linked once to what it is about, however often it was said.
    expect((await db.revisionTasks.get(second!.id))?.links).toEqual([{ kind: 'chapter', id: chapter.id }])

    await updateRevisionTask(first!.id, { text: 'Cut the prologue to a page.', links: [{ kind: 'chapter', id: chapter.id }] })
    await updateRevisionTask(first!.id, { text: '  ' })
    expect(await db.revisionTasks.get(first!.id)).toMatchObject({ text: 'Cut the prologue to a page.', links: [{ kind: 'chapter', id: chapter.id }] })

    await setRevisionTaskDone(first!.id, true)
    const done = await db.revisionTasks.get(first!.id)
    expect(done?.done).toBe(true)
    expect(done?.doneAt).toBeTypeOf('number')
    await setRevisionTaskDone(first!.id, false)
    const open = await db.revisionTasks.get(first!.id)
    expect(open?.done).toBe(false)
    expect(open?.doneAt).toBeUndefined()
  })

  it('a letter’s tasks are added in its order, after those there, as one step of undo', async () => {
    const { world } = await book()
    await addRevisionTask(world.id, { text: 'Already here.' })
    const added = await addRevisionTasks(world.id, [
      { text: 'One.', group: 'Pace', source: { kind: 'letter', letter: 'Ana, 3 Nov' } },
      { text: '' },
      { text: 'Two.', group: ' ', source: { kind: 'letter', letter: 'Ana, 3 Nov' } },
    ])
    expect(added).toHaveLength(2)
    expect((await tasks(world.id)).map((t) => [t.text, t.order, t.group])).toEqual([
      ['Already here.', 0, undefined],
      ['One.', 1, 'Pace'],
      ['Two.', 2, undefined],
    ])
    await undoLast(world.id)
    expect((await tasks(world.id)).map((t) => t.text)).toEqual(['Already here.'])
  })

  it('is one step of undo each time, and a delete leaves a tombstone', async () => {
    const { world } = await book()
    const task = await addRevisionTask(world.id, { text: 'Cut the prologue.' })
    await setRevisionTaskDone(task!.id, true)
    await undoLast(world.id)
    expect((await db.revisionTasks.get(task!.id))?.done).toBe(false)
    await undoLast(world.id)
    expect(await db.revisionTasks.get(task!.id)).toBeUndefined()

    const again = await addRevisionTask(world.id, { text: 'Again.' })
    await deleteRevisionTask(again!.id)
    expect(await db.revisionTasks.get(again!.id)).toBeUndefined()
    expect(await db.tombstones.where('entityId').equals(again!.id).count()).toBe(1)
  })

  it('goes with its world', async () => {
    const { world } = await book()
    const task = await addRevisionTask(world.id, { text: 'Cut the prologue.' })
    await deleteWorld(world.id)
    expect(await db.revisionTasks.get(task!.id)).toBeUndefined()
  })
})

describe('tasks in a backup', () => {
  it('travel in the file, which says it needs this version to read it', async () => {
    const { world, chapter } = await book()
    const task = await addRevisionTask(world.id, { text: 'Cut the prologue.', links: [{ kind: 'chapter', id: chapter.id }] })
    const exported = JSON.parse(await serializeWorldForSync(world.id))
    expect(exported.version).toBe(EXPORT_VERSION)
    expect(EXPORT_VERSION).toBe(21)
    expect(exported.revisionTasks.map((t: { id: string }) => t.id)).toEqual([task!.id])

    await deleteWorld(world.id)
    await importWorldFromJson(JSON.stringify(exported))
    expect(await db.revisionTasks.get(task!.id)).toMatchObject({ text: 'Cut the prologue.', links: [{ kind: 'chapter', id: chapter.id }] })

    // A file from before tasks has none, and imports.
    const older = { ...exported, version: 20 }
    delete older.revisionTasks
    await importWorldFromJson(JSON.stringify(older))
    expect(await db.revisionTasks.count()).toBe(0)
  })

  it('merge: a task made on the other device arrives, one deleted here is not brought back, and one done there is done', async () => {
    const { world } = await book()
    const kept = await addRevisionTask(world.id, { text: 'Kept.' })
    const gone = await addRevisionTask(world.id, { text: 'Deleted here.' })
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    theirs.revisionTasks.push({ ...kept, id: 'from-there', text: 'Made there.', order: 2 })
    theirs.revisionTasks = theirs.revisionTasks.map((t: { id: string; updatedAt: number }) => (t.id === kept!.id ? { ...t, done: true, doneAt: 1, updatedAt: t.updatedAt + 1000 } : t))
    await deleteRevisionTask(gone!.id)

    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    expect((await tasks(world.id)).map((t) => [t.text, t.done])).toEqual([['Kept.', true], ['Made there.', false]])
  })
})
