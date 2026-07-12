import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db/database'
import { createWorldFromManuscript } from '@/db/hooks/useManuscript'
import { parseManuscript } from '@/lib/manuscriptImport'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const SRC = [
  '# My Novel',
  '',
  '## Chapter 1: Beginnings',
  '',
  'The first paragraph of the book.',
  '',
  '* * *',
  '',
  'A second scene follows.',
  '',
  '## Chapter 2',
  '',
  'The story continues onward.',
].join('\n')

describe('createWorldFromManuscript', () => {
  it('creates a world, timeline, chapters, scene events and prose', async () => {
    const parsed = parseManuscript(SRC)
    const worldId = await createWorldFromManuscript(parsed, 'My Novel')

    const world = await db.worlds.get(worldId)
    expect(world?.name).toBe('My Novel')

    const timelines = await db.timelines.where('worldId').equals(worldId).toArray()
    expect(timelines).toHaveLength(1)
    expect(timelines[0].name).toBe('Main Timeline')

    const chapters = await db.chapters.where('worldId').equals(worldId).sortBy('number')
    expect(chapters.map((c) => [c.number, c.title])).toEqual([
      [1, 'Beginnings'],
      [2, ''],
    ])

    // Chapter 1 has two scene events in order, Chapter 2 has one.
    const ch1Events = await db.events.where('chapterId').equals(chapters[0].id).sortBy('sortOrder')
    expect(ch1Events.map((e) => e.title)).toEqual(['Scene 1', 'Scene 2'])

    const ch2Events = await db.events.where('chapterId').equals(chapters[1].id).toArray()
    expect(ch2Events).toHaveLength(1)

    // Prose is stored and word-counted.
    const firstText = await db.sceneTexts.where('eventId').equals(ch1Events[0].id).first()
    expect(firstText?.text).toBe('The first paragraph of the book.')
    expect(firstText?.wordCount).toBe(6)

    // Every scene event has prose; totals line up.
    const allScenes = await db.sceneTexts.where('worldId').equals(worldId).toArray()
    expect(allScenes).toHaveLength(3)
  })

  it('falls back to the parsed title, then a default, when no name is given', async () => {
    const worldId = await createWorldFromManuscript(parseManuscript(SRC), '   ')
    expect((await db.worlds.get(worldId))?.name).toBe('My Novel')

    const bare = await createWorldFromManuscript(parseManuscript('Just prose, no title.'), '')
    expect((await db.worlds.get(bare))?.name).toBe('Imported Manuscript')
  })

  it('imports a plain draft (no headings) as a single chapter', async () => {
    const worldId = await createWorldFromManuscript(
      parseManuscript('Scene A.\n\n***\n\nScene B.'),
      'Draft'
    )
    const chapters = await db.chapters.where('worldId').equals(worldId).toArray()
    expect(chapters).toHaveLength(1)
    const events = await db.events.where('chapterId').equals(chapters[0].id).sortBy('sortOrder')
    expect(events).toHaveLength(2)
  })
})
