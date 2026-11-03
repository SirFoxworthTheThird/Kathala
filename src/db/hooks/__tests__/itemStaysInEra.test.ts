import { describe, it, expect } from 'vitest'
import { resolveItemSnapshot, resolveItemSnapshots } from '@/db/hooks/useItemSnapshots'
import { storyOf, type StoryScene } from '@/lib/stateEngine'
import type { ItemSnapshot } from '@/types'

/*
  Decision 2 of the run-10 plan: a thing's condition carries into a later era
  by in-world time, and the writer can stop an item doing so. Two eras, Mercy
  (day 0) and Quiet (day 5000), braided Mercy 1, Quiet 2.
*/
const scenes: StoryScene[] = [
  { id: 'mercy-1', chapterId: 'c1', sortOrder: 0, timelineId: 'mercy', travelDays: 0, inWorldTime: null, isFlashback: false },
  { id: 'quiet-2', chapterId: 'c2', sortOrder: 0, timelineId: 'quiet', travelDays: 0, inWorldTime: null, isFlashback: false },
]
const story = storyOf(scenes, [{ id: 'c1', number: 1 }, { id: 'c2', number: 2 }], [{ id: 'mercy', dayOffset: 0 }, { id: 'quiet', dayOffset: 5000 }])
const condition = (id: string, itemId: string, eventId: string): ItemSnapshot =>
  ({ id, worldId: 'w', itemId, eventId, condition: 'damaged', notes: '', createdAt: 0, updatedAt: 0 }) as ItemSnapshot

describe('an item kept in its era', () => {
  const records = [condition('a', 'rations', 'mercy-1'), condition('b', 'hull', 'mercy-1')]

  it('shows no condition from an earlier era, where an item that carries does', () => {
    expect(resolveItemSnapshot(records.slice(0, 1), 'quiet-2', story)?.id).toBe('a')
    expect(resolveItemSnapshot(records.slice(0, 1), 'quiet-2', story, true)).toBeUndefined()
    // In its own era it is what it was.
    expect(resolveItemSnapshot(records.slice(0, 1), 'mercy-1', story, true)?.id).toBe('a')
  })

  it('applies to the items kept, and leaves the rest carrying', () => {
    const at = (kept: string[]) => resolveItemSnapshots(records, 'quiet-2', story, new Set(kept)).map((s) => s.itemId).sort()
    expect(at([])).toEqual(['hull', 'rations'])
    expect(at(['rations'])).toEqual(['hull'])
    expect(resolveItemSnapshots(records, 'mercy-1', story, new Set(['rations'])).map((s) => s.itemId).sort()).toEqual(['hull', 'rations'])
  })
})
