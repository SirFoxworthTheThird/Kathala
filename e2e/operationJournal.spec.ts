import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

// The operation journal (#115) in a real browser: the v52 migration against a
// genuine IndexedDB, and the guarantee that a mutation is committed locally
// before anything else happens. The maths is unit-tested in
// src/lib/__tests__/operations.test.ts.

test.describe('Operation journal', () => {
  test.describe.configure({ timeout: 90_000 })

  const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

  test('journals character writes and survives a reload', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Journal World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /characters/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Vela')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Vela')).toBeVisible()

    const afterCreate = await page.evaluate(async () => {
      const db = (window as { __pwdb?: any }).__pwdb
      const ops = await db.operations.toArray()
      const chars = await db.characters.toArray()
      return {
        types: ops.map((o: { type: string }) => o.type),
        seqs: ops.map((o: { seq: number }) => o.seq),
        deviceIds: [...new Set(ops.map((o: { deviceId: string }) => o.deviceId))],
        version: chars[0]?.version,
      }
    })
    expect(afterCreate.types).toEqual(['create'])
    expect(afterCreate.seqs).toEqual([1])
    expect(afterCreate.deviceIds).toHaveLength(1)
    expect(afterCreate.version).toBe(1)

    // A reload must not lose the journal — it is durable local state, not
    // something held in memory pending a network round-trip.
    await page.reload()
    await settle(page)
    const afterReload = await page.evaluate(async () => {
      const db = (window as { __pwdb?: any }).__pwdb
      return (await db.operations.toArray()).length
    })
    expect(afterReload).toBe(1)

    // The device id is stable across reloads.
    const deviceId = await page.evaluate(() => localStorage.getItem('plotweave-device-id'))
    expect(deviceId).toBeTruthy()
  })

  test('migrates a pre-v52 world without touching its data', async ({ page }) => {
    await resetDB(page)

    // Build a v51-shaped database by hand: no operations/tombstones stores, and
    // a character with no version — exactly what an existing install looks like.
    const seeded = await page.evaluate(async () => {
      const anyWin = window as { __pwdb?: any }
      await anyWin.__pwdb.close()
      await new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('PlotWeaveDB')
        del.onsuccess = () => resolve()
        del.onerror = () => reject(del.error)
        del.onblocked = () => resolve()
      })
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB', 51)
        req.onupgradeneeded = () => {
          const idb = req.result
          idb.createObjectStore('worlds', { keyPath: 'id' })
          const chars = idb.createObjectStore('characters', { keyPath: 'id' })
          chars.createIndex('worldId', 'worldId')
        }
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(['worlds', 'characters'], 'readwrite')
          tx.objectStore('worlds').put({
            id: 'w-old', name: 'Legacy World', description: '', coverImageId: null,
            theme: null, continuityStaleThreshold: 5, createdAt: 1, updatedAt: 1,
          })
          tx.objectStore('characters').put({
            id: 'c-old', worldId: 'w-old', name: 'Prior Vela', aliases: [], description: 'from before',
            portraitImageId: null, tags: ['legacy'], isAlive: true, color: null, birthDate: null,
            createdAt: 1, updatedAt: 1,
            // deliberately no `version`
          })
          tx.oncomplete = () => { idb.close(); resolve('ok') }
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    })
    expect(seeded).toBe('ok')

    // Reload so the app opens the legacy database and runs the v52 upgrade.
    await page.reload()
    await settle(page)

    const migrated = await page.evaluate(async () => {
      const db = (window as { __pwdb?: any }).__pwdb
      const char = await db.characters.get('c-old')
      return {
        name: char?.name,
        tags: char?.tags,
        description: char?.description,
        version: char?.version,
        opCount: await db.operations.count(),
        tombstoneCount: await db.tombstones.count(),
      }
    })

    // Content untouched…
    expect(migrated.name).toBe('Prior Vela')
    expect(migrated.tags).toEqual(['legacy'])
    expect(migrated.description).toBe('from before')
    // …version backfilled, and the journal starts empty rather than inventing history.
    expect(migrated.version).toBe(1)
    expect(migrated.opCount).toBe(0)
    expect(migrated.tombstoneCount).toBe(0)
  })
})
