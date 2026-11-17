import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'

/*
  A series' file (issue #698, part 5): the series exported whole from its card;
  brought into an empty library it is the series again, both books in its card;
  brought in over the series it copies, the shelf asks how. Merge keeps the
  newer name written here; Replace puts the file's back.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; get: (id: string) => Promise<Record<string, unknown> | undefined>; update: (id: string, v: unknown) => Promise<unknown>; delete: (id: string) => Promise<unknown> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]
const hasCara = (page: Page) => page.evaluate(async () => !!(await ((window as { __pwdb?: never }).__pwdb as unknown as Db).characters.get('cara')))
const annaName = (page: Page) => page.evaluate(async () => ((await ((window as { __pwdb?: never }).__pwdb as unknown as Db).characters.get('anna'))?.name))

async function chooseImportFile(page: Page, contents: string) {
  await page.getByRole('button', { name: /Import/ }).first().click()
  await page.getByRole('button', { name: 'Choose file…' }).click()
  await page.locator('input[aria-label="Import world file"]').setInputFiles({ name: 'the-salt-books.pwk', mimeType: 'application/json', buffer: Buffer.from(contents, 'utf8') })
}

test.describe('A series, whole, in a file', () => {
  test.describe.configure({ timeout: 180_000 })

  test('exported from its card, brought into an empty library, and over itself by merge and by replace', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const one = worldOf(page)
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      await db.characters.add({ id: 'anna', worldId, name: 'Anna', description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
      await db.characters.add({ id: 'cara', worldId, name: 'Cara', description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
    }, one)
    await page.goto('/#/', { waitUntil: 'load' })
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('button', { name: /Make a series/ }).click()
    const make = page.getByRole('dialog', { name: 'Make a series' })
    await make.getByLabel('Series name').fill('The Salt Books')
    await make.getByRole('button', { name: 'Make the series' }).click()
    const card = main.getByRole('region', { name: 'Series: The Salt Books' })
    await card.getByRole('button', { name: 'Add a book' }).click()
    await page.getByLabel('Title').fill('The Second Road')
    await page.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.goto('/#/', { waitUntil: 'load' })

    // Exported from the series' card: one file.
    const download = page.waitForEvent('download')
    await page.getByRole('main').getByRole('region', { name: 'Series: The Salt Books' }).getByRole('button', { name: 'Export series' }).click()
    const saved = await download
    expect(saved.suggestedFilename()).toBe('The_Salt_Books.pwk')
    const file = await readFile((await saved.path())!, 'utf8')
    expect(JSON.parse(file)).toMatchObject({ type: 'series', series: { world: { name: 'The Salt Books', kind: 'series' } } })

    // Merge: a name written here after the file was made is newer, and stays.
    // Cara's row goes too, with no tombstone, as on a device that never had her: the file brings her back
    // either way, which says the import has finished before Anna's name is read.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      await db.characters.update('anna', { name: 'Anna Vell', updatedAt: Date.now() + 60_000 })
      await db.characters.delete('cara')
    })
    expect(await hasCara(page)).toBe(false)
    await chooseImportFile(page, file)
    const ask = page.getByRole('dialog', { name: 'Bring in “The Salt Books”?' })
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Merge' }).click()
    await expect(ask).toHaveCount(0)
    await expect.poll(() => hasCara(page)).toBe(true)
    expect(await annaName(page)).toBe('Anna Vell')

    // Replace: the series is the file's again.
    await chooseImportFile(page, file)
    await expect(ask).toBeVisible()
    await ask.getByRole('button', { name: 'Replace' }).click()
    await expect(ask).toHaveCount(0)
    await expect.poll(() => annaName(page)).toBe('Anna')

    // Into an empty library, nothing asked: the series and its two books.
    await resetDB(page)
    await chooseImportFile(page, file)
    await expect(page.getByRole('dialog', { name: /Bring in/ })).toHaveCount(0)
    const back = page.getByRole('main').getByRole('region', { name: 'Series: The Salt Books' })
    await expect(back.getByText('Series · 2 books')).toBeVisible({ timeout: 30_000 })
    await expect(back.getByRole('button', { name: /^\d+\.\s*The Second Road$/ })).toBeVisible()
    expect(await annaName(page)).toBe('Anna')
  })
})
