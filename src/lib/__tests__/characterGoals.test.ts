import { describe, it, expect } from 'vitest'
import { eventPositions, isGoalActiveAt, activeGoalsAt, summariseGoals } from '@/lib/characterGoals'
import type { CharacterGoal, CharacterGoalType, Chapter, WorldEvent } from '@/types'

function chapter(id: string, number: number): Chapter {
  return { id, worldId: 'w', timelineId: 't1', number, title: '', synopsis: '', notes: '', wordGoal: null, createdAt: 0, updatedAt: 0 }
}
function event(id: string, chapterId: string, sortOrder: number): WorldEvent {
  return {
    id, worldId: 'w', chapterId, timelineId: 't1', title: id, description: '',
    locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
    tags: [], threadIds: [], sortOrder, travelDays: null, inWorldTime: null, tension: null,
    structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
    createdAt: 0, updatedAt: 0,
  }
}
function goal(
  id: string, type: CharacterGoalType, text: string,
  startEventId: string | null = null, endEventId: string | null = null,
  characterId = 'c1', createdAt = 0,
): CharacterGoal {
  return { id, worldId: 'w', characterId, type, text, startEventId, endEventId, createdAt, updatedAt: 0 }
}

const chapters = [chapter('ch1', 1), chapter('ch2', 2), chapter('ch3', 3)]
const events = [event('e1', 'ch1', 0), event('e2', 'ch2', 0), event('e3', 'ch3', 0)]
const positions = eventPositions(events, chapters)

describe('eventPositions', () => {
  it('orders by chapter number, then position within the chapter', () => {
    const p = eventPositions(
      [event('a', 'ch2', 1), event('b', 'ch1', 0), event('c', 'ch2', 0)],
      chapters,
    )
    expect(p.get('b')!).toBeLessThan(p.get('c')!)
    expect(p.get('c')!).toBeLessThan(p.get('a')!)
  })
})

describe('isGoalActiveAt', () => {
  it('treats an unscoped goal as always active', () => {
    expect(isGoalActiveAt(goal('g', 'want', 'x'), 'e1', positions)).toBe(true)
    expect(isGoalActiveAt(goal('g', 'want', 'x'), 'e3', positions)).toBe(true)
  })

  it('is inactive before its start event', () => {
    const g = goal('g', 'want', 'x', 'e2')
    expect(isGoalActiveAt(g, 'e1', positions)).toBe(false)
    expect(isGoalActiveAt(g, 'e2', positions)).toBe(true)
    expect(isGoalActiveAt(g, 'e3', positions)).toBe(true)
  })

  it('is inactive after its end event, inclusive of the end itself', () => {
    const g = goal('g', 'want', 'x', null, 'e2')
    expect(isGoalActiveAt(g, 'e1', positions)).toBe(true)
    expect(isGoalActiveAt(g, 'e2', positions)).toBe(true)
    expect(isGoalActiveAt(g, 'e3', positions)).toBe(false)
  })

  it('is active exactly at the one event when start and end match', () => {
    const g = goal('g', 'need', 'x', 'e2', 'e2')
    expect(isGoalActiveAt(g, 'e1', positions)).toBe(false)
    expect(isGoalActiveAt(g, 'e2', positions)).toBe(true)
    expect(isGoalActiveAt(g, 'e3', positions)).toBe(false)
  })

  it('counts every goal as active with no cursor (the "All chapters" view)', () => {
    expect(isGoalActiveAt(goal('g', 'want', 'x', 'e3'), null, positions)).toBe(true)
  })

  it('falls back to active when the cursor event is unknown', () => {
    expect(isGoalActiveAt(goal('g', 'want', 'x', 'e3'), 'missing', positions)).toBe(true)
  })
})

describe('activeGoalsAt', () => {
  const goals = [
    goal('g-flaw', 'flaw', 'pride'),
    goal('g-want', 'want', 'the throne'),
    goal('g-fear', 'fear', 'his father', null, 'e1'),
    goal('g-other', 'want', 'someone else', null, null, 'c2'),
  ]

  it('returns only the character\'s goals, in want → need → fear → flaw order', () => {
    expect(activeGoalsAt(goals, 'c1', 'e1', positions).map((g) => g.id))
      .toEqual(['g-want', 'g-fear', 'g-flaw'])
  })

  it('drops goals that have ended by the cursor', () => {
    expect(activeGoalsAt(goals, 'c1', 'e2', positions).map((g) => g.id))
      .toEqual(['g-want', 'g-flaw'])
  })

  it('never mixes in another character\'s goals', () => {
    expect(activeGoalsAt(goals, 'c2', 'e1', positions).map((g) => g.id)).toEqual(['g-other'])
  })
})

describe('summariseGoals', () => {
  it('renders a labelled one-liner', () => {
    expect(summariseGoals([goal('a', 'want', 'reclaim the throne'), goal('b', 'fear', 'becoming his father')]))
      .toBe('Want: reclaim the throne · Fear: becoming his father')
  })
  it('is empty for no goals', () => {
    expect(summariseGoals([])).toBe('')
  })
})
