import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { splitScene } from '@/db/hooks/useSceneStructure'
import { currentBook, deleteBookDraft, openBookDraft, restoreSceneFromDraft, saveBookDraft } from '@/db/hooks/useBookDrafts'
import { compareDrafts } from '@/lib/bookDraft'
import { applyWorldImport, draftsForExport, importWorldFromJson, previewWorldMerge, serializeWorldForSync } from '@/lib/exportImport'

/** Named drafts (editorial-plan.md, R3): saved whole, compared with the book now, a scene restored from one. */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const FIRST = 'The ferry left at dawn.\n\nMira counted the crates.\n\nThere were eleven.'

async function book() {
  const world = await createWorld({ name: 'Ferry', description: '' })
  const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
  const scene = await createEvent({
    worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Dawn', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  await setSceneText(world.id, scene.id, FIRST)
  return { world, scene }
}

describe('a draft of the book', () => {
  it('is saved whole and named, says its size, and reads back as the book was', async () => {
    const { world } = await book()
    const draft = await saveBookDraft(world.id, '  Draft 1, sent to Ana  ')
    expect(draft).toMatchObject({ name: 'Draft 1, sent to Ana', words: 12, scenes: 1 })
    // Gzipped: not the prose as it is written.
    expect(new TextDecoder().decode(draft.data)).not.toContain('Mira counted')
    expect(await openBookDraft(draft)).toEqual(await currentBook(world.id))
  })

  it('compared with the book after a split and an edit, names both; a scene restored from it gets its prose back, the newer kept in History', async () => {
    const { world, scene } = await book()
    const draft = await saveBookDraft(world.id, 'Draft 1')
    await splitScene(scene.id, FIRST.indexOf('Mira'), 'Counting')
    await setSceneText(world.id, scene.id, 'The ferry left at first light.')
    const changes = compareDrafts(await openBookDraft(draft), await currentBook(world.id)).changes
    expect(changes.map((c) => [c.title, c.state, c.edited, c.splitFrom === scene.id])).toEqual([
      ['Dawn', 'kept', true, false],
      ['Counting', 'added', false, true],
    ])

    const before = (await openBookDraft(draft)).chapters[0].scenes[0].text
    expect(await restoreSceneFromDraft(world.id, scene.id, before)).toBe(true)
    expect((await db.sceneTexts.where('eventId').equals(scene.id).first())?.text).toBe(FIRST)
    const history = await db.sceneRevisions.where('eventId').equals(scene.id).toArray()
    expect(history.map((r) => r.text)).toContain('The ferry left at first light.')
    // A scene no longer in the book is not restored into nothing.
    expect(await restoreSceneFromDraft(world.id, 'gone', before)).toBe(false)
  })

  it('is deleted alone, goes with its world, and is not in the book’s backup', async () => {
    const { world } = await book()
    const one = await saveBookDraft(world.id, 'One')
    const two = await saveBookDraft(world.id, 'Two')
    const backup = await serializeWorldForSync(world.id)
    expect(backup).not.toContain('"bookDrafts"')
    expect(backup).not.toContain('Two')
    await deleteBookDraft(one.id)
    expect((await db.bookDrafts.toArray()).map((d) => d.id)).toEqual([two.id])
    await deleteWorld(world.id)
    expect(await db.bookDrafts.count()).toBe(0)
  })

  it('travels in a file only when asked; imported, it is added to this device’s drafts and replaces none', async () => {
    const { world } = await book()
    const mine = await saveBookDraft(world.id, 'Mine')
    const file = JSON.parse(await serializeWorldForSync(world.id))
    const carried = await draftsForExport(world.id)
    expect(carried).toHaveLength(1)
    expect(typeof carried[0].data).toBe('string')

    // Elsewhere, a draft saved there; here, the file with it. This device's own is kept.
    await db.bookDrafts.clear()
    const theirs = await saveBookDraft(world.id, 'Theirs')
    await importWorldFromJson(JSON.stringify({ ...file, bookDrafts: carried }))
    expect((await db.bookDrafts.toArray()).map((d) => d.name).sort()).toEqual(['Mine', 'Theirs'])
    const back = (await db.bookDrafts.get(mine.id))!
    expect(await openBookDraft(back)).toEqual(await openBookDraft(mine))

    // A file without drafts, imported or merged, deletes none.
    await importWorldFromJson(JSON.stringify(file))
    await applyWorldImport((await previewWorldMerge(JSON.stringify(file))).parsed, 'merge')
    expect((await db.bookDrafts.toArray()).map((d) => d.id).sort()).toEqual([mine.id, theirs.id].sort())
  })
})
