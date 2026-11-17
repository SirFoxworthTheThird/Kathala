import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/*
  Part 4 of the series bible (issue #698): book one's cast list says where a
  character from book two first appears; *in this book only* keeps her out of
  book one's list, and is refused for one book one tells of; and deleting a
  shared character names every book that tells of her.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]

async function sceneWith(page: Page, worldId: string, sceneId: string, cast: string[]) {
  await page.evaluate(async ({ worldId, sceneId, cast }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    await db.timelines.add({ id: `tl-${sceneId}`, worldId, name: 'Main', description: '', color: '#fff', createdAt: now, updatedAt: now })
    await db.chapters.add({ id: `ch-${sceneId}`, worldId, timelineId: `tl-${sceneId}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: sceneId, worldId, chapterId: `ch-${sceneId}`, timelineId: `tl-${sceneId}`, title: `Scene ${sceneId}`, description: '', locationMarkerId: null,
      involvedCharacterIds: cast, involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now,
    })
  }, { worldId, sceneId, cast })
}

async function person(page: Page, worldId: string, id: string, name: string) {
  await page.evaluate(async ({ worldId, id, name }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    await db.characters.add({ id, worldId, name, description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
  }, { worldId, id, name })
}

test.describe('A series’ cast, book by book', () => {
  test.describe.configure({ timeout: 180_000 })

  test('first appears, in this book only, and a delete that names the books', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const one = worldOf(page)
    await person(page, one, 'anna', 'Anna')
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
    // Cara, made while writing book two, is the series'; she and Anna are in its first scene.
    await person(page, two, 'cara', 'Cara')
    await sceneWith(page, two, 'b2s1', ['anna', 'cara'])

    // Book one's cast: Cara is there, and says where she first appears; Anna, whom book one tells of, says nothing of it.
    await page.goto(`/#/worlds/${one}/characters`, { waitUntil: 'load' })
    const cast = page.getByRole('main')
    const caraCard = cast.getByRole('link', { name: /^Cara/ })
    await expect(caraCard.getByText('First in The Second Road')).toBeVisible({ timeout: 30_000 })
    await expect(cast.getByRole('link', { name: /^Anna/ })).toBeVisible()
    await expect(cast.getByRole('link', { name: /^Anna/ }).getByText(/First in/)).toHaveCount(0)

    // Anna is in book one too: she cannot be kept to book two.
    await page.goto(`/#/worlds/${two}/characters/anna`, { waitUntil: 'load' })
    const annaMark = page.getByRole('checkbox', { name: 'In this book only' })
    await expect(annaMark).toBeDisabled({ timeout: 30_000 })
    await expect(page.getByText('Also in The Salt Road: they would lose them from their lists.')).toBeVisible()

    // Cara can, and is kept out of book one's list.
    await page.goto(`/#/worlds/${two}/characters/cara`, { waitUntil: 'load' })
    const caraMark = page.getByRole('checkbox', { name: 'In this book only' })
    await expect(caraMark).toBeEnabled({ timeout: 30_000 })
    await caraMark.check()
    await expect(page.getByText(/Kept out of the other books' lists\. Only The Second Road shows them\./)).toBeVisible()
    await page.goto(`/#/worlds/${one}/characters`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('link', { name: /^Anna/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('main').getByRole('link', { name: /^Cara/ })).toHaveCount(0)
    await page.goto(`/#/worlds/${two}/characters`, { waitUntil: 'load' })
    await expect(page.getByRole('main').getByRole('link', { name: /^Cara/ })).toBeVisible({ timeout: 30_000 })

    // Deleting Anna from book two names both books she is in.
    await page.goto(`/#/worlds/${two}/characters/anna`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'More actions for Anna' }).click()
    await page.getByRole('menuitem', { name: 'Delete character' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete "Anna"?' })
    await expect(confirm.getByText(
      'Anna appears in The Salt Road (1 scene) and The Second Road (1 scene). Deleting removes them, and their states, from every book in the series.',
    )).toBeVisible()
    await confirm.getByRole('button', { name: 'Cancel' }).click()
  })
})
