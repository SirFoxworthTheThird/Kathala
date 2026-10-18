import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '@/db/database'
import { createTimeline, deleteTimeline, moveTimeline } from '@/db/hooks/useTimeline'
import { undoLast } from '@/db/hooks/useOperations'
import { inTimelineOrder } from '@/lib/timelineOrder'

/**
 * Timelines in the order the writer sets (`Timeline.position`): a new one goes
 * last, a move renumbers them in one undo, and a database from before v58 is
 * numbered by creation.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

const names = async (worldId: string) =>
  inTimelineOrder(await db.timelines.where('worldId').equals(worldId).toArray()).map((t) => t.name)
const make = (worldId: string, name: string) => createTimeline({ worldId, name, description: '', color: '#fff' })

describe('timeline positions', () => {
  it('puts a new timeline after the others, including ones from an older file with no position', async () => {
    // A world as a pre-v58 file imports it: no positions, in creation order Mercy, Compact.
    await db.timelines.bulkAdd([
      { id: 'b-mercy', worldId: 'w', name: 'The Mercy', description: '', color: '#fff', createdAt: 1 },
      { id: 'a-compact', worldId: 'w', name: 'The Compact', description: '', color: '#fff', createdAt: 2 },
    ])
    const quiet = await make('w', 'The Quiet')
    expect(quiet.position).toBe(2)
    expect(await names('w')).toEqual(['The Mercy', 'The Compact', 'The Quiet'])
    // …the others numbered as they stood, in the same act: one undo takes it all back.
    expect((await db.timelines.get('b-mercy'))?.position).toBe(0)
    await undoLast('w')
    expect(await names('w')).toEqual(['The Mercy', 'The Compact'])
    expect((await db.timelines.get('b-mercy'))?.position).toBeUndefined()
    // Another world's are its own.
    expect((await make('other', 'Only')).position).toBe(0)
  })

  it('never gives a new timeline a position another still holds, after a delete leaves a gap', async () => {
    const first = await make('w', 'One')
    await make('w', 'Two')
    await make('w', 'Three')
    await deleteTimeline(first.id)
    await make('w', 'Four')
    const held = (await db.timelines.where('worldId').equals('w').toArray()).map((t) => t.position)
    expect(new Set(held).size).toBe(held.length)
    expect(await names('w')).toEqual(['Two', 'Three', 'Four'])
  })

  it('moves one anywhere, and one undo puts the order back', async () => {
    await make('w', 'The Compact')
    const mercy = await make('w', 'The Mercy')
    await make('w', 'The Quiet')
    await moveTimeline(mercy.id, 0)
    expect(await names('w')).toEqual(['The Mercy', 'The Compact', 'The Quiet'])
    await undoLast('w')
    // Positions, not only the order: a tie would sort by creation and look restored.
    const positions = (await db.timelines.where('worldId').equals('w').toArray()).map((t) => [t.name, t.position])
    expect(Object.fromEntries(positions)).toEqual({ 'The Compact': 0, 'The Mercy': 1, 'The Quiet': 2 })
  })

  it('numbers a database from before v58 by creation, world by world', async () => {
    await db.close()
    await db.delete()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('KathalaDB', 52)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('timelines')) req.result.createObjectStore('timelines', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const handle = req.result
        const tx = handle.transaction('timelines', 'readwrite')
        const store = tx.objectStore('timelines')
        // Ids in the opposite order to creation, as random ids often are.
        store.put({ id: 'z-first', worldId: 'w', name: 'First', description: '', color: '#fff', createdAt: 1 })
        store.put({ id: 'm-second', worldId: 'w', name: 'Second', description: '', color: '#fff', createdAt: 2 })
        store.put({ id: 'a-third', worldId: 'w', name: 'Third', description: '', color: '#fff', createdAt: 3 })
        store.put({ id: 'b-elsewhere', worldId: 'v', name: 'Elsewhere', description: '', color: '#fff', createdAt: 9 })
        tx.oncomplete = () => { handle.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
    await db.open()
    const byId = new Map((await db.timelines.toArray()).map((t) => [t.id, t.position]))
    expect(Object.fromEntries(byId)).toEqual({ 'z-first': 0, 'm-second': 1, 'a-third': 2, 'b-elsewhere': 0 })
  })
})
