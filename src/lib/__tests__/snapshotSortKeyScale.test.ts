import { describe, it, expect } from 'vitest'
import { resolveSnapshot, selectBestSnapshots } from '../snapshotUtils'

/**
 * A snapshot's position was read from its **stored** `sortKey` and compared
 * against a **freshly computed** position for the cursor. That only holds while
 * every writer of a `sortKey` agrees with the current formula, and the shipped
 * library does not: fourteen of the twenty `.pwk` files carry keys on the
 * pre-v7 scale (`chapter + sortOrder / 1_000`) while the code computes
 * `chapter + sortOrder / 1_000_000`.
 *
 * The two orderings are identical among themselves, so nothing looked wrong —
 * but compared against each other, `1.001 > 1.000001`, so a snapshot was ruled
 * out as "after the cursor" while the cursor sat on the very event it was
 * authored on. Measured on the Fellowship export: **396 of 533** character
 * snapshots, which is why so much of that world's state read as an earlier
 * chapter's.
 */
const EVENTS = [
  { id: 'e0', chapterId: 'ch1', sortOrder: 0 },
  { id: 'e1', chapterId: 'ch1', sortOrder: 1 },
  { id: 'e2', chapterId: 'ch1', sortOrder: 2 },
]
const CHAPTERS = [{ id: 'ch1', number: 1 }]

/** A key on the pre-v7 scale, as the shipped worlds carry. */
const legacyKey = (sortOrder: number) => 1 + sortOrder / 1_000

const snap = (id: string, eventId: string, sortKey: number) => ({
  id, eventId, sortKey, characterId: 'c1', updatedAt: 0,
})

describe('snapshot resolution ignores a stored key on another scale', () => {
  it('resolves a snapshot at the very event it was authored on', () => {
    const all = [snap('s1', 'e1', legacyKey(1))]
    expect(resolveSnapshot(all, 'e1', EVENTS, CHAPTERS)?.id).toBe('s1')
  })

  it('still prefers the latest snapshot at or before the cursor', () => {
    const all = [
      snap('early', 'e0', legacyKey(0)),
      snap('late', 'e2', legacyKey(2)),
    ]
    expect(resolveSnapshot(all, 'e1', EVENTS, CHAPTERS)?.id).toBe('early')
    expect(resolveSnapshot(all, 'e2', EVENTS, CHAPTERS)?.id).toBe('late')
  })

  it('does the same for the per-entity selection the map and grid use', () => {
    const all = [
      snap('a', 'e1', legacyKey(1)),
      { ...snap('b', 'e1', legacyKey(1)), characterId: 'c2' },
    ]
    const got = selectBestSnapshots(all, 'e1', EVENTS, CHAPTERS, (s) => s.characterId)
    expect(got.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('is unchanged for records whose stored key is on the current scale', () => {
    const current = (sortOrder: number) => 1 + sortOrder / 1_000_000
    const all = [snap('s1', 'e1', current(1)), snap('s2', 'e2', current(2))]
    expect(resolveSnapshot(all, 'e1', EVENTS, CHAPTERS)?.id).toBe('s1')
    expect(resolveSnapshot(all, 'e2', EVENTS, CHAPTERS)?.id).toBe('s2')
  })

  it('falls back to the stored key for a snapshot whose event is gone', () => {
    // Orphans are real — the continuity checker has a check for them — and an
    // orphan has no position to compute, so the stored key is all there is.
    // Keeping that path is what makes this a fix to the comparison rather than
    // a change to which records resolve.
    const all = [{ id: 'orphan', eventId: 'deleted', sortKey: 1.0, characterId: 'c1', updatedAt: 0 }]
    expect(resolveSnapshot(all, 'e2', EVENTS, CHAPTERS)?.id).toBe('orphan')
  })

  it('still resolves records that carry no stored key at all', () => {
    const all = [{ id: 's1', eventId: 'e1', characterId: 'c1', updatedAt: 0 }]
    expect(resolveSnapshot(all, 'e1', EVENTS, CHAPTERS)?.id).toBe('s1')
  })
})
