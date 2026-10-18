import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { updateCharacter } from '@/db/hooks/useCharacters'
import { undoLast } from '@/db/hooks/useOperations'
import { replaceSceneTexts } from '@/db/hooks/useSceneStructure'

/**
 * Find & replace's Replace all, against the real hooks: every scene changes in
 * one act — all of them or none — and one undo puts every one back, with the
 * character it renamed.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed(texts: string[]) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ids: string[] = []
  for (const [i, text] of texts.entries()) {
    const e = await createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: `s${i}`, description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: i + 1,
    })
    await setSceneText(world.id, e.id, text)
    ids.push(e.id)
  }
  await db.characters.add({
    id: 'mira', worldId: world.id, name: 'Mira', description: '', aliases: [], tags: [],
    portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
  } as never)
  return { worldId: world.id, ids }
}

const proseOf = async (ids: string[]) =>
  Promise.all(ids.map(async (id) => (await db.sceneTexts.where('eventId').equals(id).first())?.text ?? null))

describe('replaceSceneTexts', () => {
  it('replaces in every scene, and one undo puts every scene and the renamed character back', async () => {
    const { worldId, ids } = await seed(['Mira ran.', 'Mira hid.', 'Mira sang.'])
    await replaceSceneTexts(worldId, ids.map((id, i) => ({ eventId: id, text: ['Nyra ran.', 'Nyra hid.', 'Nyra sang.'][i] })), {
      label: 'Replaced “Mira” with “Nyra”',
      also: () => updateCharacter('mira', { name: 'Nyra' }),
    })
    expect(await proseOf(ids)).toEqual(['Nyra ran.', 'Nyra hid.', 'Nyra sang.'])
    expect((await db.characters.get('mira'))?.name).toBe('Nyra')
    // Each scene's text from before the replace is in its History.
    for (const id of ids) {
      expect((await db.sceneRevisions.where('eventId').equals(id).toArray()).map((r) => r.text)).toContain(
        (['Mira ran.', 'Mira hid.', 'Mira sang.'])[ids.indexOf(id)],
      )
    }

    await undoLast(worldId)
    expect(await proseOf(ids)).toEqual(['Mira ran.', 'Mira hid.', 'Mira sang.'])
    expect((await db.characters.get('mira'))?.name).toBe('Mira')
  })

  it('writes nothing at all when any part of it fails', async () => {
    const { worldId, ids } = await seed(['Mira ran.', 'Mira hid.'])
    await expect(replaceSceneTexts(worldId, ids.map((id) => ({ eventId: id, text: 'gone' })), {
      label: 'x',
      also: async () => { throw new Error('rename failed') },
    })).rejects.toThrow('rename failed')
    expect(await proseOf(ids)).toEqual(['Mira ran.', 'Mira hid.'])
  })
})
