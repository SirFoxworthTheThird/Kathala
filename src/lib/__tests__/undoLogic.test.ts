import { describe, it, expect } from 'vitest'
import {
  COALESCE_WINDOW_MS,
  coalesceOperations,
  describeOperation,
  invertOperation,
  makeOperation,
  shouldCoalesce,
  undoableBatch,
  redoableBatch,
  describeInverse,
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
    ...(over.redoneBy ? { redoneBy: over.redoneBy } : {}),
    ...(over.redoOf ? { redoOf: over.redoOf } : {}),
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

describe('redoableBatch', () => {
  it('offers the undo sitting at the head', () => {
    const ops = [
      op({ type: 'create', seq: 1, undoneBy: 'op-2' }),
      op({ type: 'delete', seq: 2, undoOf: 'op-1' }),
    ]
    expect(redoableBatch(ops).map((o) => o.seq)).toEqual([2])
  })

  it('keeps working for a second consecutive redo', () => {
    // The first attempt required the head itself to be an undo, so after one
    // redo the head was a *redo* and the remaining undo became unreachable.
    const ops = [
      op({ type: 'update', seq: 1, undoneBy: 'op-4' }),
      op({ type: 'update', seq: 2, undoneBy: 'op-3' }),
      op({ type: 'update', seq: 3, undoOf: 'op-2', redoneBy: 'op-5' }),
      op({ type: 'update', seq: 4, undoOf: 'op-1' }),
      op({ type: 'update', seq: 5, redoOf: 'op-3' }),
    ]
    expect(redoableBatch(ops).map((o) => o.seq)).toEqual([4])
  })

  it('is cleared by a new edit', () => {
    // Putting the change back would land it on a world that has moved on.
    const ops = [
      op({ type: 'create', seq: 1, undoneBy: 'op-2' }),
      op({ type: 'delete', seq: 2, undoOf: 'op-1' }),
      op({ type: 'update', seq: 3 }),
    ]
    expect(redoableBatch(ops)).toEqual([])
  })

  it('offers nothing once every undo has been redone', () => {
    const ops = [
      op({ type: 'delete', seq: 2, undoOf: 'op-1', redoneBy: 'op-3' }),
      op({ type: 'create', seq: 3, redoOf: 'op-2' }),
    ]
    expect(redoableBatch(ops)).toEqual([])
  })

  it('offers nothing on an empty journal', () => {
    expect(redoableBatch([])).toEqual([])
  })

  it('returns the whole group when the undone act spanned several records', () => {
    const ops = [
      op({ type: 'update', seq: 3, entityId: 'e1', undoOf: 'a', groupId: 'g1' }),
      op({ type: 'update', seq: 4, entityId: 'e2', undoOf: 'b', groupId: 'g1' }),
    ]
    expect(redoableBatch(ops).map((o) => o.seq)).toEqual([4, 3])
  })
})

describe('invertOperation, for redo', () => {
  it('gives the inverse its own before-image, so it can be inverted again', () => {
    // Without this the undo carried no `previous`, so redoing an edit found
    // nothing to restore and silently did nothing.
    const original = op({
      type: 'update', seq: 1, payload: { notes: 'after' }, previous: { notes: 'before' },
    })
    const undone = invertOperation(original, undefined, { id: 'u', seq: 2 })!
    expect(undone.payload).toEqual({ notes: 'before' })
    expect(undone.previous).toEqual({ notes: 'after' })

    const redone = invertOperation(undone, undefined, { id: 'r', seq: 3, as: 'redo' })!
    expect(redone.payload).toEqual({ notes: 'after' })
  })

  it('carries the cascade onto a restoring create', () => {
    // So redoing the delete removes what the delete originally swept up,
    // instead of orphaning it.
    const deletion: Operation = {
      ...op({ type: 'delete', seq: 1, payload: { id: 'c1', name: 'Aldric' } }),
      cascade: { characterGoals: [{ id: 'g1' }] },
    }
    const restored = invertOperation(deletion, undefined, { id: 'u', seq: 2 })!
    expect(restored.type).toBe('create')
    expect(restored.cascade).toEqual({ characterGoals: [{ id: 'g1' }] })
  })

  it('marks a redo differently from an undo, so the redo stays undoable', () => {
    const original = op({ type: 'create', seq: 1, payload: { name: 'X' } })
    const undone = invertOperation(original, undefined, { id: 'u', seq: 2 })!
    const redone = invertOperation(undone, undefined, { id: 'r', seq: 3, as: 'redo' })!

    expect(undone.undoOf).toBe(original.id)
    expect(redone.redoOf).toBe(undone.id)
    expect(redone.undoOf).toBeUndefined()
    // The redo is a live change with nothing else accounting for it.
    expect(undoableBatch([original, undone, redone]).map((o) => o.id)).toEqual(['r'])
  })
})

describe('describeInverse', () => {
  it('flips the verb, so a redo label says what it will do', () => {
    const undoOfACreate = op({ type: 'delete', seq: 1, entityType: 'character', payload: { name: 'Aldric' } })
    expect(describeInverse(undoOfACreate)).toBe('Added character “Aldric”')
  })
})
