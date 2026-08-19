import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db/database'

/**
 * `preferences` was declared in v1 and never read or written.
 *
 * It held an `AppPreferences` record with `theme: 'dark' | 'light'` — an
 * intention nobody built, and one that became actively misleading once Paper
 * shipped as a real light theme: a reader of `database.ts` would reasonably
 * conclude the app has a light/dark mode somewhere in it.
 *
 * v54 drops the store. What is worth testing is not that the line is gone —
 * that is visible in the diff — but that **a database created before the drop
 * still opens**, because the whole hazard of deleting a store is the upgrade
 * path for people who already have one.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterAll(async () => {
  await db.delete()
})

describe('the preferences store', () => {
  it('is not among the tables a fresh database opens with', () => {
    const names = db.tables.map((t) => t.name)
    expect(names).not.toContain('preferences')
    // The presence half: this is a database with tables, not an empty handle.
    expect(names).toContain('worlds')
    expect(names).toContain('events')
  })

  it('and a database that predates the drop still upgrades, carrying its data', async () => {
    await db.delete()

    // Stand up an old database by hand: v1's shape, with a row in the store
    // that is about to be removed and a world that must survive.
    const old = new Dexie('PlotWeaveDB')
    old.version(1).stores({ worlds: 'id, name, createdAt', preferences: 'id' })
    await old.open()
    await old.table('preferences').put({ id: 1, theme: 'dark', activeWorldId: null })
    await old.table('worlds').put({ id: 'w1', name: 'Kept', createdAt: 1 })
    old.close()

    // Opening the real database walks 1 → 54, which includes the delete.
    await db.open()
    expect(db.verno).toBe(54)
    expect(db.tables.map((t) => t.name)).not.toContain('preferences')

    // The upgrade is a deletion of one store, not a reset of the database.
    const world = await db.worlds.get('w1')
    expect(world?.name).toBe('Kept')
  })
})
