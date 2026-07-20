import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, deleteEvent } from '@/db/hooks/useTimeline'
import { setSceneText, captureSceneRevision, MAX_SCENE_REVISIONS, REVISION_COALESCE_MS } from '@/db/hooks/useManuscript'
import { restoreSceneRevision } from '@/db/hooks/useSceneRevisions'
import { collectWorldData, importWorldFromJson } from '@/lib/exportImport'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function makeEvent(worldId: string) {
  const tl = await createTimeline({ worldId, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  return createEvent({
    worldId, chapterId: ch.id, timelineId: tl.id, title: 'Scene', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
}

const revsFor = (eventId: string) =>
  db.sceneRevisions.where('eventId').equals(eventId).sortBy('createdAt')

describe('captureSceneRevision', () => {
  it('coalesces saves within the window, keeps distinct sessions', async () => {
    const eid = 'e1'
    await captureSceneRevision('w', eid, 'A', 1, 1_000)
    await captureSceneRevision('w', eid, 'B', 1, 1_000 + REVISION_COALESCE_MS - 1) // within window → skip
    await captureSceneRevision('w', eid, 'C', 1, 1_000 + REVISION_COALESCE_MS + 1) // new session → keep
    const revs = await revsFor(eid)
    expect(revs.map((r) => r.text)).toEqual(['A', 'C'])
  })

  it('skips an exact duplicate of the latest revision', async () => {
    await captureSceneRevision('w', 'e2', 'same', 1, 0, true)
    await captureSceneRevision('w', 'e2', 'same', 1, 10_000_000, true) // force, but identical → skip
    expect((await revsFor('e2')).length).toBe(1)
  })

  it('prunes to the most recent MAX_SCENE_REVISIONS', async () => {
    for (let i = 0; i < MAX_SCENE_REVISIONS + 5; i++) {
      await captureSceneRevision('w', 'e3', `v${i}`, 1, i * 10_000_000, true)
    }
    const revs = await revsFor('e3')
    expect(revs.length).toBe(MAX_SCENE_REVISIONS)
    expect(revs[0].text).toBe('v5')       // oldest kept (v0..v4 pruned)
    expect(revs[revs.length - 1].text).toBe(`v${MAX_SCENE_REVISIONS + 4}`)
  })
})

describe('setSceneText revision capture', () => {
  it('captures the previous prose when a scene is edited', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    await setSceneText(world.id, ev.id, 'first draft')          // new — nothing to capture
    expect((await revsFor(ev.id)).length).toBe(0)
    await setSceneText(world.id, ev.id, 'first draft, revised') // captures "first draft"
    const revs = await revsFor(ev.id)
    expect(revs.map((r) => r.text)).toEqual(['first draft'])
  })
})

describe('restoreSceneRevision', () => {
  it('force-saves the current prose, then restores the chosen version', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    await setSceneText(world.id, ev.id, 'version one')
    await setSceneText(world.id, ev.id, 'version two') // captures "version one"
    const [v1] = await revsFor(ev.id)

    await restoreSceneRevision(v1.id)

    // Scene text is back to version one.
    const scene = await db.sceneTexts.where('eventId').equals(ev.id).first()
    expect(scene!.text).toBe('version one')
    // The pre-restore prose ("version two") was preserved as a new revision.
    const texts = (await revsFor(ev.id)).map((r) => r.text)
    expect(texts).toContain('version two')
  })
})

describe('lifecycle cleanup + round-trip', () => {
  it('deleteEvent removes the scene revisions', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    await captureSceneRevision(world.id, ev.id, 'draft', 1, 0, true)
    expect((await revsFor(ev.id)).length).toBe(1)
    await deleteEvent(ev.id)
    expect((await revsFor(ev.id)).length).toBe(0)
  })

  it('survives an export → import round-trip', async () => {
    const world = await createWorld({ name: 'W', description: '' })
    const ev = await makeEvent(world.id)
    await setSceneText(world.id, ev.id, 'one')
    await setSceneText(world.id, ev.id, 'two') // one revision captured

    const collected = await collectWorldData(world.id)
    expect(collected.sceneRevisions.length).toBe(1)
    const json = JSON.stringify({ version: 2, exportedAt: Date.now(), ...collected, blobs: [] })
    await db.delete(); await db.open()
    await importWorldFromJson(json)

    const revs = await db.sceneRevisions.toArray()
    expect(revs).toHaveLength(1)
    expect(revs[0].text).toBe('one')
  })
})
