import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld, deleteWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, deleteEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { addProseNote, deleteProseNote, replyToProseNote, setProseNoteResolved, updateProseNote } from '@/db/hooks/useProseNotes'
import { undoLast } from '@/db/hooks/useOperations'
import { applyWorldImport, importWorldFromJson, previewWorldMerge, serializeWorldForSync, EXPORT_VERSION } from '@/lib/exportImport'
import { anchorFrom } from '@/lib/noteAnchor'

/** Notes on the prose (editorial-plan.md, R1): journalled, carried by a backup, kept through a merge as deleted. */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const PROSE = 'The ferry left at dawn. Mira counted the crates twice, and twice the number came out wrong.'

async function book() {
  const world = await createWorld({ name: 'Ferry', description: '' })
  const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
  const scene = await createEvent({
    worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Dawn', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  await setSceneText(world.id, scene.id, PROSE)
  const at = PROSE.indexOf('twice the number')
  const anchor = anchorFrom(scene.id, PROSE, at, at + 'twice the number came out wrong'.length)!
  return { world, scene, anchor }
}

describe('a note on the prose', () => {
  it('is made open, on its words, by the writer, and answered, edited and resolved without being lost', async () => {
    const { world, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: '  Which number?  ', kind: 'query' })
    expect(await db.proseNotes.get(note.id)).toMatchObject({
      quote: 'twice the number came out wrong', status: 'open', kind: 'query', author: { kind: 'me' }, body: 'Which number?', replies: [],
    })

    await replyToProseNote(note.id, 'Forty, then forty-one.', { kind: 'editor', name: 'Ana' })
    await replyToProseNote(note.id, '   ')
    await updateProseNote(note.id, { body: 'Which number, and why wrong?' })
    expect(await db.proseNotes.get(note.id)).toMatchObject({
      body: 'Which number, and why wrong?',
      replies: [{ author: { kind: 'editor', name: 'Ana' }, body: 'Forty, then forty-one.' }],
    })

    await setProseNoteResolved(note.id, true)
    const resolved = await db.proseNotes.get(note.id)
    expect(resolved?.status).toBe('resolved')
    expect(resolved?.resolvedAt).toBeTypeOf('number')
    await setProseNoteResolved(note.id, false)
    const reopened = await db.proseNotes.get(note.id)
    expect(reopened?.status).toBe('open')
    expect(reopened?.resolvedAt).toBeUndefined()
  })

  it('moves to the words it is found on now, when the writer acts on it there', async () => {
    const { world, scene, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: 'Hm.' })
    const edited = PROSE.replace('crates', 'boxes')
    const at = edited.indexOf('Mira')
    await updateProseNote(note.id, { anchor: anchorFrom(scene.id, edited, at, at + 'Mira counted the boxes'.length)! })
    expect(await db.proseNotes.get(note.id)).toMatchObject({ quote: 'Mira counted the boxes', prefix: 'The ferry left at dawn. ', body: 'Hm.' })
  })

  it('keeps the words it was made on the first time it moves, and only then (round-trip-plan.md, T6)', async () => {
    const { world, scene, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: 'Hm.' })
    // Moved onto the same words: nothing to keep.
    await updateProseNote(note.id, { anchor })
    expect((await db.proseNotes.get(note.id))?.madeOn).toBeUndefined()
    const once = PROSE.replace('crates', 'boxes')
    await updateProseNote(note.id, { anchor: anchorFrom(scene.id, once, once.indexOf('Mira'), once.indexOf('Mira') + 'Mira counted the boxes'.length)! })
    expect(await db.proseNotes.get(note.id)).toMatchObject({ quote: 'Mira counted the boxes', madeOn: 'twice the number came out wrong' })
    // Moved again: still the words it was first made on.
    const twice = PROSE.replace('crates', 'barrels')
    await updateProseNote(note.id, { anchor: anchorFrom(scene.id, twice, twice.indexOf('Mira'), twice.indexOf('Mira') + 'Mira counted the barrels'.length)! })
    expect(await db.proseNotes.get(note.id)).toMatchObject({ quote: 'Mira counted the barrels', madeOn: 'twice the number came out wrong' })

    // And it travels in a backup, as a reaction does: an optional field, read by any version that has notes.
    const exported = JSON.parse(await serializeWorldForSync(world.id))
    await deleteWorld(world.id)
    await importWorldFromJson(JSON.stringify(exported))
    expect((await db.proseNotes.get(note.id))?.madeOn).toBe('twice the number came out wrong')
  })

  it('is one step of undo each time, and a delete leaves a tombstone', async () => {
    const { world, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: 'Hm.' })
    await setProseNoteResolved(note.id, true)
    await undoLast(world.id)
    expect((await db.proseNotes.get(note.id))?.status).toBe('open')
    await undoLast(world.id)
    expect(await db.proseNotes.get(note.id)).toBeUndefined()

    const again = await addProseNote({ worldId: world.id, anchor, body: 'Again.' })
    await deleteProseNote(again.id)
    expect(await db.proseNotes.get(again.id)).toBeUndefined()
    expect(await db.tombstones.where('entityId').equals(again.id).count()).toBe(1)
  })

  it('stays when its scene is deleted, and goes with its world', async () => {
    const { world, scene, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: 'Hm.' })
    // Its words have gone with the scene; the note is the record of the review, and is kept, unplaced.
    await deleteEvent(scene.id)
    expect(await db.proseNotes.get(note.id)).toBeDefined()
    await deleteWorld(world.id)
    expect(await db.proseNotes.get(note.id)).toBeUndefined()
  })
})

describe('notes in a backup', () => {
  it('travel in the file, which says it needs this version to read it', async () => {
    const { world, anchor } = await book()
    const note = await addProseNote({ worldId: world.id, anchor, body: 'Hm.' })
    const exported = JSON.parse(await serializeWorldForSync(world.id))
    expect(exported.version).toBe(EXPORT_VERSION)
    expect(EXPORT_VERSION).toBeGreaterThanOrEqual(20)
    expect(exported.proseNotes.map((n: { id: string }) => n.id)).toEqual([note.id])

    await deleteWorld(world.id)
    expect(await db.proseNotes.count()).toBe(0)
    await importWorldFromJson(JSON.stringify(exported))
    expect(await db.proseNotes.get(note.id)).toMatchObject({ quote: 'twice the number came out wrong', body: 'Hm.' })

    // A file from before notes has none, and imports.
    const older = { ...exported, version: 19 }
    delete older.proseNotes
    await importWorldFromJson(JSON.stringify(older))
    expect(await db.proseNotes.count()).toBe(0)
  })

  it('merge: a note made on the other device arrives, and one deleted here is not brought back', async () => {
    const { world, anchor } = await book()
    const kept = await addProseNote({ worldId: world.id, anchor, body: 'Kept.' })
    const gone = await addProseNote({ worldId: world.id, anchor, body: 'Deleted here.' })
    // The other device's copy, before the delete here, with a note of its own.
    const theirs = JSON.parse(await serializeWorldForSync(world.id))
    theirs.proseNotes.push({ ...kept, id: 'from-there', body: 'Made there.' })
    await deleteProseNote(gone.id)

    await applyWorldImport((await previewWorldMerge(JSON.stringify(theirs))).parsed, 'merge')
    const bodies = (await db.proseNotes.where('worldId').equals(world.id).toArray()).map((n) => n.body).sort()
    expect(bodies).toEqual(['Kept.', 'Made there.'])
  })
})
