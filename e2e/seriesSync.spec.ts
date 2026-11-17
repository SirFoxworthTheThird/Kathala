import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  A series kept in a folder (issue #698): a folder chosen in book two's Cloud
  Sync is the series' folder. Saved, the folder holds the series as one file,
  the shared cast once and both books; book one stands as saved there too. A
  newer copy put in the folder by another device is loaded, as the series.

  The folder picker hands back a stand-in, with no dialog to answer. Its files
  are kept in the browser's own private folder (OPFS), but it is not that
  folder's handle: this headless Chromium closes the page when an OPFS handle
  is read back from IndexedDB (measured with a probe), and the app keeps the
  folder it is given there and reads it back at every look, as it must a
  folder a person picked. So the stand-in is plain data, which the store keeps,
  and its methods are where a copy read back still finds them, on
  Object.prototype, for this page only.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; get: (id: string) => Promise<Record<string, unknown> | undefined> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]
const FILE = 'The_Salt_Books_series.pwk'

const readFolderFile = (page: Page) => page.evaluate(async (name) => {
  const root = await navigator.storage.getDirectory()
  const dir = await root.getDirectoryHandle('sync', { create: true })
  try { return await (await (await dir.getFileHandle(name)).getFile()).text() } catch { return null }
}, FILE)

test.describe('A series in a folder', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a book’s folder is its series’: saved as one file, and a newer copy loaded as the series', async ({ page }) => {
    await page.addInitScript(() => {
      const dir = () => navigator.storage.getDirectory().then((root) => root.getDirectoryHandle('sync', { create: true }))
      const method = (name: string, fn: (this: { standIn?: boolean }, ...args: never[]) => unknown) =>
        Object.defineProperty(Object.prototype, name, { value: fn, configurable: true, writable: true })
      method('getFileHandle', async function (name: string, options?: { create?: boolean }) { return (await dir()).getFileHandle(name, options) })
      method('queryPermission', async function () { return 'granted' })
      method('requestPermission', async function () { return 'granted' })
      ;(window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker = async () => ({ standIn: true, kind: 'directory', name: 'sync' })
    })
    await resetDB(page)
    // A folder left from another test's run would read as another device's.
    await page.evaluate(async () => { await (await navigator.storage.getDirectory()).removeEntry('sync', { recursive: true }).catch(() => {}) })

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const one = worldOf(page)
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      await db.characters.add({ id: 'anna', worldId, name: 'Anna', description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
    }, one)
    await page.goto('/#/', { waitUntil: 'load' })
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('button', { name: /Make a series/ }).click()
    await page.getByRole('dialog', { name: 'Make a series' }).getByLabel('Series name').fill('The Salt Books')
    await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
    const card = main.getByRole('region', { name: 'Series: The Salt Books' })
    await card.getByRole('button', { name: 'Add a book' }).click()
    await page.getByLabel('Title').fill('The Second Road')
    await page.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const two = worldOf(page)

    // Book two's Cloud Sync says whose folder it is, and the folder chosen there is the series'.
    await page.goto(`/#/worlds/${two}/settings`, { waitUntil: 'load' })
    const sync = page.locator('#settings-cloud-sync')
    await expect(sync.getByText('This book is kept with its series. The folder holds “The Salt Books” as one file: the shared cast and world, and every book in it.')).toBeVisible({ timeout: 20_000 })
    await sync.getByRole('button', { name: 'Choose sync folder…' }).click()
    await expect(sync.getByText(`/ ${FILE}`)).toBeVisible()
    await expect(sync.getByText('Not saved yet')).toBeVisible()
    await sync.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(sync.getByText('Up to date')).toBeVisible()

    // The file is the series': its cast once, both books.
    const saved = JSON.parse((await readFolderFile(page))!)
    expect(saved.type).toBe('series')
    expect(saved.series.characters.map((c: { name: string }) => c.name)).toEqual(['Anna'])
    expect(saved.books.map((b: { world: { name: string } }) => b.world.name).sort()).toEqual(['The Salt Road', 'The Second Road'])

    // Book one stands as the series does: the same folder, up to date.
    // Reloaded, so the panel is book one's own, read afresh, not book two's left on screen.
    await page.goto(`/#/worlds/${one}/settings`, { waitUntil: 'load' })
    await page.reload({ waitUntil: 'load' })
    await expect(sync.getByText(`/ ${FILE}`)).toBeVisible({ timeout: 20_000 })
    await expect(sync.getByText('Up to date')).toBeVisible()
    // And the chip by its name says so: backed up, where a book with no folder of its own would say not.
    await expect(page.getByRole('button', { name: /^Backup:/ })).toHaveAccessibleName(/^Backup: Backed up/, { timeout: 30_000 })

    // Another device renames Anna and saves the series to the folder.
    await page.evaluate(async (name) => {
      const root = await navigator.storage.getDirectory()
      const dir = await root.getDirectoryHandle('sync')
      const handle = await dir.getFileHandle(name)
      const file = JSON.parse(await (await handle.getFile()).text())
      file.series.characters[0].name = 'Anna Vell'
      file.series.characters[0].updatedAt = Date.now() + 60_000
      await new Promise((r) => setTimeout(r, 2_100))
      const w = await handle.createWritable()
      await w.write(JSON.stringify(file))
      await w.close()
    }, FILE)
    await page.reload({ waitUntil: 'load' })
    await expect(sync.getByText('Newer copy in folder')).toBeVisible({ timeout: 20_000 })
    await sync.getByRole('button', { name: 'Load', exact: true }).click()
    await expect(page.getByText('The series “The Salt Books”, its shared cast and world and every book in it, comes in as one.')).toBeVisible()
    await page.getByRole('button', { name: 'Smart merge' }).click()
    await expect(sync.getByText('Up to date')).toBeVisible()
    const anna = await page.evaluate(async () => ((window as { __pwdb?: never }).__pwdb as unknown as Db).characters.get('anna'))
    expect(anna).toMatchObject({ name: 'Anna Vell' })
    expect(anna?.worldId).not.toBe(one)

    // Written here since, the series is saved by itself, 30 s on, to its own file, whole. The edit is Anna's, the
    // series' cast's, and goes in book one's journal, as an edit made in book one does: what auto-save reads.
    await page.evaluate(async (bookId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db & { operations: { put: (v: unknown) => Promise<unknown> } }
      await db.operations.put({ id: 'op-here', worldId: bookId, seq: 999, entityType: 'character', entityId: 'anna', op: 'update', at: Date.now() })
      await (db.characters as unknown as { update: (id: string, v: unknown) => Promise<unknown> }).update('anna', { description: 'Older now.', updatedAt: Date.now() })
    }, one)
    await expect.poll(async () => {
      const file = JSON.parse((await readFolderFile(page)) ?? '{}')
      return file.type === 'series' && file.series.characters[0].description
    }, { timeout: 70_000, intervals: [2_000] }).toBe('Older now.')
  })
})
