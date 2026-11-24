import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createWorld } from '@/db/hooks/useWorlds'
import { createItem, updateItem } from '@/db/hooks/useItems'
import { listOperations, pendingUndo, undoLast } from '@/db/hooks/useOperations'
import { describeOperation } from '@/lib/operations'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

/*
  UX-3-16, through the real write: the item form saves every field it holds,
  and Recent changes and the Undo label named all of them.
*/
describe('an item saved from its form, with only the name changed', () => {
  it('is said as a change of name, and Undo still puts the name back', async () => {
    const world = await createWorld({ name: 'Harker', description: '' })
    const item = await createItem({ worldId: world.id, name: 'Knife', description: 'Quincey’s.', iconType: 'weapon', tags: [] })
    // As ItemDetailView saves it: the whole form.
    await updateItem(item.id, { name: 'Bowie Knife', description: 'Quincey’s.', iconType: 'weapon', tags: [], isCollective: false, staysInEra: false })

    const [latest] = (await listOperations(world.id)).slice(-1)
    expect(describeOperation(latest)).toBe('Edited item “Bowie Knife” — name')
    const undo = await pendingUndo(world.id)
    expect(undo.map((op) => describeOperation(op))).toContain('Edited item “Bowie Knife” — name')

    await undoLast(world.id)
    expect((await db.items.get(item.id))?.name).toBe('Knife')
  })
})
