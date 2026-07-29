import { describe, it, expect } from 'vitest'
import {
  COALESCE_WINDOW_MS,
  coalesceOperations,
  describeOperation,
  invertOperation,
  makeOperation,
  shouldCoalesce,
  undoableBatch,
} from '@/lib/operations'
import type { Operation } from '@/types/operation'

function op(over: Partial<Operation> & Pick<Operation, 'type' | 'seq'>): Operation {
  return {
    ...makeOperation({
      id: over.id ?? `op-${over.seq}`,
      worldId: 'w1',
      entityType: over.entityType ?? 'chapter',
      entityId: over.entityId ?? 'ch1',
      type: over.type,
      seq: over.seq,
      deviceId: over.deviceId ?? 'dev-a',
      baseVersion: over.baseVersion ?? 1,
      payload: over.payload ?? { notes: 'a' },
      previous: over.previous,
      groupId: over.groupId,
      undoOf: over.undoOf,
      now: over.createdAt ?? 10_000,
    }),
    ...(over.undoneBy ? { undoneBy: over.undoneBy } : {}),
  }
}

describe('makeOperation previous', () => {
  it('keeps only the fields the update touched', () => {
    // A full before-image would balloon the journal; undo only needs to put
    // back what the edit changed.
    const o = op({
      type: 'update',
      seq: 1,
      payload: { notes: 'new' },
      previous: { notes: 'old', name: 'untouched', id: 'ch1' },
    })
    expect(o.previous).toEqual({ notes: 'old' })
  })

  it('is absent on creates and deletes', () => {
    expect(op({ type: 'create', seq: 1, previous: { a: 1 } }).previous).toBeUndefined()
    expect(op({ type: 'delete', seq: 1, previous: { a: 1 } }).previous).toBeUndefined()
  })
})

describe('shouldCoalesce', () => {
  const prev = op({ type: 'update', seq: 1, payload: { notes: 'a' }, createdAt: 10_000 })
  const next = { entityType: 'chapter' as const, entityId: 'ch1', deviceId: 'dev-a', type: 'update' as const, payload: { notes: 'ab' } }

  it('folds a continuing edit to the same field', () => {
    expect(shouldCoalesce(prev, next, 10_600)).toBe(true)
  })

  it('does not fold once the window has passed', () => {
    expect(shouldCoalesce(prev, next, 10_000 + COALESCE_WINDOW_MS + 1)).toBe(false)
  })

  it('does not fold a different field', () => {
    expect(shouldCoalesce(prev, { ...next, payload: { title: 'x' } }, 10_600)).toBe(false)
  })

  it('does not fold a different entity', () => {
    expect(shouldCoalesce(prev, { ...next, entityId: 'ch2' }, 10_600)).toBe(false)
  })

  it('does not fold across devices', () => {
    expect(shouldCoalesce(prev, { ...next, deviceId: 'dev-b' }, 10_600)).toBe(false)
  })

  it('does not fold a create or a delete', () => {
    expect(shouldCoalesce(op({ type: 'create', seq: 1 }), next, 10_600)).toBe(false)
    expect(shouldCoalesce(prev, { ...next, type: 'delete' }, 10_600)).toBe(false)
  })

  it('does not fold into an undo, or into something already undone', () => {
    expect(shouldCoalesce(op({ type: 'update', seq: 1, undoOf: 'x' }), next, 10_600)).toBe(false)
    expect(shouldCoalesce(op({ type: 'update', seq: 1, undoneBy: 'x' }), next, 10_600)).toBe(false)
  })

  it('does not fold an operation that belongs to a group', () => {
    // A grouped act is already one undo step; folding would blur two acts.
    expect(shouldCoalesce(op({ type: 'update', seq: 1, groupId: 'g1' }), next, 10_600)).toBe(false)
  })

  it('has nothing to fold into on an empty journal', () => {
    expect(shouldCoalesce(undefined, next, 10_600)).toBe(false)
  })
})

describe('coalesceOperations', () => {
  it('keeps the original seq, baseVersion and before-image', () => {
    // Undo has to restore the state from before the burst, not before its last
    // keystroke — otherwise undoing a paragraph leaves most of it behind.
    const first = op({
      type: 'update', seq: 4, payload: { notes: 'a' },
      previous: { notes: '' }, baseVersion: 2, createdAt: 10_000,
    })
    const later = op({ type: 'update', seq: 9, payload: { notes: 'abc' }, baseVersion: 7, createdAt: 12_000 })
    const merged = coalesceOperations(first, later)

    expect(merged.id).toBe(first.id)
    expect(merged.seq).toBe(4)
    expect(merged.baseVersion).toBe(2)
    expect(merged.previous).toEqual({ notes: '' })
    expect(merged.payload.notes).toBe('abc')
    expect(merged.createdAt).toBe(12_000)
  })
})

describe('invertOperation', () => {
  it('uses the operation\'s own before-image when no record is supplied', () => {
    const o = op({ type: 'update', seq: 3, payload: { notes: 'new' }, previous: { notes: 'old' } })
    const inv = invertOperation(o, undefined, { id: 'inv', seq: 4 })
    expect(inv?.payload).toEqual({ notes: 'old' })
  })

  it('marks the inverse so it never appears in the undo stack', () => {
    const o = op({ type: 'update', seq: 3, payload: { notes: 'new' }, previous: { notes: 'old' } })
    expect(invertOperation(o, undefined, { id: 'inv', seq: 4 })?.undoOf).toBe(o.id)
  })

  it('returns null for an update with no before-image at all', () => {
    const o = op({ type: 'update', seq: 3, payload: { notes: 'new' } })
    expect(invertOperation(o, undefined, { id: 'inv', seq: 4 })).toBeNull()
  })

  it('carries a group id onto the inverse', () => {
    const o = op({ type: 'delete', seq: 3, payload: { id: 'ch1' } })
    expect(invertOperation(o, undefined, { id: 'inv', seq: 4, groupId: 'g9' })?.groupId).toBe('g9')
  })
})

describe('undoableBatch', () => {
  it('takes the newest operation', () => {
    const ops = [op({ type: 'update', seq: 1 }), op({ type: 'update', seq: 2 })]
    expect(undoableBatch(ops).map((o) => o.seq)).toEqual([2])
  })

  it('skips operations that have already been undone', () => {
    const ops = [
      op({ type: 'update', seq: 1 }),
      op({ type: 'update', seq: 2, undoneBy: 'op-3' }),
    ]
    expect(undoableBatch(ops).map((o) => o.seq)).toEqual([1])
  })

  it('skips undos themselves, so pressing undo twice walks back twice', () => {
    // Without this, the second undo would take back the first and the user
    // would toggle one change on and off forever.
    const ops = [
      op({ type: 'update', seq: 1 }),
      op({ type: 'update', seq: 2, undoneBy: 'op-3' }),
      op({ type: 'update', seq: 3, undoOf: 'op-2' }),
    ]
    expect(undoableBatch(ops).map((o) => o.seq)).toEqual([1])
  })

  it('returns the whole group for a multi-record act', () => {
    const ops = [
      op({ type: 'update', seq: 1 }),
      op({ type: 'update', seq: 2, entityId: 'e1', groupId: 'g1' }),
      op({ type: 'update', seq: 3, entityId: 'e2', groupId: 'g1' }),
    ]
    expect(undoableBatch(ops).map((o) => o.seq)).toEqual([3, 2])
  })

  it('is empty when everything has been undone', () => {
    expect(undoableBatch([op({ type: 'update', seq: 1, undoneBy: 'x' })])).toEqual([])
  })

  it('is empty for an empty journal', () => {
    expect(undoableBatch([])).toEqual([])
  })
})

describe('describeOperation', () => {
  it('names the entity when the payload carries one', () => {
    expect(describeOperation(op({ type: 'delete', seq: 1, entityType: 'character', payload: { name: 'Aldric' } })))
      .toBe('Deleted character “Aldric”')
  })

  it('falls back to a title', () => {
    expect(describeOperation(op({ type: 'update', seq: 1, entityType: 'lorePage', payload: { title: 'Gods' } })))
      .toBe('Edited lore page “Gods”')
  })

  it('copes with a nameless record', () => {
    expect(describeOperation(op({ type: 'create', seq: 1, entityType: 'characterSnapshot', payload: {} })))
      .toBe('Added character state')
  })
})
