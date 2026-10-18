import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent, moveChapterToTimeline } from '@/db/hooks/useTimeline'
import { joinChapterToPrevious, startChapter } from '@/db/hooks/useSceneStructure'
import { undoLast } from '@/db/hooks/useOperations'

/**
 * Restructuring from the Page on *All timelines* (`inBook`): the chapter
 * before or after is the book's, of whichever timeline — and a chapter can be
 * given to another timeline, its scenes with it.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

/** The First Age's chapter 1, the Second Age's 2 and 3: one scene each. */
async function braid() {
  const world = await createWorld({ name: 'W', description: '' })
  const a = await createTimeline({ worldId: world.id, name: 'The First Age', description: '', color: '#fff' })
  const b = await createTimeline({ worldId: world.id, name: 'The Second Age', description: '', color: '#fff' })
  const ids: Record<string, string> = {}
  for (const [title, tl, number] of [['Ash', a.id, 1], ['Brine', b.id, 2], ['Cinder', b.id, 3]] as const) {
    const ch = await createChapter({ worldId: world.id, timelineId: tl, number, title, synopsis: '' })
    const e = await createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl, title: `${title} scene`, description: '',
      locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 1,
    })
    ids[title] = ch.id
    ids[`${title} scene`] = e.id
  }
  return { worldId: world.id, a: a.id, b: b.id, ids }
}

/** number:title:timeline, in number order; and where a chapter's scenes are not in its timeline. */
async function book(names: Record<string, string>) {
  const scenes = await db.events.toArray()
  return (await db.chapters.toArray()).sort((x, y) => x.number - y.number).map((c) => {
    const stray = scenes.some((e) => e.chapterId === c.id && e.timelineId !== c.timelineId) ? '!' : ''
    return `${c.number}:${c.title}:${names[c.timelineId]}${stray}`
  })
}

describe('on All timelines', () => {
  it('starts a chapter straight after the one it was typed in, in that one’s timeline', async () => {
    const { a, b, ids } = await braid()
    await startChapter({ chapterId: ids.Ash, afterSceneId: ids['Ash scene'], title: 'Ember', inBook: true })
    expect(await book({ [a]: 'A', [b]: 'B' })).toEqual(['1:Ash:A', '2:Ember:A', '3:Brine:B', '4:Cinder:B'])
  })

  it('joins a chapter into the book’s chapter before it, whose timeline its scenes then take', async () => {
    const { a, b, ids } = await braid()
    // On the Second Age's own tab Brine is its first chapter: nothing to join into.
    expect(await joinChapterToPrevious(ids.Brine)).toBe(false)
    expect(await joinChapterToPrevious(ids.Brine, { inBook: true })).toBe(true)
    expect(await book({ [a]: 'A', [b]: 'B' })).toEqual(['1:Ash:A', '3:Cinder:B'])
    expect((await db.events.get(ids['Brine scene']))?.chapterId).toBe(ids.Ash)
  })

  it('gives a chapter and its scenes to another timeline, and one undo gives them back', async () => {
    const { worldId, a, b, ids } = await braid()
    await moveChapterToTimeline(ids.Brine, a)
    expect(await book({ [a]: 'A', [b]: 'B' })).toEqual(['1:Ash:A', '2:Brine:A', '3:Cinder:B'])
    await undoLast(worldId)
    expect(await book({ [a]: 'A', [b]: 'B' })).toEqual(['1:Ash:A', '2:Brine:B', '3:Cinder:B'])
    // Not to another world's timeline.
    const other = await createTimeline({ worldId: 'elsewhere', name: 'X', description: '', color: '#fff' })
    await moveChapterToTimeline(ids.Brine, other.id)
    expect((await db.chapters.get(ids.Brine))?.timelineId).toBe(b)
  })
})
