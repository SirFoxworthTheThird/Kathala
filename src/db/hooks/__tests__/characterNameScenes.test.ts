import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, deleteEvent, deleteChapter, bulkDeleteEvents } from '@/db/hooks/useTimeline'
import { createCharacter, updateCharacter } from '@/db/hooks/useCharacters'
import { undoLast } from '@/db/hooks/useOperations'
import { joinWithNext, splitScene } from '@/db/hooks/useSceneStructure'

/**
 * A name change points at a scene. When that scene goes, the change moves to
 * the next scene in reading order — not cleared, which would be the reveal from
 * the start, and not dropped, which would lose it — and one undo puts it back.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

/** Two chapters: Bree (a, b) and Rivendell (c). Aragorn is Strider from a, Aragorn from b, Elessar known from c. */
async function book() {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const scenes: Record<string, string> = {}
  const chapters: Record<string, string> = {}
  let n = 0
  for (const [title, titles] of [['Bree', ['a', 'b']], ['Rivendell', ['c']]] as const) {
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: ++n, title, synopsis: '' })
    chapters[title] = ch.id
    let i = 0
    for (const t of titles) {
      const e = await createEvent({
        worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: t, description: '',
        locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: ++i,
      })
      scenes[t] = e.id
    }
  }
  const aragorn = await createCharacter({ worldId: world.id, name: 'Aragorn', description: '' })
  await updateCharacter(aragorn.id, {
    aliases: ['Strider', 'Elessar'],
    nameChanges: [{ eventId: scenes.a, name: 'Strider' }, { eventId: scenes.b, name: 'Aragorn' }],
    aliasesFrom: [{ alias: 'Elessar', eventId: scenes.c }],
  })
  const read = async () => {
    const c = (await db.characters.get(aragorn.id))!
    const title = new Map(Object.entries(scenes).map(([t, id]) => [id, t]))
    return {
      changes: (c.nameChanges ?? []).map((x) => `${x.name}@${title.get(x.eventId) ?? x.eventId}`),
      aliases: (c.aliasesFrom ?? []).map((x) => `${x.alias}@${title.get(x.eventId) ?? x.eventId}`),
    }
  }
  return { world, scenes, chapters, read }
}

describe('a scene with a name change, removed', () => {
  it('deleted: the change moves to the next scene, and one undo puts it back', async () => {
    const { world, scenes, read } = await book()
    await deleteEvent(scenes.a)
    // The next scene has its own change, which is the more particular: Strider's goes.
    expect((await read()).changes).toEqual(['Aragorn@b'])
    await undoLast(world.id)
    expect((await read()).changes).toEqual(['Strider@a', 'Aragorn@b'])
    expect(await db.events.get(scenes.a)).toBeDefined()
  })

  it('deleted with nothing after it in its chapter: on to the next chapter’s first scene', async () => {
    const { scenes, read } = await book()
    await deleteEvent(scenes.b)
    expect((await read()).changes).toEqual(['Strider@a', 'Aragorn@c'])
  })

  it('the last scene of the book: back to the one before', async () => {
    const { scenes, read } = await book()
    await deleteEvent(scenes.c)
    expect((await read()).aliases).toEqual(['Elessar@b'])
  })

  it('a whole chapter: on past every scene in it, and one undo puts them back', async () => {
    const { world, chapters, read } = await book()
    await deleteChapter(chapters.Bree)
    // Both land on Rivendell, and the one a reader reaches last is the one kept.
    expect((await read()).changes).toEqual(['Aragorn@c'])
    await undoLast(world.id)
    expect((await read()).changes).toEqual(['Strider@a', 'Aragorn@b'])
  })

  it('several at once: each on to the next scene not also going, the later kept', async () => {
    const { scenes, read } = await book()
    await bulkDeleteEvents([scenes.a, scenes.b])
    expect((await read()).changes).toEqual(['Aragorn@c'])
  })
})

describe('a scene with a name change, joined or split', () => {
  it('joined into the scene before: the change follows it there', async () => {
    const { world, scenes, read } = await book()
    await updateCharacter((await db.characters.toArray())[0].id, {
      nameChanges: [{ eventId: scenes.b, name: 'Aragorn' }],
    })
    await joinWithNext(scenes.a)
    expect((await read()).changes).toEqual(['Aragorn@a'])
    await undoLast(world.id)
    expect((await read()).changes).toEqual(['Aragorn@b'])
  })

  it('split: it stays on the first half', async () => {
    const { scenes, read } = await book()
    await splitScene(scenes.a, 0, 'a2')
    expect((await read()).changes).toEqual(['Strider@a', 'Aragorn@b'])
  })
})
