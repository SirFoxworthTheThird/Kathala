import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Out of a series (issue #698): book two taken out from the series' card is a
  book on its own, with its own Anna, whose edits no longer reach book one's;
  then the series dissolved, and book one is on its own too.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Array<Record<string, unknown>>> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]
const castOf = (page: Page, worldId: string) => page.evaluate(async (id) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
  return (await db.characters.toArray()).filter((c) => c.worldId === id).map((c) => ({ id: c.id as string, name: c.name as string }))
}, worldId)

test.describe('Out of a series', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a book taken out keeps its own cast; a series dissolved leaves its books whole', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      await db.characters.add({ id: 'anna', worldId, name: 'Anna', description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
    }, worldOf(page))
    await page.goto('/#/', { waitUntil: 'load' })
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('button', { name: /Make a series/ }).click()
    await page.getByRole('dialog', { name: 'Make a series' }).getByLabel('Series name').fill('The Salt Books')
    await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
    const card = main.getByRole('region', { name: 'Series: The Salt Books' })
    await card.getByRole('button', { name: 'Add a book' }).click()
    await page.getByLabel('Title').fill('Book Two')
    await page.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const two = worldOf(page)
    await page.goto('/#/', { waitUntil: 'load' })
    await expect(card.getByText('Series · 2 books')).toBeVisible()

    // Book Two taken out: a card of its own, the series with one book.
    await card.getByRole('button', { name: 'Take Book Two out of the series' }).click()
    const takeOut = page.getByRole('dialog', { name: 'Take “Book Two” out of the series?' })
    await takeOut.getByRole('button', { name: 'Take it out' }).click()
    await expect(card.getByText('Series · 1 book')).toBeVisible()
    await expect(main.getByRole('button', { name: 'More actions for Book Two' })).toBeVisible()

    // It has its own Anna: not the series' one.
    const own = await castOf(page, two)
    expect(own.map((c) => c.name)).toEqual(['Anna'])
    expect(own[0].id).not.toBe('anna')

    // Dissolved: no series, and The Salt Road is a book on its own with Anna, as it was.
    await card.getByRole('button', { name: 'Dissolve series' }).click()
    await page.getByRole('dialog', { name: 'Dissolve the series "The Salt Books"?' }).getByRole('button', { name: 'Dissolve' }).click()
    await expect(main.getByRole('region', { name: /^Series:/ })).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'More actions for The Salt Road' })).toBeVisible()
    const oneId = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      return (await db.worlds.toArray()).find((w) => w.name === 'The Salt Road')!.id as string
    })
    expect((await castOf(page, oneId)).map((c) => c.name)).toEqual(['Anna'])
  })
})
