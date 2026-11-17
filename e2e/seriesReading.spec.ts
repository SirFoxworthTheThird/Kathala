import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { parkCursor } from './helpers/cursor'

/*
  Reading mode in a series (issue #698, D-3): opening book two to read it, the
  reader is asked once whether they have read book one. Said no, Anna, whom
  book one met and book two has not yet, is kept back; said yes, in Settings,
  she is known from the first page. A first book does not ask.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]

async function sceneWith(page: Page, worldId: string, sceneId: string, cast: string[], sortOrder = 0, chapter = `ch-${worldId}`) {
  await page.evaluate(async ({ worldId, sceneId, cast, sortOrder, chapter }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    if (sortOrder === 0) {
      await db.timelines.add({ id: `tl-${worldId}`, worldId, name: 'Main', description: '', color: '#fff', createdAt: now, updatedAt: now })
      await db.chapters.add({ id: chapter, worldId, timelineId: `tl-${worldId}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    await db.events.add({
      id: sceneId, worldId, chapterId: chapter, timelineId: `tl-${worldId}`, title: `Scene ${sceneId}`, description: '', locationMarkerId: null,
      involvedCharacterIds: cast, involvedItemIds: [], tags: [], sortOrder, status: 'draft', createdAt: now, updatedAt: now,
    })
  }, { worldId, sceneId, cast, sortOrder, chapter })
}

const reading = (page: Page, worldId: string) => page.evaluate(async (id) => {
  await ((window as { __pwdb?: never }).__pwdb as unknown as Db).worlds.update(id, { readingMode: true })
}, worldId)

test.describe('Reading a later book of a series', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the reader is asked once whether they have read the earlier books, and the cast follows the answer', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const one = worldOf(page)
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      for (const [id, name] of [['anna', 'Anna'], ['cara', 'Cara']]) {
        await db.characters.add({ id, worldId, name, description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
      }
    }, one)
    await sceneWith(page, one, 'b1s1', ['anna'])

    await page.goto('/#/', { waitUntil: 'load' })
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('button', { name: /Make a series/ }).click()
    await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
    await main.getByRole('region', { name: /^Series:/ }).getByRole('button', { name: 'Add a book' }).click()
    await page.getByLabel('Title').fill('The Second Road')
    await page.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const two = worldOf(page)
    // Book two meets Cara in its first scene, and Anna only in its second.
    await sceneWith(page, two, 'b2s1', ['cara'])
    await sceneWith(page, two, 'b2s2', ['anna'], 1)
    await reading(page, one)
    await reading(page, two)

    // Book one, a first book, does not ask.
    await page.goto(`/#/worlds/${one}/characters`, { waitUntil: 'load' })
    await parkCursor(page, 'b1s1')
    await expect(page.getByRole('main').getByRole('link', { name: /^Anna/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('dialog', { name: 'Have you read the earlier books?' })).toHaveCount(0)

    // Book two asks, at its first scene.
    await page.goto(`/#/worlds/${two}/characters`, { waitUntil: 'load' })
    await parkCursor(page, 'b2s1')
    const ask = page.getByRole('dialog', { name: 'Have you read the earlier books?' })
    await expect(ask).toBeVisible({ timeout: 30_000 })
    await expect(ask.getByText(/is book 2 of/)).toBeVisible()
    await ask.getByRole('button', { name: 'Not yet' }).click()
    await expect(ask).toHaveCount(0)

    // Not read: Cara, met here, is shown; Anna, met only in book one so far, is kept back.
    const cast = page.getByRole('main')
    await expect(cast.getByRole('link', { name: /^Cara/ })).toBeVisible({ timeout: 30_000 })
    await expect(cast.getByRole('link', { name: /^Anna/ })).toHaveCount(0)

    // Said otherwise in Settings, Anna is known from the first page.
    await page.goto(`/#/worlds/${two}/settings`, { waitUntil: 'load' })
    const setting = page.getByRole('checkbox', { name: 'I have read the earlier books' })
    await expect(setting).not.toBeChecked({ timeout: 30_000 })
    await setting.check()
    await page.goto(`/#/worlds/${two}/characters`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('link', { name: /^Anna/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('main').getByRole('link', { name: /^Cara/ })).toBeVisible()
    // And it is not asked again.
    await expect(page.getByRole('dialog', { name: 'Have you read the earlier books?' })).toHaveCount(0)
  })
})
