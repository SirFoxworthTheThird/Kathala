import { describe, it, expect } from 'vitest'
import { mergeRecords } from '@/lib/mergeFields'
import type { WorldEvent } from '@/types'

/**
 * Merging two copies of a world that were edited apart.
 *
 * The rule the whole file turns on: a `.pwk` carries no record of *what* each
 * side changed, only the state each side ended up in. So a scalar that differs
 * is a genuine conflict — one of the two has to win, and the newer write does.
 * A set-like field is different: additions and removals commute, so both sides'
 * changes can be kept without choosing between them.
 */

const event = (over: Partial<WorldEvent> = {}): WorldEvent => ({
  id: 'ev-1',
  worldId: 'w1',
  chapterId: 'ch-1',
  title: 'The Meeting',
  description: '',
  sortOrder: 1,
  involvedCharacterIds: [],
  mentionedCharacterIds: [],
  involvedItemIds: [],
  tags: [],
  threadIds: [],
  povCharacterId: null,
  locationMarkerId: null,
  status: 'draft',
  createdAt: 1_000,
  updatedAt: 1_000,
  ...over,
} as WorldEvent)

describe('mergeRecords', () => {
  it('keeps both sides when each adds to a set', () => {
    // The case that matters most: two people add a different character to the
    // same scene's cast. Neither addition contradicts the other.
    const local = event({ involvedCharacterIds: ['c-ana'], updatedAt: 2_000 })
    const incoming = event({ involvedCharacterIds: ['c-bo'], updatedAt: 3_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.involvedCharacterIds.sort()).toEqual(['c-ana', 'c-bo'])
  })

  it('unions tags rather than replacing the array', () => {
    const local = event({ tags: ['heist', 'night'], updatedAt: 2_000 })
    const incoming = event({ tags: ['heist', 'rain'], updatedAt: 1_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.tags.sort()).toEqual(['heist', 'night', 'rain'])
  })

  it('preserves the order each side already had, newcomers last', () => {
    // Cast order is meaningful — it drives who reads as the focus of a scene —
    // so a merge must not reshuffle what either side deliberately arranged.
    const local = event({ involvedCharacterIds: ['c-ana', 'c-bo'], updatedAt: 2_000 })
    const incoming = event({ involvedCharacterIds: ['c-bo', 'c-cy'], updatedAt: 3_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.involvedCharacterIds).toEqual(['c-ana', 'c-bo', 'c-cy'])
  })

  it('gives a differing scalar to whichever side wrote last', () => {
    const local = event({ title: 'The Meeting', updatedAt: 2_000 })
    const incoming = event({ title: 'The Reckoning', updatedAt: 3_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.title).toBe('The Reckoning')
  })

  it('keeps the local scalar when local wrote last', () => {
    const local = event({ title: 'The Meeting', updatedAt: 4_000 })
    const incoming = event({ title: 'The Reckoning', updatedAt: 3_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.title).toBe('The Meeting')
  })

  it('reports a scalar that both sides changed, so it can be shown rather than silently dropped', () => {
    const local = event({ title: 'The Meeting', description: 'Rain.', updatedAt: 2_000 })
    const incoming = event({ title: 'The Reckoning', description: 'Rain.', updatedAt: 3_000 })

    const { conflicts } = mergeRecords(local, incoming)
    expect(conflicts).toEqual([
      { field: 'title', local: 'The Meeting', incoming: 'The Reckoning', kept: 'incoming' },
    ])
  })

  it('reports nothing when the two copies agree', () => {
    const { conflicts, record } = mergeRecords(event(), event())
    expect(conflicts).toEqual([])
    expect(record).toEqual(event())
  })

  it('lets an explicit preference overrule the timestamp', () => {
    // Once someone has been shown both versions, their answer beats a clock —
    // which is the whole reason for showing them.
    const local = event({ title: 'The Meeting', updatedAt: 2_000 })
    const incoming = event({ title: 'The Reckoning', updatedAt: 9_000 })

    expect(mergeRecords(local, incoming, 'newer').record.title).toBe('The Reckoning')
    expect(mergeRecords(local, incoming, 'local').record.title).toBe('The Meeting')
    expect(mergeRecords(local, incoming, 'incoming').record.title).toBe('The Reckoning')
  })

  it('reports which side a preference took, not which the clock would have', () => {
    const local = event({ title: 'The Meeting', updatedAt: 2_000 })
    const incoming = event({ title: 'The Reckoning', updatedAt: 9_000 })

    const { conflicts } = mergeRecords(local, incoming, 'local')
    expect(conflicts).toEqual([
      { field: 'title', local: 'The Meeting', incoming: 'The Reckoning', kept: 'local' },
    ])
  })

  it('still unions sets whatever the preference says', () => {
    // A union is not a choice between two versions, so there is nothing for a
    // preference to settle — picking "keep mine" must not throw away a tag
    // somebody else added.
    const local = event({ tags: ['heist'], updatedAt: 9_000 })
    const incoming = event({ tags: ['rain'], updatedAt: 1_000 })

    for (const prefer of ['newer', 'local', 'incoming'] as const) {
      expect(mergeRecords(local, incoming, prefer).record.tags.sort()).toEqual(['heist', 'rain'])
    }
  })

  it('does not lose a set edit to a scalar edit made later elsewhere', () => {
    // The shipped behaviour this replaces took the whole newer record, so the
    // local cast addition vanished because someone else retitled the scene.
    const local = event({ involvedCharacterIds: ['c-ana'], updatedAt: 2_000 })
    const incoming = event({ title: 'The Reckoning', updatedAt: 9_000 })

    const { record } = mergeRecords(local, incoming)
    expect(record.title).toBe('The Reckoning')
    expect(record.involvedCharacterIds).toEqual(['c-ana'])
  })
})
