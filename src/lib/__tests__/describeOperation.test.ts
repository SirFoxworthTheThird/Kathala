import { describe, it, expect } from 'vitest'
import { makeOperation, describeOperation, describeChangedFields, fieldLabel } from '@/lib/operations'
import type { Operation, OperationEntity, OperationType } from '@/types/operation'

/**
 * HB-6, from an outside review: *Recent Changes is too generic.* Every edit
 * read "Edited event", whatever it was.
 *
 * The data was already there — `makeOperation` has filled `changedFields` from
 * the payload all along, and nothing read it. These tests are about the line a
 * writer sees in the panel, which is the only place any of this shows up.
 */

function op(
  type: OperationType,
  payload: Record<string, unknown>,
  entityType: OperationEntity = 'event',
): Operation {
  return makeOperation({
    id: 'op-1', worldId: 'w1', entityType, entityId: 'e1', type,
    seq: 1, deviceId: 'd1', baseVersion: 1, payload, now: 0,
  })
}

describe('fieldLabel', () => {
  it('says a camelCase field the way a writer would', () => {
    expect(fieldLabel('statusNotes')).toBe('status notes')
    expect(fieldLabel('synopsis')).toBe('synopsis')
  })

  it('drops the id, because the id is how it is stored not what changed', () => {
    expect(fieldLabel('imageId')).toBe('image')
    expect(fieldLabel('threadIds')).toBe('threads')
  })

  it('overrides the ones that de-camelise into nonsense', () => {
    // "pov character" and "in world time" are not what anyone calls these.
    expect(fieldLabel('povCharacterId')).toBe('point of view')
    expect(fieldLabel('inWorldTime')).toBe('date')
    expect(fieldLabel('isAlive')).toBe('alive or dead')
  })
})

describe('describeChangedFields', () => {
  it('says nothing when the operation records nothing', () => {
    expect(describeChangedFields([])).toBeNull()
  })

  it('names one, and joins two', () => {
    expect(describeChangedFields(['tension'])).toBe('tension')
    expect(describeChangedFields(['tension', 'synopsis'])).toBe('tension and synopsis')
  })

  it('cuts a long list off rather than listing a whole form', () => {
    // A row is one line; the point is telling one edit from the next.
    expect(describeChangedFields(['tension', 'synopsis', 'title', 'status']))
      .toBe('tension, synopsis and 2 more')
  })
})

describe('describeOperation', () => {
  /*
    `ENTITY_LABEL` says "event" where most of the app says "scene". That is a
    real inconsistency and it is *not* fixed here: it is one word in a shared
    label map that toasts and tests also read, so it is worth doing on purpose
    rather than as a side effect of this. Asserted as it is, not as it ought
    to be.
  */
  it('names the field an edit changed', () => {
    // The case the review filed: an edit carrying no name or title at all.
    expect(describeOperation(op('update', { tension: 7 }))).toBe('Edited event — tension')
  })

  it('names the record and the field together when it can', () => {
    expect(describeOperation(op('update', { title: 'The gate opens', tension: 7 })))
      .toBe('Edited event “The gate opens” — tension and title')
  })

  /**
   * The pair to the two above, and the reason asserted next to the result.
   *
   * A create and a delete are about the whole record, so listing its fields
   * would say nothing. `describeOperation` has no test on `op.type` to make
   * that happen — `makeOperation` simply records no `changedFields` for them.
   * A guard there survived every mutation precisely because it was unreachable,
   * so it was removed and the contract it leaned on is checked here instead.
   */
  it('leaves a create and a delete as they were', () => {
    const created = op('create', { title: 'The gate opens', tension: 7 })
    expect(created.changedFields).toEqual([])
    expect(describeOperation(created)).toBe('Added event “The gate opens”')

    const deleted = op('delete', { title: 'The gate opens', tension: 7 })
    expect(deleted.changedFields).toEqual([])
    expect(describeOperation(deleted)).toBe('Deleted event “The gate opens”')
  })

  it('reads an operation written before the field existed', () => {
    // Journals predating `changedFields` are still in people's browsers.
    const legacy = { ...op('update', { tension: 7 }) }
    delete (legacy as { changedFields?: string[] }).changedFields
    expect(describeOperation(legacy)).toBe('Edited event')
  })

  it('ignores bookkeeping fields, which are not something anyone edited', () => {
    // `updatedAt` rides along on every write; naming it would make every row
    // read the same again, which is the finding.
    expect(describeOperation(op('update', { tension: 7, updatedAt: 5, version: 2 })))
      .toBe('Edited event — tension')
  })
})
