import { describe, it, expect } from 'vitest'
import { makeOperation, describeOperation, describeInverse } from '@/lib/operations'
import { recordName, needsSubjectLookup, SUBJECT_OWNER } from '@/lib/operationSubject'
import { ENTITY_TABLE } from '@/lib/entityTables'
import type { Operation, OperationEntity, OperationType } from '@/types/operation'

/**
 * N6, from a blind writer run: seventeen consecutive Recent changes rows
 * reading exactly *"Edited scene — involved characters"*, with nothing to say
 * which scene any of them was about. The store join is tested in
 * `src/db/hooks/__tests__/operationSubjects.test.ts`; this is the wording.
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

describe('recordName', () => {
  it('takes the field the record keeps its name in', () => {
    expect(recordName({ name: 'Corvin Adze' })).toBe('Corvin Adze')
    expect(recordName({ title: 'The ninth bell' })).toBe('The ninth bell')
    // A relationship is called by its label — it has no `name` at all.
    expect(recordName({ label: 'sworn to' })).toBe('sworn to')
  })

  it('prefers a name to a title, so one record cannot be called two things', () => {
    expect(recordName({ title: 'The ninth bell', name: 'Corvin Adze' })).toBe('Corvin Adze')
  })

  it('treats blank and missing and non-records alike', () => {
    expect(recordName({ name: '   ' })).toBeNull()
    expect(recordName({ tension: 7 })).toBeNull()
    expect(recordName({ name: 7 })).toBeNull()
    expect(recordName(undefined)).toBeNull()
    expect(recordName(null)).toBeNull()
  })

  it('trims, because a name typed with a trailing space is the same name', () => {
    expect(recordName({ name: '  Corvin Adze ' })).toBe('Corvin Adze')
  })
})

describe('needsSubjectLookup', () => {
  it('is false for a create and a delete, which carry the whole record', () => {
    expect(needsSubjectLookup(op('create', { title: 'The ninth bell' }))).toBe(false)
    expect(needsSubjectLookup(op('delete', { title: 'The ninth bell' }))).toBe(false)
  })

  it('is true for the update the finding was about', () => {
    // A partial update carries only what changed, so a cast edit has no title.
    expect(needsSubjectLookup(op('update', { involvedCharacterIds: ['c1'] }))).toBe(true)
  })

  it('is false for the update that happens to be a rename', () => {
    expect(needsSubjectLookup(op('update', { title: 'The ninth bell' }))).toBe(false)
  })
})

describe('describeOperation with a resolved subject', () => {
  it('names the record the store says it is, when the payload cannot', () => {
    const edit = op('update', { involvedCharacterIds: ['c1'] })
    // Without the subject: the row the reviewer saw seventeen times over.
    expect(describeOperation(edit)).toBe('Edited scene — involved characters')
    expect(describeOperation(edit, 'The ninth bell does not ring'))
      .toBe('Edited scene “The ninth bell does not ring” — involved characters')
  })

  it('keeps the operation’s own name when it has one, so a rename reads as it happened', () => {
    // The payload is what this operation did; the subject is what the record is
    // called now. For a rename they differ, and the operation wins.
    expect(describeOperation(op('update', { title: 'The ninth bell' }), 'Renamed later'))
      .toBe('Edited scene “The ninth bell” — title')
  })

  it('falls back when the lookup found nothing — a deleted record has no name', () => {
    const edit = op('update', { involvedCharacterIds: ['c1'] })
    expect(describeOperation(edit, undefined)).toBe('Edited scene — involved characters')
    expect(describeOperation(edit, null)).toBe('Edited scene — involved characters')
    expect(describeOperation(edit, '  ')).toBe('Edited scene — involved characters')
  })

  it('reaches the redo label too, which describes the same operation backwards', () => {
    const undoOfACreate = op('delete', { involvedCharacterIds: ['c1'] }, 'character')
    expect(describeInverse(undoOfACreate, 'Corvin Adze')).toBe('Added character “Corvin Adze”')
  })
})

describe('SUBJECT_OWNER', () => {
  /**
   * Every entry names a real table. A typo here would not fail anything on its
   * own — the lookup would simply return nothing, and the row would degrade to
   * the label it used to show, which is the bug rather than a symptom of it.
   */
  it('points every snapshot group at a table the journal knows', () => {
    const tables = new Set(Object.values(ENTITY_TABLE))
    for (const [entity, owners] of Object.entries(SUBJECT_OWNER)) {
      expect(owners.length, entity).toBeGreaterThan(0)
      for (const owner of owners) {
        expect(tables, `${entity} → ${owner.table}`).toContain(owner.table)
      }
    }
  })

  /**
   * And every group that needs one has one. A snapshot record holds state and
   * no name, so a new snapshot group added without an entry here would arrive
   * in the panel as an unnameable row — the exact shape of the finding.
   */
  it('covers every snapshot group on the seam', () => {
    const snapshotGroups = Object.keys(ENTITY_TABLE).filter(
      (e) => e.endsWith('Snapshot') || e === 'itemPlacement',
    )
    expect(snapshotGroups.length).toBeGreaterThan(0)
    for (const group of snapshotGroups) {
      expect(SUBJECT_OWNER, group).toHaveProperty(group)
    }
  })

  /**
   * The other half of the same finding. A snapshot is not the only kind of
   * nameless record: a knowledge reveal, a faction membership, a route and a
   * timeline link are all foreign keys and dates, and every one of them
   * arrived in Recent changes as a row indistinguishable from its neighbours.
   *
   * The list is spelled out rather than derived, because deriving it from the
   * types is exactly what nothing can do — that is why they were missed. A new
   * nameless group added without an entry fails here.
   */
  it('covers the join groups that carry no name of their own', () => {
    for (const group of [
      'knowledgeReveal', 'factionMembership', 'factionRelationship',
      'characterMovement', 'crossTimelineArtifact', 'timelineRelationship',
    ]) {
      expect(SUBJECT_OWNER, group).toHaveProperty(group)
    }
  })

  /** A pair of foreign keys needs both, or the two halves read alike. */
  it('names both ends of a group that joins two records', () => {
    for (const group of ['knowledgeReveal', 'factionMembership', 'factionRelationship', 'timelineRelationship']) {
      expect(SUBJECT_OWNER[group as keyof typeof SUBJECT_OWNER], group).toHaveLength(2)
    }
  })
})
