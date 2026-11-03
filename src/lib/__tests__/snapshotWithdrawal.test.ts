import { describe, it, expect } from 'vitest'
import { describeWithdrawal, withdrawalOutcome } from '@/lib/snapshotWithdrawal'
import { storyOf } from '@/lib/stateEngine'
import type { PersonRecord } from '@/lib/personState'

const chapters = [
  { id: 'c1', number: 1 },
  { id: 'c2', number: 2 },
]
const events = [
  { id: 'e1', chapterId: 'c1', sortOrder: 0 },
  { id: 'e2', chapterId: 'c1', sortOrder: 1 },
  { id: 'e3', chapterId: 'c2', sortOrder: 0 },
  { id: 'e4', chapterId: 'c2', sortOrder: 1 },
]

const story = storyOf(events.map((e) => ({ ...e, timelineId: 'tl' })), chapters, [])

const snap = (id: string, eventId: string, said: Partial<PersonRecord> = {}): PersonRecord =>
  ({ id, worldId: 'w', characterId: 'anna', eventId, createdAt: 0, updatedAt: 0, ...said })

describe('withdrawalOutcome', () => {
  it('falls back to the last record before the one being removed', () => {
    const own = [snap('a', 'e1'), snap('b', 'e2')]
    const { fallback } = withdrawalOutcome(own, 'b', events, story)
    expect(fallback?.id).toBe('a')
  })

  it('has no fallback when the record being removed is the earliest', () => {
    const own = [snap('a', 'e1'), snap('b', 'e3')]
    const { fallback } = withdrawalOutcome(own, 'a', events, story)
    expect(fallback).toBeUndefined()
  })

  it('does not fall back to a record at a *later* scene', () => {
    // The one that would make this test vacuous: 'b' is at e3, after 'a' at e1.
    const own = [snap('a', 'e1'), snap('b', 'e3')]
    const { fallback } = withdrawalOutcome(own, 'a', events, story)
    expect(fallback?.id).not.toBe('b')
  })

  it('counts the later scenes that read from the record', () => {
    // 'b' at e2 is the last-known for e3 and e4 — both follow it back to 'a'.
    const own = [snap('a', 'e1'), snap('b', 'e2')]
    expect(withdrawalOutcome(own, 'b', events, story).followers).toBe(2)
  })

  it('stops counting at the next record of its own', () => {
    // e3 has its own record, so e3 and e4 read from that, not from 'b'.
    const own = [snap('a', 'e1'), snap('b', 'e2'), snap('c', 'e3')]
    expect(withdrawalOutcome(own, 'b', events, story).followers).toBe(0)
    // And the presence half: without 'c', those same two scenes do follow.
    expect(withdrawalOutcome([snap('a', 'e1'), snap('b', 'e2')], 'b', events, story).followers).toBe(2)
  })

  /*
    A record says only what its scene said (Part B2). 'b' moves her to the
    vault; 'c' at e3 says only her wound — so e3 and e4 still read the vault
    from 'b', and go back to the quay with it. Paired: where 'c' says a place
    of its own, they do not.
  */
  it('counts a later record that reads the rest of its state from the one removed', () => {
    const place = (p: string) => ({ currentLocationMarkerId: p, currentMapLayerId: null })
    const own = [snap('a', 'e1', place('quay')), snap('b', 'e2', place('vault')), snap('c', 'e3', { statusNotes: 'wounded' })]
    expect(withdrawalOutcome(own, 'b', events, story).followers).toBe(2)
    const own2 = [snap('a', 'e1', place('quay')), snap('b', 'e2', place('vault')), snap('c', 'e3', { ...place('cellar'), statusNotes: 'wounded' })]
    expect(withdrawalOutcome(own2, 'b', events, story).followers).toBe(0)
  })

  it('counts nothing for a record at the last scene', () => {
    const own = [snap('a', 'e1'), snap('b', 'e4')]
    expect(withdrawalOutcome(own, 'b', events, story).followers).toBe(0)
  })

  it('returns nothing for an id that is not in the set', () => {
    const own = [snap('a', 'e1')]
    expect(withdrawalOutcome(own, 'nope', events, story)).toEqual({ fallback: undefined, followers: 0 })
  })
})

describe('describeWithdrawal', () => {
  it('names where the state goes back to', () => {
    expect(describeWithdrawal('Ossian Marl', 'Ch. 1 · The pour', 0))
      .toBe("Ossian Marl's state at this scene will go back to being carried forward from Ch. 1 · The pour.")
  })

  it('says so plainly when there is nothing to fall back to', () => {
    expect(describeWithdrawal('Ossian Marl', null, 0))
      .toBe('Ossian Marl will have no recorded state at or before this scene.')
  })

  it('adds the followers only when there are some, and agrees in number', () => {
    expect(describeWithdrawal('Cathe', 'Ch. 1 · The pour', 0)).not.toMatch(/scene[s]? currently read/)
    expect(describeWithdrawal('Cathe', 'Ch. 1 · The pour', 1)).toContain('1 later scene currently reads from this record')
    expect(describeWithdrawal('Cathe', 'Ch. 1 · The pour', 4)).toContain('4 later scenes currently read from this record')
  })
})
