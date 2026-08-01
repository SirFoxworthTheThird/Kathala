import { describe, it, expect } from 'vitest'
import {
  makeOperation, applyOperation, replay, invertOperation, contentFields,
  planJournalPrune, operationSize,
} from '@/lib/operations'
import type { Operation } from '@/types/operation'

interface Rec { id: string; version: number; name: string; tags: string[] }

function op(over: Partial<Operation> & Pick<Operation, 'type' | 'seq'>): Operation {
  return makeOperation({
    id: over.id ?? `op-${over.seq}`,
    worldId: 'w1',
    entityType: 'character',
    entityId: over.entityId ?? 'c1',
    type: over.type,
    seq: over.seq,
    deviceId: over.deviceId ?? 'dev-a',
    baseVersion: over.baseVersion ?? 0,
    payload: over.payload ?? {},
    now: 1000 + over.seq,
  })
}

describe('contentFields', () => {
  it('ignores identity and bookkeeping fields', () => {
    expect(contentFields({ id: 'x', worldId: 'w', createdAt: 1, updatedAt: 2, version: 3, name: 'A' }))
      .toEqual(['name'])
  })

  it('sorts so the field list is stable', () => {
    expect(contentFields({ tags: [], name: 'A', isAlive: true })).toEqual(['isAlive', 'name', 'tags'])
  })
})

describe('applyOperation', () => {
  const created = op({ type: 'create', seq: 1, payload: { id: 'c1', name: 'Vela', tags: [] } })

  it('creates a record at version 1', () => {
    const next = applyOperation<Rec>(undefined, created)
    expect(next).toMatchObject({ id: 'c1', name: 'Vela', version: 1 })
  })

  it('is idempotent for create — replaying returns the record untouched', () => {
    const first = applyOperation<Rec>(undefined, created)!
    const again = applyOperation<Rec>(first, created)
    expect(again).toBe(first)
  })

  it('applies an update and bumps the version', () => {
    const start: Rec = { id: 'c1', version: 1, name: 'Vela', tags: [] }
    const next = applyOperation<Rec>(start, op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'Vela Reyn' } }))
    expect(next).toMatchObject({ name: 'Vela Reyn', version: 2 })
  })

  it('is idempotent for update — a record already past the op is left alone', () => {
    const already: Rec = { id: 'c1', version: 2, name: 'Vela Reyn', tags: [] }
    const next = applyOperation<Rec>(already, op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'Vela Reyn' } }))
    expect(next).toBe(already)
  })

  it('ignores an update to a record that is gone', () => {
    expect(applyOperation<Rec>(undefined, op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'x' } }))).toBeNull()
  })

  it('deletes', () => {
    const start: Rec = { id: 'c1', version: 3, name: 'Vela', tags: [] }
    expect(applyOperation<Rec>(start, op({ type: 'delete', seq: 4, baseVersion: 3, payload: start as never }))).toBeNull()
  })
})

describe('replay', () => {
  const ops = [
    op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'Vela Reyn' } }),
    op({ type: 'create', seq: 1, payload: { id: 'c1', name: 'Vela', tags: [] } }),
    op({ type: 'update', seq: 3, baseVersion: 2, payload: { tags: ['exile'] } }),
  ]

  it('orders by seq regardless of the order given', () => {
    const out = replay<Rec>(undefined, ops)
    expect(out).toMatchObject({ name: 'Vela Reyn', tags: ['exile'], version: 3 })
  })

  it('is idempotent — replaying the whole journal twice lands in the same place', () => {
    const once = replay<Rec>(undefined, ops)!
    const twice = replay<Rec>(once, ops)
    expect(twice).toEqual(once)
  })

  it('a delete anywhere in the journal leaves nothing behind', () => {
    const out = replay<Rec>(undefined, [...ops, op({ type: 'delete', seq: 4, baseVersion: 3, payload: {} })])
    expect(out).toBeNull()
  })
})

describe('invertOperation', () => {
  it('inverts a create into a delete', () => {
    const created = op({ type: 'create', seq: 1, payload: { id: 'c1', name: 'Vela' } })
    const undo = invertOperation(created, undefined, { id: 'undo-1', seq: 2, now: 5 })
    expect(undo).toMatchObject({ type: 'delete', entityId: 'c1', seq: 2 })
  })

  it('inverts a delete back into a create carrying the old record', () => {
    const record = { id: 'c1', name: 'Vela', tags: ['exile'] }
    const deleted = op({ type: 'delete', seq: 4, baseVersion: 3, payload: record })
    const undo = invertOperation(deleted, undefined, { id: 'undo-2', seq: 5, now: 5 })!
    expect(undo.type).toBe('create')
    expect(undo.payload).toEqual(record)
    expect(undo.baseVersion).toBe(0)
  })

  it('inverts an update to the previous values of exactly the changed fields', () => {
    const before = { id: 'c1', name: 'Vela', tags: ['exile'], isAlive: true }
    const updated = op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'Vela Reyn', isAlive: false } })
    const undo = invertOperation(updated, before, { id: 'undo-3', seq: 3, now: 5 })!
    expect(undo.type).toBe('update')
    expect(undo.payload).toEqual({ name: 'Vela', isAlive: true })
    // Untouched fields are not resurrected.
    expect(undo.payload).not.toHaveProperty('tags')
    expect(undo.changedFields).toEqual(['isAlive', 'name'])
  })

  it('applying an update and then its inverse round-trips the record', () => {
    const start: Rec = { id: 'c1', version: 1, name: 'Vela', tags: ['exile'] }
    const forward = op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'Vela Reyn' } })
    const changed = applyOperation<Rec>(start, forward)!
    const undo = invertOperation(forward, start as never, { id: 'undo-4', seq: 3, now: 5 })!
    const back = applyOperation<Rec>(changed, undo)!
    expect(back.name).toBe('Vela')
  })

  it('cannot invert an update with no prior state', () => {
    const updated = op({ type: 'update', seq: 2, baseVersion: 1, payload: { name: 'x' } })
    expect(invertOperation(updated, undefined, { id: 'u', seq: 3 })).toBeNull()
  })
})

describe('planJournalPrune', () => {
  const ops = [1, 2, 3, 4, 5].map((seq) => op({ type: 'update', seq, payload: { notes: 'x' } }))

  it('discards nothing while inside both caps', () => {
    expect(planJournalPrune(ops, { maxOperations: 10 }).discard).toEqual([])
  })

  it('keeps the newest entries and discards the oldest', () => {
    const plan = planJournalPrune(ops, { maxOperations: 2, minOperations: 1 })
    expect(plan.discard.map((o) => o.seq)).toEqual([1, 2, 3])
    expect(plan.keptCount).toBe(2)
  })

  it('returns the discard list oldest first, so a bulk delete reads in order', () => {
    const plan = planJournalPrune(ops, { maxOperations: 1, minOperations: 1 })
    expect(plan.discard.map((o) => o.seq)).toEqual([1, 2, 3, 4])
  })

  it('caps by bytes, not only by count', () => {
    // The reason a count is not a bound: one delete carrying a cascade can
    // outweigh hundreds of renames.
    const fat = op({
      type: 'delete', seq: 6,
      payload: { id: 'c1', name: 'x'.repeat(4000) },
    })
    const plan = planJournalPrune([...ops, fat], { maxOperations: 100, maxBytes: 500, minOperations: 1 })
    expect(plan.discard.length).toBeGreaterThan(0)
    expect(plan.keptBytes).toBeLessThanOrEqual(4200)
  })

  it('keeps minOperations even when they blow the byte cap', () => {
    // Otherwise a run of large entries would leave the writer unable to undo
    // the thing they just did.
    const fat = [7, 8, 9].map((seq) =>
      op({ type: 'delete', seq, payload: { id: `c${seq}`, name: 'x'.repeat(4000) } }))
    const plan = planJournalPrune(fat, { maxOperations: 100, maxBytes: 10, minOperations: 3 })
    expect(plan.discard).toEqual([])
    expect(plan.keptCount).toBe(3)
  })

  it('never keeps more than maxOperations, even below the byte cap', () => {
    const plan = planJournalPrune(ops, { maxOperations: 2, maxBytes: 10_000_000, minOperations: 5 })
    expect(plan.keptCount).toBe(2)
  })

  it('handles an empty journal', () => {
    expect(planJournalPrune([]).discard).toEqual([])
  })

  it('keeps entries a peer has not seen, past the caps', () => {
    // Discarding one of these would mean the other device never learns of the
    // change — divergence that surfaces long afterwards, with nothing left to
    // explain it.
    const plan = planJournalPrune(ops, { maxOperations: 2, minOperations: 1, retainFromSeq: 3 })
    expect(plan.discard.map((o) => o.seq)).toEqual([1, 2])
    expect(plan.keptCount).toBe(3)
    expect(plan.syncGap).toBe(false)
  })

  it('prunes as usual when every entry has been acknowledged', () => {
    const plan = planJournalPrune(ops, { maxOperations: 2, minOperations: 1, retainFromSeq: 99 })
    expect(plan.discard.map((o) => o.seq)).toEqual([1, 2, 3])
    expect(plan.syncGap).toBe(false)
  })

  it('says so when the caps force out something a peer still needed', () => {
    // The alternative is growing without bound behind a device that stopped
    // syncing months ago. Reporting the gap lets the caller declare a
    // discontinuity, which is the honest answer rather than a quiet one.
    const many = Array.from({ length: 30 }, (_, i) =>
      op({ type: 'update', seq: i + 1, payload: { notes: 'x'.repeat(500) } }))
    const plan = planJournalPrune(many, {
      maxOperations: 5, minOperations: 1, retainFromSeq: 1, maxBytes: 100,
      hardMaxOperations: 10,
    })
    // Every entry is unacknowledged, so the byte cap has to give somewhere.
    expect(plan.syncGap).toBe(true)
  })

  it('reports no gap when nothing is being retained', () => {
    expect(planJournalPrune(ops, { maxOperations: 1, minOperations: 1 }).syncGap).toBe(false)
  })
})

describe('operationSize', () => {
  it('grows with the payload it has to store', () => {
    const small = op({ type: 'update', seq: 1, payload: { notes: 'a' } })
    const large = op({ type: 'update', seq: 2, payload: { notes: 'a'.repeat(1000) } })
    expect(operationSize(large)).toBeGreaterThan(operationSize(small) + 900)
  })
})
