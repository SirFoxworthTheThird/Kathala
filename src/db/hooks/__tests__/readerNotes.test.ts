import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { deleteProseNote } from '@/db/hooks/useProseNotes'
import { addReaction, importReaderNotes, isOwnReaderNote, readerNotesFor } from '@/db/hooks/useReaderNotes'
import { undoLast } from '@/db/hooks/useOperations'
import { anchorFrom, placeNote } from '@/lib/noteAnchor'

/** Notes from beta readers (editorial-plan.md, R7): reacted to in a copy, sent, and brought in against the book as it is now. */

beforeEach(async () => { await db.delete(); await db.open() })
afterAll(async () => { await db.delete() })

const PROSE = 'Mira lit the lantern before dawn. The lantern smoked in the cold.\n\nThe road was empty, and she walked it alone.'

async function book() {
  const world = await createWorld({ name: 'The Long Road', description: '' })
  const timeline = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#888' })
  const chapter = await createChapter({ worldId: world.id, timelineId: timeline.id, number: 1, title: 'One', synopsis: '' })
  const scene = await createEvent({
    worldId: world.id, chapterId: chapter.id, timelineId: timeline.id, title: 'Dawn', description: '',
    locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
  })
  await setSceneText(world.id, scene.id, PROSE)
  const on = (words: string) => anchorFrom(scene.id, PROSE, PROSE.indexOf(words), PROSE.indexOf(words) + words.length)!
  return { world, scene, on }
}

/** A reader's file, made in their copy: then the copy's own notes go, as they would never have been in the writer's. */
async function sent(worldId: string, reader: string, reactions: Array<[string, Parameters<typeof addReaction>[2], string?]>, on: (w: string) => ReturnType<typeof anchorFrom>) {
  for (const [words, r, body] of reactions) await addReaction(worldId, on(words)!, r, body)
  const file = await readerNotesFor(worldId, reader, { eventId: 'x', chapter: 1, scene: 'Dawn' }, 100)
  for (const n of (await db.proseNotes.toArray()).filter(isOwnReaderNote)) await deleteProseNote(n.id)
  return JSON.stringify(file)
}

describe('a reader’s notes', () => {
  it('are the reader’s own until sent: the file holds their notes and no one else’s', async () => {
    const { world, on } = await book()
    await addReaction(world.id, on('The lantern smoked'), 'lost', 'Why smoke?')
    const file = await readerNotesFor(world.id, 'Ines', null, 7)
    expect(file.notes.map((n) => [n.quote, n.reaction, n.body])).toEqual([['The lantern smoked', 'lost', 'Why smoke?']])
    expect(JSON.stringify(file)).not.toContain('walked it alone')
  })

  it('brought in against the book as it is now: on their words if they are there, unplaced if rewritten; the reader recorded with how far they read', async () => {
    const { world, scene, on } = await book()
    const file = await sent(world.id, 'Ines', [['The lantern smoked', 'lost', 'Why smoke?'], ['she walked it alone', 'loved']], on)
    // The writer has rewritten the first sentence since the reader's copy.
    const now = PROSE.replace('The lantern smoked in the cold.', 'Frost had taken the wick.')
    await setSceneText(world.id, scene.id, now)

    expect(await importReaderNotes(world.id, file, 200)).toEqual({ reader: 'Ines', notes: 2, replaced: 0 })
    const notes = await db.proseNotes.where('worldId').equals(world.id).toArray()
    expect(notes.map((n) => [n.author, n.reaction, n.body])).toEqual(expect.arrayContaining([
      [{ kind: 'reader', name: 'Ines' }, 'lost', 'Why smoke?'],
      [{ kind: 'reader', name: 'Ines' }, 'loved', ''],
    ]))
    const place = (q: string) => placeNote(notes.find((n) => n.quote === q)!, [{ eventId: scene.id, text: now }])
    expect(place('she walked it alone')).toMatchObject({ eventId: scene.id, exact: true })
    expect(place('The lantern smoked')).toBeNull()
    expect((await db.worlds.get(world.id))!.betaReaders).toEqual([{ name: 'Ines', readTo: { eventId: 'x', chapter: 1, scene: 'Dawn' }, notes: 2, sentAt: 100, receivedAt: 200 }])
  })

  it('a second file from the same reader replaces the first, and another reader’s stay; one step of undo', async () => {
    const { world, on } = await book()
    await importReaderNotes(world.id, await sent(world.id, 'Ines', [['The lantern smoked', 'lost'], ['she walked it alone', 'loved']], on))
    await importReaderNotes(world.id, await sent(world.id, 'Tomas', [['The road was empty', 'slow']], on))
    expect(await importReaderNotes(world.id, await sent(world.id, ' ines ', [['The road was empty', 'where']], on))).toEqual({ reader: 'ines', notes: 1, replaced: 2 })
    const by = async () => (await db.proseNotes.toArray()).map((n) => [n.author.name, n.reaction]).sort()
    expect(await by()).toEqual([['Tomas', 'slow'], ['ines', 'where']])
    expect((await db.worlds.get(world.id))!.betaReaders!.map((r) => r.name)).toEqual(['Tomas', 'ines'])
    await undoLast(world.id)
    expect(await by()).toEqual([['Ines', 'lost'], ['Ines', 'loved'], ['Tomas', 'slow']])
  })

  it('a file on another book is refused', async () => {
    const { world, on } = await book()
    const file = JSON.parse(await sent(world.id, 'Ines', [['The lantern smoked', 'lost']], on))
    await expect(importReaderNotes(world.id, JSON.stringify({ ...file, worldId: 'other' }))).rejects.toThrow('on another book, The Long Road')
    expect(await db.proseNotes.count()).toBe(0)
  })
})
