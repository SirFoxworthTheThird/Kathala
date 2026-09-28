import { describe, expect, it } from 'vitest'
import { joinProse, mergeChapterFields, mergeSceneFields, splitCarries, splitProse } from '../sceneStructure'
import type { Chapter, WorldEvent } from '@/types'

const scene = (over: Partial<WorldEvent>): WorldEvent => ({
  id: 'x', worldId: 'w', chapterId: 'c', timelineId: 't', title: 'T', description: '', sortOrder: 1,
  tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
  threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
  povCharacterId: null, tension: null, isFlashback: false, createdAt: 0, updatedAt: 0, ...over,
} as WorldEvent)

describe('splitProse', () => {
  it('cuts at the caret and trims the join', () => {
    expect(splitProse('One.\n\nTwo.', 4)).toEqual({ head: 'One.', tail: 'Two.' })
    expect(splitProse('One.\n\nTwo.', 5)).toEqual({ head: 'One.', tail: 'Two.' })
  })
  it('clamps a caret past either end', () => {
    expect(splitProse('Words', -3)).toEqual({ head: '', tail: 'Words' })
    expect(splitProse('Words', 99)).toEqual({ head: 'Words', tail: '' })
  })
})

describe('joinProse', () => {
  it('puts a paragraph break between the halves, and nothing for an empty one', () => {
    expect(joinProse('One.', 'Two.')).toBe('One.\n\nTwo.')
    expect(joinProse('One.\n\n', '\nTwo.')).toBe('One.\n\nTwo.')
    expect(joinProse(null, 'Two.')).toBe('Two.')
    expect(joinProse('One.', '  ')).toBe('One.')
  })
})

describe('splitCarries', () => {
  it('carries the room and who is in it, not the tension or the description', () => {
    const carried = splitCarries(scene({
      locationMarkerId: 'court', involvedCharacterIds: ['tv'], status: 'revised', tension: 5, description: 'Why.',
    }))
    expect(carried).toMatchObject({ locationMarkerId: 'court', involvedCharacterIds: ['tv'], status: 'revised' })
    expect(carried).not.toHaveProperty('tension')
    expect(carried).not.toHaveProperty('description')
  })
})

describe('mergeSceneFields', () => {
  it('takes everyone in either half, and present outranks mentioned', () => {
    const merged = mergeSceneFields(
      scene({ involvedCharacterIds: ['a'], mentionedCharacterIds: ['b'] }),
      scene({ involvedCharacterIds: ['b', 'c'], mentionedCharacterIds: ['d', 'a'] }),
    )
    expect(merged.involvedCharacterIds).toEqual(['a', 'b', 'c'])
    expect(merged.mentionedCharacterIds).toEqual(['d'])
  })

  it('keeps the first half’s place and point of view, falling back to the second’s', () => {
    expect(mergeSceneFields(scene({ locationMarkerId: 'p1' }), scene({ locationMarkerId: 'p2' })).locationMarkerId).toBe('p1')
    expect(mergeSceneFields(scene({}), scene({ locationMarkerId: 'p2', povCharacterId: 'v' })))
      .toMatchObject({ locationMarkerId: 'p2', povCharacterId: 'v' })
  })

  it('is as finished as its least finished half, and as tense as its tenser', () => {
    expect(mergeSceneFields(scene({ status: 'final', tension: 2 }), scene({ status: 'outline', tension: 4 })))
      .toMatchObject({ status: 'outline', tension: 4 })
    expect(mergeSceneFields(scene({ status: 'idea' }), scene({ status: 'revised' })).status).toBe('idea')
    expect(mergeSceneFields(scene({}), scene({})).tension).toBeNull()
  })

  it('adds up the days both halves covered', () => {
    expect(mergeSceneFields(scene({ travelDays: 2 }), scene({ travelDays: 3 })).travelDays).toBe(5)
    expect(mergeSceneFields(scene({ travelDays: 2 }), scene({})).travelDays).toBe(2)
    expect(mergeSceneFields(scene({}), scene({})).travelDays).toBeNull()
  })
})

describe('mergeChapterFields', () => {
  const chapter = (over: Partial<Chapter>): Chapter => ({
    id: 'c', worldId: 'w', timelineId: 't', number: 1, title: 'T', synopsis: '', notes: '', wordGoal: null,
    createdAt: 0, updatedAt: 0, ...over,
  })

  it('keeps both synopses and both notes, the first chapter’s first, and nothing for an empty one', () => {
    const m = mergeChapterFields(chapter({ synopsis: 'Arrive.', notes: '' }), chapter({ synopsis: ' Leave. ', notes: 'Dates?' }))
    expect(m.synopsis).toBe('Arrive.\n\nLeave.')
    expect(m.notes).toBe('Dates?')
  })

  it('adds the word goals, keeps one that only one chapter had, and has none when neither did', () => {
    expect(mergeChapterFields(chapter({ wordGoal: 1000 }), chapter({ wordGoal: 500 })).wordGoal).toBe(1500)
    expect(mergeChapterFields(chapter({ wordGoal: null }), chapter({ wordGoal: 500 })).wordGoal).toBe(500)
    expect(mergeChapterFields(chapter({}), chapter({})).wordGoal).toBeNull()
  })
})
