import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createHeaderItem } from '@/db/hooks/useItems'

/** An item made from the header note: made once, whatever its case, and an item already there is that item. */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.items.add({ id: 'ledger', worldId: 'w', name: 'Ash Ledger', description: '', iconType: 'misc', tags: [], imageId: null })
  await db.items.add({ id: 'elsewhere', worldId: 'other', name: 'Brass Bell', description: '', iconType: 'misc', tags: [], imageId: null })
})
afterAll(async () => { await db.delete() })

describe('an item made from the header note', () => {
  it('is made once, in this world, under the name as typed', async () => {
    // Another world's Brass Bell is not this one's.
    const a = await createHeaderItem('w', ' Brass Bell ')
    expect(a).not.toBe('elsewhere')
    expect(await db.items.get(a)).toMatchObject({ worldId: 'w', name: 'Brass Bell', iconType: 'misc' })
    expect(await createHeaderItem('w', 'brass bell')).toBe(a)
    expect(await createHeaderItem('w', 'ASH LEDGER')).toBe('ledger')
    expect(await db.items.where('worldId').equals('w').count()).toBe(2)
    // Journalled, as any item made by hand is.
    expect((await db.operations.toArray()).map((o) => o.entityType)).toEqual(['item'])
  })
})
