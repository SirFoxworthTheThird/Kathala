import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { stashUnsaved, readUnsaved, restoreUnsaved } from '@/db/hooks/unsavedRescue'

/**
 * What a page that went away owed the store, written on the next start: the
 * half of the Page's unload save that can be tested without a browser.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})
afterAll(async () => { await db.delete() })

async function seed() {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const e = await createEvent({
    worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: 'The quay', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1, status: 'draft',
  })
  await setSceneText(world.id, e.id, 'The tide was out.')
  return { worldId: world.id, chapterId: ch.id, eventId: e.id }
}
const prose = async (eventId: string) => (await db.sceneTexts.where('eventId').equals(eventId).first())?.text

describe('writing a page left owing', () => {
  it('is written on the next start — prose and titles — and then forgotten', async () => {
    const { worldId, chapterId, eventId } = await seed()
    stashUnsaved({ worldId, scenes: { [eventId]: 'The tide was out. The gulls waited.' }, sceneTitles: { [eventId]: 'Low tide' }, chapterTitles: { [chapterId]: 'Landfall' } }, Date.now() + 1000)
    expect(await restoreUnsaved()).toBe(3)
    expect(await prose(eventId)).toBe('The tide was out. The gulls waited.')
    expect((await db.events.get(eventId))!.title).toBe('Low tide')
    expect((await db.chapters.get(chapterId))!.title).toBe('Landfall')
    expect(readUnsaved()).toBeNull()
  })

  it('leaves a record written since the stash was made, which is newer', async () => {
    const { worldId, eventId } = await seed()
    stashUnsaved({ worldId, scenes: { [eventId]: 'An older draft.' }, sceneTitles: {}, chapterTitles: {} }, 1)
    expect(await restoreUnsaved()).toBe(0)
    expect(await prose(eventId)).toBe('The tide was out.')
    // Forgotten all the same: an old stash must not wait to overwrite later work.
    expect(readUnsaved()).toBeNull()
  })

  it('writes nothing the store already says, and nothing for a scene that has gone', async () => {
    const { worldId, eventId } = await seed()
    stashUnsaved({ worldId, scenes: { [eventId]: 'The tide was out.', gone: 'Lost.' }, sceneTitles: {}, chapterTitles: {} }, Date.now() + 1000)
    expect(await restoreUnsaved()).toBe(0)
    expect(await db.sceneRevisions.count()).toBe(0)
  })

  it('a stash with nothing in it is no stash', () => {
    stashUnsaved({ worldId: 'w', scenes: { e: 'x' }, sceneTitles: {}, chapterTitles: {} })
    expect(readUnsaved()).not.toBeNull()
    stashUnsaved({ worldId: 'w', scenes: {}, sceneTitles: {}, chapterTitles: {} })
    expect(readUnsaved()).toBeNull()
  })
})
