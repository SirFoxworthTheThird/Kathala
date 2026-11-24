import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, deleteTimeline } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { undoLast } from '@/db/hooks/useOperations'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

/*
  The timeline's confirm says "Undo brings them back" (D-8, UX-1-16), where it
  said "permanently". That sentence is a claim, so it is held here: one Undo
  after the delete puts the timeline, its chapters, its scenes and their prose
  back as they were.
*/
describe('deleting a timeline', () => {
  it('is one step of Undo, which brings back its chapters, scenes and prose', async () => {
    const world = await createWorld({ name: 'Ithaca', description: '' })
    const keep = await createTimeline({ worldId: world.id, name: 'Present', description: '', color: '#888' })
    const tl = await createTimeline({ worldId: world.id, name: 'Wanderings', description: '', color: '#888' })
    const chapters = await Promise.all([1, 2].map((n) => createChapter({ worldId: world.id, timelineId: tl.id, number: n, title: `Ch ${n}`, synopsis: '' })))
    const scenes = []
    for (const [i, ch] of chapters.entries()) {
      const ev = await createEvent({ worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `Scene ${i}`, description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0 })
      await setSceneText(world.id, ev.id, `The wine-dark sea, ${i}.`)
      scenes.push(ev)
    }

    await deleteTimeline(tl.id)
    expect(await db.timelines.get(tl.id)).toBeUndefined()
    expect(await db.chapters.where('timelineId').equals(tl.id).count()).toBe(0)
    expect(await db.events.where('timelineId').equals(tl.id).count()).toBe(0)
    expect(await db.sceneTexts.where('eventId').anyOf(scenes.map((s) => s.id)).count()).toBe(0)
    // The other timeline is untouched.
    expect(await db.timelines.get(keep.id)).toBeDefined()

    await undoLast(world.id)
    expect(await db.timelines.get(tl.id)).toMatchObject({ name: 'Wanderings' })
    expect((await db.chapters.where('timelineId').equals(tl.id).toArray()).map((c) => c.title).sort()).toEqual(['Ch 1', 'Ch 2'])
    expect(await db.events.where('timelineId').equals(tl.id).count()).toBe(2)
    const prose = await db.sceneTexts.where('eventId').anyOf(scenes.map((s) => s.id)).toArray()
    expect(prose.map((p) => p.text).sort()).toEqual(['The wine-dark sea, 0.', 'The wine-dark sea, 1.'])
  })
})
