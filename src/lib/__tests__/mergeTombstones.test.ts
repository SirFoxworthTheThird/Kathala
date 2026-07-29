import { describe, it, expect } from 'vitest'
import { applyTombstones, mergeTombstoneSets, pruneStaleTombstones, TOMBSTONE_TABLE } from '@/lib/mergeTombstones'
import type { Tombstone } from '@/types/operation'

function stone(entityId: string, deletedAt: number, entityType: Tombstone['entityType'] = 'character'): Tombstone {
  return {
    id: `t-${entityId}-${deletedAt}`,
    worldId: 'w1',
    entityType,
    entityId,
    version: 1,
    deviceId: 'dev-a',
    deletedAt,
  }
}

describe('TOMBSTONE_TABLE', () => {
  it('maps every journalled entity group to an export array', () => {
    // A missing entry would silently mean "this entity's deletions never merge".
    for (const [entity, table] of Object.entries(TOMBSTONE_TABLE)) {
      expect(table, entity).toBeTruthy()
    }
    expect(TOMBSTONE_TABLE.location).toBe('locationMarkers')
    expect(TOMBSTONE_TABLE.character).toBe('characters')
  })
})

describe('applyTombstones', () => {
  const records = [
    { id: 'a', updatedAt: 100 },
    { id: 'b', updatedAt: 100 },
    { id: 'c', updatedAt: 100 },
  ]

  it('leaves records alone when nothing was deleted', () => {
    const out = applyTombstones(records, [], 'characters')
    expect(out.kept).toBe(records)
    expect(out.removed).toEqual([])
  })

  it('drops a record the other device deleted', () => {
    const out = applyTombstones(records, [stone('b', 200)], 'characters')
    expect(out.kept.map((r) => r.id)).toEqual(['a', 'c'])
    expect(out.removed).toEqual(['b'])
  })

  it('ignores tombstones for a different table', () => {
    const out = applyTombstones(records, [stone('b', 200, 'item')], 'characters')
    expect(out.kept.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps a record edited after the deletion, and reports it', () => {
    // Delete-versus-edit. Keeping is recoverable; discarding later work is not.
    const out = applyTombstones([{ id: 'b', updatedAt: 500 }], [stone('b', 200)], 'characters')
    expect(out.kept.map((r) => r.id)).toEqual(['b'])
    expect(out.revived).toEqual(['b'])
    expect(out.removed).toEqual([])
  })

  it('treats a record with no updatedAt as older than any deletion', () => {
    const out = applyTombstones([{ id: 'b' }], [stone('b', 200)], 'characters')
    expect(out.removed).toEqual(['b'])
  })

  it('uses the latest tombstone when an entity has several', () => {
    // Deleted, re-created, deleted again on the other device.
    const out = applyTombstones([{ id: 'b', updatedAt: 300 }], [stone('b', 200), stone('b', 400)], 'characters')
    expect(out.removed).toEqual(['b'])
  })
})

describe('mergeTombstoneSets', () => {
  it('keeps deletions from both sides', () => {
    const merged = mergeTombstoneSets([stone('a', 100)], [stone('b', 200)])
    expect(merged.map((t) => t.entityId).sort()).toEqual(['a', 'b'])
  })

  it('collapses duplicates to the latest deletion', () => {
    const merged = mergeTombstoneSets([stone('a', 100)], [stone('a', 300)])
    expect(merged).toHaveLength(1)
    expect(merged[0].deletedAt).toBe(300)
  })

  it('does not confuse the same id in different entity groups', () => {
    const merged = mergeTombstoneSets([stone('x', 100, 'character')], [stone('x', 100, 'item')])
    expect(merged).toHaveLength(2)
  })
})

describe('pruneStaleTombstones', () => {
  it('drops headstones for entities that exist again', () => {
    const out = pruneStaleTombstones([stone('a', 100), stone('b', 100)], new Set(['a']))
    expect(out.map((t) => t.entityId)).toEqual(['b'])
  })

  it('is a no-op when nothing was revived', () => {
    const stones = [stone('a', 100)]
    expect(pruneStaleTombstones(stones, new Set())).toHaveLength(1)
  })
})
