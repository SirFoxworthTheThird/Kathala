import { describe, it, expect } from 'vitest'
import {
  makeOperation, applyOperation, replay, invertOperation, contentFields, prunableOperations,
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

describe('prunableOperations', () => {
  const ops = [
    op({ type: 'create', seq: 1, entityId: 'c1', payload: {} }),
    op({ type: 'update', seq: 2, entityId: 'c1', payload: {} }),
    op({ type: 'create', seq: 3, entityId: 'c2', payload: {} }),
    op({ type: 'update', seq: 4, entityId: 'c1', payload: {} }),
  ]

  it('keeps everything at or above the cutoff', () => {
    expect(prunableOperations(ops, 1)).toEqual([])
  })

  it('drops old entries but keeps the newest per entity', () => {
    const doomed = prunableOperations(ops, 5).map((o) => o.seq)
    // c1's newest is 4 and c2's is 3, so only 1 and 2 are prunable.
    expect(doomed).toEqual([1, 2])
  })
})
