import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { parkCursor } from './helpers/cursor'

/*
  Join a series (issue #698, part 3): a book written on its own, with its own
  Anna and Bo, joins the series its first book became. Anna is matched to the
  series' Anna and Bo is said not to be the same man; Cara, whom the series has
  not got, joins as she is. After it, the book's scene names the series' Anna,
  and she opens the book as book one left her.
*/

type Db = Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Array<Record<string, unknown>>> }>
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]

async function seed(page: Page, worldId: string, people: Array<[string, string]>, sceneId: string, dies: string | null) {
  await page.evaluate(async ({ worldId, people, sceneId, dies }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    for (const [id, name] of people) {
      await db.characters.add({ id, worldId, name, description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
    }
    await db.timelines.add({ id: `tl-${sceneId}`, worldId, name: 'Main', description: '', color: '#fff', createdAt: now, updatedAt: now })
    await db.chapters.add({ id: `ch-${sceneId}`, worldId, timelineId: `tl-${sceneId}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: sceneId, worldId, chapterId: `ch-${sceneId}`, timelineId: `tl-${sceneId}`, title: `Scene ${sceneId}`, description: '', locationMarkerId: null,
      involvedCharacterIds: people.map(([id]) => id), involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now,
    })
    if (dies) await db.characterSnapshots.add({ id: `dead-${dies}`, worldId, characterId: dies, eventId: sceneId, isAlive: false, sortKey: 1, createdAt: now, updatedAt: now })
  }, { worldId, people, sceneId, dies })
}

test.describe('Join a series', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a book of its own joins a series: Anna matched, Bo not, Cara new; its scene names the series’ Anna', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('The Salt Road')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const one = worldOf(page)
    // Book one: Anna and Bo; Anna dies at its one scene.
    await seed(page, one, [['anna', 'Anna'], ['bo', 'Bo']], 'b1s1', 'anna')
    // Book two, written on its own: its own Anna and Bo, and Cara.
    const two = 'book-two'
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      await db.worlds.add({ id, name: 'The Second Road', description: '', coverImageId: null, theme: null, continuityStaleThreshold: 5, createdAt: now, updatedAt: now })
    }, two)
    await seed(page, two, [['anna-2', 'Anna'], ['bo-2', 'Bo'], ['cara', 'Cara']], 'b2s1', null)

    await page.goto('/#/', { waitUntil: 'load' })
    const main = page.getByRole('main')
    // Before there is a series, there is nothing to join.
    await main.getByRole('button', { name: 'More actions for The Second Road' }).click()
    await expect(main.getByRole('button', { name: /Make a series/ })).toBeVisible()
    await expect(main.getByRole('button', { name: /Join a series/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('button', { name: /Make a series/ }).click()
    const make = page.getByRole('dialog', { name: 'Make a series' })
    await make.getByLabel('Series name').fill('The Salt Books')
    await make.getByRole('button', { name: 'Make the series' }).click()
    await expect(make).toHaveCount(0)

    // Now the second book can join it.
    await main.getByRole('button', { name: 'More actions for The Second Road' }).click()
    await main.getByRole('button', { name: /Join a series/ }).click()
    const join = page.getByRole('dialog', { name: 'Join a series' })
    const people = join.getByRole('region', { name: 'People' })
    // Each copy the series has a record of is offered as it, by its name; Cara is not, and joins as new.
    await expect(people.getByLabel('Anna', { exact: true })).toHaveValue('anna')
    await expect(people.getByLabel('Bo', { exact: true })).toHaveValue('bo')
    await expect(people.getByLabel('Cara', { exact: true })).toHaveCount(0)
    await expect(join.getByText('Joining as new, with no match in the series: Cara.')).toBeVisible()
    // This Bo is another man.
    await people.getByLabel('Bo', { exact: true }).selectOption({ label: 'Not a match: joins as new' })
    await join.getByRole('button', { name: 'Join the series' }).click()
    await expect(join).toHaveCount(0)

    // The book is the series' second, inside its card.
    const series = main.getByRole('region', { name: 'Series: The Salt Books' })
    await expect(series.getByText('Series · 2 books')).toBeVisible()
    await expect(series.getByRole('button', { name: /^\d+\.\s*The Second Road$/ })).toBeVisible()
    await expect(main.getByRole('button', { name: 'More actions for The Second Road' })).toHaveCount(0)

    // In the store: one Anna, two Bos, Cara; the scene names the series' Anna, and its own Bo.
    const state = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const people = await db.characters.toArray()
      const scene = (await db.events.toArray()).find((e) => e.id === 'b2s1')
      return { names: people.map((p) => p.name).sort(), cast: scene?.involvedCharacterIds, inBookTwo: people.filter((p) => p.worldId === 'book-two').length }
    })
    expect(state).toEqual({ names: ['Anna', 'Bo', 'Bo', 'Cara'], cast: ['anna', 'bo-2', 'cara'], inBookTwo: 0 })

    // And Anna opens book two as book one left her: dead.
    await page.goto(`/#/worlds/${two}/characters/anna`, { waitUntil: 'load' })
    await parkCursor(page, 'b2s1')
    await page.getByRole('tab', { name: 'Current State' }).click()
    const panel = page.getByRole('tabpanel').first()
    await expect(panel.getByRole('button', { name: 'Alive' })).toBeVisible({ timeout: 30_000 })
    await panel.getByRole('button', { name: 'Alive' }).click()
    await expect(panel.getByText('They came back in this scene')).toBeVisible()
  })
})
