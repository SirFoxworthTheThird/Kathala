import { describe, it, expect } from 'vitest'
import { makeOperation, describeOperation, describeInverse, describeChangedFields, fieldLabel, invertOperation } from '@/lib/operations'
import type { Operation, OperationEntity, OperationType } from '@/types/operation'

/**
 * HB-6, from an outside review: *Recent Changes is too generic.* Every edit
 * read "Edited scene", whatever it was.
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
    "scene", not "event". The app used to say both for the same thing; it now
    says scene throughout, and `ENTITY_LABEL` is the word the UI speaks rather
    than the table it is stored in — `ENTITY_TABLE` still says `events`, and a
    rename that moved both pointed undo at a table that does not exist.
  */
  it('names the field an edit changed', () => {
    // The case the review filed: an edit carrying no name or title at all.
    expect(describeOperation(op('update', { tension: 7 }))).toBe('Edited scene — tension')
  })

  it('names the record and the field together when it can', () => {
    expect(describeOperation(op('update', { title: 'The gate opens', tension: 7 })))
      .toBe('Edited scene “The gate opens” — tension and title')
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
    expect(describeOperation(created)).toBe('Added scene “The gate opens”')

    const deleted = op('delete', { title: 'The gate opens', tension: 7 })
    expect(deleted.changedFields).toEqual([])
    expect(describeOperation(deleted)).toBe('Deleted scene “The gate opens”')
  })

  it('reads an operation written before the field existed', () => {
    // Journals predating `changedFields` are still in people's browsers.
    const legacy = { ...op('update', { tension: 7 }) }
    delete (legacy as { changedFields?: string[] }).changedFields
    expect(describeOperation(legacy)).toBe('Edited scene')
  })

  it('ignores bookkeeping fields, which are not something anyone edited', () => {
    // `updatedAt` rides along on every write; naming it would make every row
    // read the same again, which is the finding.
    expect(describeOperation(op('update', { tension: 7, updatedAt: 5, version: 2 })))
      .toBe('Edited scene — tension')
  })
})

describe('a writer run’s undo labels', () => {
  it('says a character’s state in the words the form uses', () => {
    // "current location marker and 8 more", read off the undo button.
    expect(fieldLabel('currentLocationMarkerId')).toBe('place')
    expect(fieldLabel('locationMarkerId')).toBe('setting')
    expect(fieldLabel('involvedCharacterIds')).toBe('cast')
    expect(fieldLabel('inventoryItemIds')).toBe('items held')
  })

  it('does not count what only followed another change', () => {
    expect(describeChangedFields(['currentLocationMarkerId', 'currentMapLayerId', 'sortKey'])).toBe('place')
    // Paired: a field the writer did change is still counted.
    expect(describeChangedFields(['currentLocationMarkerId', 'statusNotes'])).toBe('place and status notes')
  })

  it('names an act of several writes as the act, and its undo and redo the same', () => {
    const joined = makeOperation({
      id: 'op-9', worldId: 'w1', entityType: 'event', entityId: 'e1', type: 'update',
      seq: 9, deviceId: 'd1', baseVersion: 1, payload: { description: 'x', inWorldTime: 3 }, now: 0,
      groupId: 'g1', groupLabel: 'Joined “Rain” into “Opening”',
    })
    expect(describeOperation(joined)).toBe('Joined “Rain” into “Opening”')
    const undone = invertOperation(joined, { description: 'y', inWorldTime: 2 }, { id: 'u1', seq: 10, groupId: 'g2' })!
    expect(describeInverse(undone)).toBe('Joined “Rain” into “Opening”')
    // Paired: the same write without a label is described by its fields, as before.
    expect(describeOperation({ ...joined, groupLabel: undefined })).toBe('Edited scene — description and date')
  })
})

/*
  UX-3-16: a form saves every field it holds. Renaming Quincey's knife read
  "Edited item 'Bowie Knife' — description, icon type and 3 more": the name
  had changed, and the collective and stays-in-era boxes had gone from unset
  to unticked. Where the operation has its before-image, only what differs is
  named.
*/
describe('describeOperation names only the fields that differ', () => {
  const saved = (previous: Record<string, unknown>, payload: Record<string, unknown>) => makeOperation({
    id: 'op-1', worldId: 'w1', entityType: 'item', entityId: 'i1', type: 'update',
    seq: 1, deviceId: 'd1', baseVersion: 1, payload, previous, now: 0,
  })
  const form = { name: 'Bowie Knife', description: 'Quincey’s.', iconType: 'weapon', isCollective: false, staysInEra: false }

  it('the name changed, the rest saved as it was: the name alone', () => {
    const op = saved({ name: 'Knife', description: 'Quincey’s.', iconType: 'weapon' }, form)
    expect(describeOperation(op)).toBe('Edited item “Bowie Knife” — name')
    // Undo still restores the whole form: nothing of it is dropped.
    expect(op.changedFields).toEqual(['description', 'iconType', 'isCollective', 'name', 'staysInEra'])
  })

  it('a box ticked from unset is a change; and nothing changed at all says no fields', () => {
    expect(describeOperation(saved({ name: 'Bowie Knife', description: 'Quincey’s.', iconType: 'weapon' }, { ...form, isCollective: true }))).toBe('Edited item “Bowie Knife” — is collective')
    expect(describeOperation(saved({ ...form }, form))).toBe('Edited item “Bowie Knife”')
  })

  it('a place said nowhere (null) where none was said is a change: null is not unset', () => {
    expect(describeOperation(saved({ statusNotes: '' }, { statusNotes: undefined, currentLocationMarkerId: null }))).toBe('Edited item — place')
  })

  it('an operation with no before-image names what it carries, as before', () => {
    expect(describeOperation(op('update', { name: 'Bowie Knife', description: 'x' }, 'item'))).toBe('Edited item “Bowie Knife” — description and name')
  })
})
