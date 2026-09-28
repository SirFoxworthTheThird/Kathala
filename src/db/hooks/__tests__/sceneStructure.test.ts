import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createTimeline, createChapter, createEvent } from '@/db/hooks/useTimeline'
import { setSceneText } from '@/db/hooks/useManuscript'
import { upsertSnapshot } from '@/db/hooks/useSnapshots'
import { undoLast, redoLast } from '@/db/hooks/useOperations'
import { joinWithNext, splitScene, startChapter, joinChapterToPrevious } from '@/db/hooks/useSceneStructure'
import { computeSortKey } from '@/lib/sortKey'
import { compareByPosition } from '@/lib/fractionalOrder'

/**
 * Splitting and joining scenes, against the real hooks — because the claims are
 * about what is written and, above all, about what one undo puts back: the
 * prose, the records at each scene, and everything pointing at them.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

async function seed(titles: string[], prose: Record<string, string> = {}) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: 1, title: 'One', synopsis: '' })
  const ids: Record<string, string> = {}
  let i = 0
  for (const title of titles) {
    const e = await createEvent({
      worldId: world.id, chapterId: ch.id, timelineId: tl.id, title, description: '',
      locationMarkerId: title === 'a' ? 'court' : null, involvedCharacterIds: title === 'a' ? ['wren'] : ['juno'],
      involvedItemIds: [], tags: [], sortOrder: ++i, status: title === 'a' ? 'revised' : 'outline',
    })
    ids[title] = e.id
    if (prose[title]) await setSceneText(world.id, e.id, prose[title])
  }
  await db.characters.bulkAdd(['wren', 'juno'].map((id) => ({
    id, worldId: world.id, name: id, description: '', aliases: [], tags: [],
    portraitImageId: null, isAlive: true, color: null, createdAt: 0, updatedAt: 0,
  })) as never)
  return { world, ch, ids }
}

const titles = async (chapterId: string) =>
  (await db.events.where('chapterId').equals(chapterId).toArray()).sort(compareByPosition).map((e) => e.title)
const prose = async (eventId: string) => (await db.sceneTexts.where('eventId').equals(eventId).first())?.text ?? null
const snap = (worldId: string, characterId: string, eventId: string, statusNotes: string) =>
  upsertSnapshot({
    worldId, characterId, eventId, currentLocationMarkerId: null, currentMapLayerId: null,
    inventoryItemIds: [], isAlive: true, statusNotes, travelModeId: null,
  } as never, { confirmUnchanged: true })
const notesAt = async (eventId: string) =>
  (await db.characterSnapshots.where('eventId').equals(eventId).toArray()).map((s) => `${s.characterId}:${s.statusNotes}`).sort()

describe('splitScene', () => {
  it('cuts the prose at the caret into a new scene after it, carrying the room and the cast', async () => {
    const { ch, ids } = await seed(['a', 'b'], { a: 'First half.\n\nSecond half.' })
    const made = await splitScene(ids.a, 'First half.'.length, 'a, later')

    expect(await titles(ch.id)).toEqual(['a', 'a, later', 'b'])
    expect(await prose(ids.a)).toBe('First half.')
    expect(await prose(made!.id)).toBe('Second half.')
    const after = await db.events.get(made!.id)
    expect(after).toMatchObject({ locationMarkerId: 'court', involvedCharacterIds: ['wren'], status: 'revised' })
  })

  it('keeps the whole scene in its History, and counts no new writing', async () => {
    const { world, ids } = await seed(['a'], { a: 'First half.\n\nSecond half.' })
    const logged = await db.writingLogs.where('worldId').equals(world.id).toArray()
    await splitScene(ids.a, 'First half.'.length, 'later')
    const revisions = await db.sceneRevisions.where('eventId').equals(ids.a).toArray()
    expect(revisions.map((r) => r.text)).toContain('First half.\n\nSecond half.')
    expect(await db.writingLogs.where('worldId').equals(world.id).toArray()).toEqual(logged)
  })

  it('leaves what was recorded at the scene on its first half', async () => {
    const { world, ids } = await seed(['a'], { a: 'One. Two.' })
    await snap(world.id, 'wren', ids.a, 'here')
    const made = await splitScene(ids.a, 4, 'later')
    expect(await notesAt(ids.a)).toEqual(['wren:here'])
    expect(await notesAt(made!.id)).toEqual([])
  })

  it('is one undo, prose and all, and redo puts it back', async () => {
    const { world, ch, ids } = await seed(['a', 'b'], { a: 'First half.\n\nSecond half.' })
    const made = await splitScene(ids.a, 'First half.'.length, 'later')

    await undoLast(world.id)
    expect(await titles(ch.id)).toEqual(['a', 'b'])
    expect(await prose(ids.a)).toBe('First half.\n\nSecond half.')
    // No orphaned prose left for the scene undo took away.
    expect(await prose(made!.id)).toBeNull()

    await redoLast(world.id)
    expect(await titles(ch.id)).toEqual(['a', 'later', 'b'])
    expect(await prose(ids.a)).toBe('First half.')
    expect(await prose(made!.id)).toBe('Second half.')
  })
})

describe('joinWithNext', () => {
  it('joins the next scene’s prose and fields onto this one, and removes it', async () => {
    const { ch, ids } = await seed(['a', 'b', 'c'], { a: 'One.', b: 'Two.' })
    expect(await joinWithNext(ids.a)).toBe(true)
    expect(await titles(ch.id)).toEqual(['a', 'c'])
    expect(await prose(ids.a)).toBe('One.\n\nTwo.')
    expect(await db.events.get(ids.a)).toMatchObject({
      involvedCharacterIds: ['wren', 'juno'], locationMarkerId: 'court', status: 'outline',
    })
    expect(await prose(ids.b)).toBeNull()
  })

  it('moves what was recorded at the next scene here, the later one winning a clash', async () => {
    const { world, ids } = await seed(['a', 'b'])
    await snap(world.id, 'wren', ids.a, 'early')
    await snap(world.id, 'wren', ids.b, 'late')
    await snap(world.id, 'juno', ids.b, 'only later')
    await joinWithNext(ids.a)

    expect(await notesAt(ids.a)).toEqual(['juno:only later', 'wren:late'])
    const keys = (await db.characterSnapshots.where('eventId').equals(ids.a).toArray()).map((s) => s.sortKey)
    const want = await computeSortKey(ids.a)
    expect(keys.every((k) => k === want)).toBe(true)
  })

  it('points everything that pointed at the next scene here', async () => {
    const { world, ids } = await seed(['a', 'b'])
    await db.characterGoals.add({
      id: 'g', worldId: world.id, characterId: 'wren', type: 'want', text: 'Win', startEventId: null, endEventId: ids.b,
      createdAt: 0, updatedAt: 0,
    } as never)
    await db.plotThreads.add({ id: 't', worldId: world.id, name: 'Debt', color: '#000', description: '', resolvedEventId: ids.b, createdAt: 0, updatedAt: 0 } as never)
    await joinWithNext(ids.a)
    expect((await db.characterGoals.get('g'))!.endEventId).toBe(ids.a)
    expect((await db.plotThreads.get('t'))!.resolvedEventId).toBe(ids.a)
  })

  it('is one undo that puts back the scene, its prose, its records and everything pointing at it', async () => {
    const { world, ch, ids } = await seed(['a', 'b', 'c'], { a: 'One.', b: 'Two.' })
    await snap(world.id, 'wren', ids.a, 'early')
    await snap(world.id, 'wren', ids.b, 'late')
    await db.characterGoals.add({
      id: 'g', worldId: world.id, characterId: 'wren', type: 'want', text: 'Win', startEventId: null, endEventId: ids.b,
      createdAt: 0, updatedAt: 0,
    } as never)
    const keyB = (await db.characterSnapshots.where('eventId').equals(ids.b).first())!.sortKey
    await joinWithNext(ids.a)

    await undoLast(world.id)
    expect(await titles(ch.id)).toEqual(['a', 'b', 'c'])
    expect(await prose(ids.a)).toBe('One.')
    expect(await prose(ids.b)).toBe('Two.')
    expect(await notesAt(ids.a)).toEqual(['wren:early'])
    expect(await notesAt(ids.b)).toEqual(['wren:late'])
    expect((await db.characterSnapshots.where('eventId').equals(ids.b).first())!.sortKey).toBe(keyB)
    expect((await db.characterGoals.get('g'))!.endEventId).toBe(ids.b)
    expect((await db.events.get(ids.a))!.involvedCharacterIds).toEqual(['wren'])

    await redoLast(world.id)
    expect(await titles(ch.id)).toEqual(['a', 'c'])
    expect(await prose(ids.a)).toBe('One.\n\nTwo.')
    expect(await notesAt(ids.a)).toEqual(['wren:late'])
  })

  it('takes the joined prose it is given — the Page view’s — and one undo still puts back both scenes’ own', async () => {
    const { world, ids } = await seed(['a', 'b'], { a: 'One two.', b: 'Three four.' })
    // The writer selected from "two" to "Three" and deleted it with the heading.
    await joinWithNext(ids.a, { prose: 'One four.' })
    expect(await prose(ids.a)).toBe('One four.')
    await undoLast(world.id)
    expect(await prose(ids.a)).toBe('One two.')
    expect(await prose(ids.b)).toBe('Three four.')
    await redoLast(world.id)
    expect(await prose(ids.a)).toBe('One four.')
  })

  it('does nothing for the last scene in its chapter', async () => {
    const { world, ids } = await seed(['a', 'b'])
    await db.operations.where('worldId').equals(world.id).delete()
    expect(await joinWithNext(ids.b)).toBe(false)
    expect(await db.operations.where('worldId').equals(world.id).count()).toBe(0)
  })
})

/** A book: chapter titles, each with its scenes' titles, prose given by scene title. */
async function book(shape: Array<[string, string[]]>, prose: Record<string, string> = {}) {
  const world = await createWorld({ name: 'W', description: '' })
  const tl = await createTimeline({ worldId: world.id, name: 'Main', description: '', color: '#fff' })
  const chapters: Record<string, string> = {}
  const scenes: Record<string, string> = {}
  let n = 0
  for (const [title, sceneTitles] of shape) {
    const ch = await createChapter({ worldId: world.id, timelineId: tl.id, number: ++n, title, synopsis: '' })
    chapters[title] = ch.id
    let i = 0
    for (const t of sceneTitles) {
      const e = await createEvent({
        worldId: world.id, chapterId: ch.id, timelineId: tl.id, title: t, description: '',
        locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: ++i,
      })
      scenes[t] = e.id
      if (prose[t]) await setSceneText(world.id, e.id, prose[t])
    }
  }
  return { world, tl, chapters, scenes }
}

/** The book as "Chapter: scene, scene" lines, in order. */
async function outline(timelineId: string) {
  const chapters = (await db.chapters.where('timelineId').equals(timelineId).toArray()).sort((a, b) => a.number - b.number)
  const out: string[] = []
  for (const c of chapters) out.push(`${c.title}: ${(await titles(c.id)).join(', ')}`)
  return out
}

describe('startChapter', () => {
  it('starts a chapter after this one holding the scenes after the given one, and one undo puts it back', async () => {
    const { world, tl, chapters, scenes } = await book([['One', ['a', 'b', 'c']], ['Two', ['d']]])
    const made = await startChapter({ chapterId: chapters.One, afterSceneId: scenes.a, title: 'Half', id: 'half' })
    expect(made?.id).toBe('half')
    expect(await outline(tl.id)).toEqual(['One: a', 'Half: b, c', 'Two: d'])
    await undoLast(world.id)
    expect(await outline(tl.id)).toEqual(['One: a, b, c', 'Two: d'])
    await redoLast(world.id)
    expect(await outline(tl.id)).toEqual(['One: a', 'Half: b, c', 'Two: d'])
  })

  it('from a chapter’s own heading, takes all of its scenes', async () => {
    const { tl, chapters } = await book([['One', ['a', 'b']]])
    await startChapter({ chapterId: chapters.One, afterSceneId: null, title: 'New' })
    expect(await outline(tl.id)).toEqual(['One: ', 'New: a, b'])
  })

  it('cut in a scene’s prose, the rest goes on as the new chapter’s first scene, under the same title', async () => {
    const { world, tl, chapters, scenes } = await book([['One', ['a', 'b']]], { a: 'Before.\n\nAfter.' })
    await startChapter({ chapterId: chapters.One, afterSceneId: scenes.a, title: 'Two', split: { at: 'Before.'.length, id: 'cont' } })
    expect(await outline(tl.id)).toEqual(['One: a', 'Two: a, b'])
    expect(await prose(scenes.a)).toBe('Before.')
    expect(await prose('cont')).toBe('After.')
    await undoLast(world.id)
    expect(await outline(tl.id)).toEqual(['One: a, b'])
    expect(await prose(scenes.a)).toBe('Before.\n\nAfter.')
  })

  it('goes between two chapters whose numbers leave no whole number between them', async () => {
    const { tl, chapters } = await book([['One', ['a']], ['Two', ['b']]])
    await db.chapters.update(chapters.Two, { number: 1.5 })
    await startChapter({ chapterId: chapters.One, afterSceneId: null, title: 'Between' })
    expect(await outline(tl.id)).toEqual(['One: ', 'Between: a', 'Two: b'])
  })
})

describe('joinChapterToPrevious', () => {
  it('moves its scenes to the end of the chapter before, merges its fields, removes it — and one undo puts it all back', async () => {
    const { world, tl, chapters } = await book([['One', ['a', 'b']], ['Two', ['c', 'd']], ['Three', ['e']]])
    await db.chapters.update(chapters.One, { synopsis: 'First.', wordGoal: 1000 })
    await db.chapters.update(chapters.Two, { synopsis: 'Second.', notes: 'Check dates.', wordGoal: 500 })
    expect(await joinChapterToPrevious(chapters.Two)).toBe(true)
    expect(await outline(tl.id)).toEqual(['One: a, b, c, d', 'Three: e'])
    expect(await db.chapters.get(chapters.One)).toMatchObject({ synopsis: 'First.\n\nSecond.', notes: 'Check dates.', wordGoal: 1500 })
    expect(await db.chapters.get(chapters.Two)).toBeUndefined()

    await undoLast(world.id)
    expect(await outline(tl.id)).toEqual(['One: a, b', 'Two: c, d', 'Three: e'])
    expect(await db.chapters.get(chapters.One)).toMatchObject({ synopsis: 'First.', wordGoal: 1000 })
  })

  it('does nothing for the first chapter', async () => {
    const { tl, chapters } = await book([['One', ['a']], ['Two', ['b']]])
    expect(await joinChapterToPrevious(chapters.One)).toBe(false)
    expect(await outline(tl.id)).toEqual(['One: a', 'Two: b'])
  })
})
