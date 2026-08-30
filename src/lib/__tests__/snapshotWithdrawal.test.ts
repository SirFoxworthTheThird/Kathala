import { describe, it, expect } from 'vitest'
import { describeWithdrawal, withdrawalOutcome } from '@/lib/snapshotWithdrawal'
import type { ChapterStub, EventStub } from '@/lib/snapshotUtils'

const chapters: ChapterStub[] = [
  { id: 'c1', number: 1 },
  { id: 'c2', number: 2 },
]
const events: EventStub[] = [
  { id: 'e1', chapterId: 'c1', sortOrder: 0 },
  { id: 'e2', chapterId: 'c1', sortOrder: 1 },
  { id: 'e3', chapterId: 'c2', sortOrder: 0 },
  { id: 'e4', chapterId: 'c2', sortOrder: 1 },
]

type Snap = { id: string; eventId: string; sortKey?: number | null; updatedAt: number }
const snap = (id: string, eventId: string): Snap => ({ id, eventId, updatedAt: 0 })

describe('withdrawalOutcome', () => {
  it('falls back to the last record before the one being removed', () => {
    const own = [snap('a', 'e1'), snap('b', 'e2')]
    const { fallback } = withdrawalOutcome(own, 'b', events, chapters)
    expect(fallback?.id).toBe('a')
  })

  it('has no fallback when the record being removed is the earliest', () => {
    const own = [snap('a', 'e1'), snap('b', 'e3')]
    const { fallback } = withdrawalOutcome(own, 'a', events, chapters)
    expect(fallback).toBeUndefined()
  })

  it('does not fall back to a record at a *later* scene', () => {
    // The one that would make this test vacuous: 'b' is at e3, after 'a' at e1.
    const own = [snap('a', 'e1'), snap('b', 'e3')]
    const { fallback } = withdrawalOutcome(own, 'a', events, chapters)
    expect(fallback?.id).not.toBe('b')
  })

  it('counts the later scenes that read from the record', () => {
    // 'b' at e2 is the last-known for e3 and e4 — both follow it back to 'a'.
    const own = [snap('a', 'e1'), snap('b', 'e2')]
    expect(withdrawalOutcome(own, 'b', events, chapters).followers).toBe(2)
  })

  it('stops counting at the next record of its own', () => {
    // e3 has its own record, so e3 and e4 read from that, not from 'b'.
    const own = [snap('a', 'e1'), snap('b', 'e2'), snap('c', 'e3')]
    expect(withdrawalOutcome(own, 'b', events, chapters).followers).toBe(0)
    // And the presence half: without 'c', those same two scenes do follow.
    expect(withdrawalOutcome([snap('a', 'e1'), snap('b', 'e2')], 'b', events, chapters).followers).toBe(2)
  })

  it('counts nothing for a record at the last scene', () => {
    const own = [snap('a', 'e1'), snap('b', 'e4')]
    expect(withdrawalOutcome(own, 'b', events, chapters).followers).toBe(0)
  })

  it('returns nothing for an id that is not in the set', () => {
    const own = [snap('a', 'e1')]
    expect(withdrawalOutcome(own, 'nope', events, chapters)).toEqual({ fallback: undefined, followers: 0 })
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
