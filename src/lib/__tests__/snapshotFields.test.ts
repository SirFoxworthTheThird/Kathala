import { describe, it, expect } from 'vitest'
import { snapshotFieldSyncKey } from '@/lib/snapshotFields'

/**
 * W-1. The map's character panel showed a status note one edit behind, and the
 * next blur wrote it into the wrong scene. The key below is what decides when
 * the panel re-reads the record it is displaying; each part is here because
 * leaving it out reintroduces a specific failure.
 */
describe('snapshotFieldSyncKey', () => {
  const snap = (id: string, updatedAt = 1) => ({ id, updatedAt })

  it('changes when the cursor moves to a scene with its own record', () => {
    expect(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
      .not.toBe(snapshotFieldSyncKey('rhun', 'ev-b', snap('s-b')))
  })

  it('changes when the moment is the same but the record has resolved', () => {
    // The actual defect. The event id changes first and the live query answers
    // a tick later, so a key made only of the writer's choice stops changing
    // exactly when the right record finally arrives — and the panel keeps
    // showing the outgoing scene's note.
    const stillHoldingTheOldRecord = snapshotFieldSyncKey('rhun', 'ev-b', snap('s-a'))
    const onceTheQueryCatchesUp = snapshotFieldSyncKey('rhun', 'ev-b', snap('s-b'))
    expect(stillHoldingTheOldRecord).not.toBe(onceTheQueryCatchesUp)
  })

  it('changes when two scenes inherit the same record', () => {
    // The other half. Keyed on the record alone, stepping between two scenes
    // that both carry forward the same snapshot would not re-sync, so an
    // unsaved draft would follow the writer into a scene it was not meant for.
    expect(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
      .not.toBe(snapshotFieldSyncKey('rhun', 'ev-b', snap('s-a')))
  })

  it('does not change while the record sits untouched', () => {
    // Which is what stops the field being reset under the writer mid-edit —
    // the reason the panel holds its text locally at all.
    expect(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
      .toBe(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
  })

  it('changes when the same record is written to', () => {
    // The half the first version of this fix was missing, and the one the bug
    // actually turns on: type, then click straight on Next moment, and the save
    // lands while the new scene is inheriting that very record — same id, new
    // contents. Without this the key does not move and the stale text stays.
    expect(snapshotFieldSyncKey('rhun', 'ev-b', snap('s-a', 100)))
      .not.toBe(snapshotFieldSyncKey('rhun', 'ev-b', snap('s-a', 200)))
  })

  it('changes when the character changes at the same moment', () => {
    expect(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
      .not.toBe(snapshotFieldSyncKey('ysolde', 'ev-a', snap('s-a')))
  })

  it('tells "no record yet" apart from a record, and from no cursor', () => {
    const none = snapshotFieldSyncKey('rhun', 'ev-a', undefined)
    expect(none).not.toBe(snapshotFieldSyncKey('rhun', 'ev-a', snap('s-a')))
    expect(none).not.toBe(snapshotFieldSyncKey('rhun', null, undefined))
    // `null` and a record are different states too, not both "empty".
    expect(snapshotFieldSyncKey('rhun', null, null))
      .not.toBe(snapshotFieldSyncKey('rhun', null, snap('s-a')))
  })

  it('does not let the parts run together into the same key', () => {
    // Joined rather than concatenated: 'ab' + 'c' must not equal 'a' + 'bc'.
    expect(snapshotFieldSyncKey('ab', 'c', snap('d')))
      .not.toBe(snapshotFieldSyncKey('a', 'bc', snap('d')))
  })
})
