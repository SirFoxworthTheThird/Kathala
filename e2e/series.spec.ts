import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { parkCursor } from './helpers/cursor'

/*
  A series (issue #698, part 1): one book made a series from its card on the
  shelf, a second book added to it, and a character edited in the second book
  read the same in the first, since the cast is the series'.
*/

const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]

/** A book named "The Salt Road" with Anna in its cast, back on the shelf. */
async function bookWithAnna(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Road')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const bookId = worldOf(page)
  await page.evaluate(async (worldId) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.characters.add({
      id: 'anna', worldId, name: 'Anna', description: 'Grey eyes.', aliases: [], color: null, birthDate: null,
      portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now,
    })
  }, bookId)
  await page.goto('/#/', { waitUntil: 'load' })
  return bookId
}

test.describe('A series', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a book made a series, a second book added, and a character edited in one read the same in the other', async ({ page }) => {
    const bookId = await bookWithAnna(page)
    const main = page.getByRole('main')

    // Before: the book is a card of its own, and there is no series.
    await expect(main.getByRole('heading', { name: 'The Salt Road', exact: true })).toBeVisible()
    await expect(main.getByRole('region', { name: /^Series:/ })).toHaveCount(0)

    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('menuitem', { name: /Make a series/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Make a series' })
    await dialog.getByLabel('Series name').fill('The Salt Books')
    await dialog.getByRole('button', { name: 'Make the series' }).click()
    await expect(dialog).toHaveCount(0)

    // After: one card for the series, the book inside it, and not also beside it.
    const series = main.getByRole('region', { name: 'Series: The Salt Books' })
    await expect(series).toBeVisible()
    await expect(series.getByText('Series · 1 book')).toBeVisible()
    await expect(series.getByRole('button', { name: /^\d+\.\s*The Salt Road$/ })).toBeVisible()
    await expect(main.getByRole('button', { name: 'More actions for The Salt Road' })).toHaveCount(0)

    // A second book, opened at its dashboard, says where it stands in the series.
    await series.getByRole('button', { name: 'Add a book' }).click()
    const add = page.getByRole('dialog', { name: 'Add book 2 to The Salt Books' })
    await add.getByLabel('Title').fill('The Second Road')
    await add.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const twoId = worldOf(page)
    expect(twoId).not.toBe(bookId)
    await dismissFirstRunGuide(page)
    await expect(page.getByText('Book 2 of The Salt Books')).toBeVisible()

    // Anna is in book two's cast without being made there; edited there…
    await page.goto(`/#/worlds/${twoId}/characters/anna`, { waitUntil: 'load' })
    const panel = page.getByRole('tabpanel').first()
    await expect(panel.getByText('Grey eyes.')).toBeVisible({ timeout: 30_000 })
    await panel.getByRole('button', { name: 'Edit', exact: true }).click()
    await panel.getByLabel('Description').fill('Green eyes, since the fire.')
    await panel.getByRole('button', { name: 'Save' }).click()
    await expect(panel.getByText('Green eyes, since the fire.')).toBeVisible()
    // The edit is book two's to take back, though the cast is the series': its Undo has it, and its Redo puts it back.
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await expect(panel.getByText('Grey eyes.')).toBeVisible()
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    await expect(panel.getByText('Green eyes, since the fire.')).toBeVisible()

    // …and book one reads the same Anna.
    await page.goto(`/#/worlds/${bookId}/characters/anna`, { waitUntil: 'load' })
    await expect(page.getByRole('tabpanel').first().getByText('Green eyes, since the fire.')).toBeVisible({ timeout: 30_000 })
    await page.goto(`/#/worlds/${bookId}`, { waitUntil: 'load' })
    await dismissFirstRunGuide(page)
    await expect(page.getByText('Book 1 of The Salt Books')).toBeVisible()

    // Back on the shelf, the series lists both, in order.
    await page.goto('/#/', { waitUntil: 'load' })
    await expect(series.getByText('Series · 2 books')).toBeVisible()
    await expect(series.getByRole('listitem')).toHaveText([/1\.\s*The Salt Road/, /2\.\s*The Second Road/])
  })

  test('deleting a series names its books, and takes them and the cast they share', async ({ page }) => {
    await bookWithAnna(page)
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('menuitem', { name: /Make a series/ }).click()
    await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
    const series = main.getByRole('region', { name: 'Series: The Salt Road series' })
    await expect(series).toBeVisible()

    await series.getByRole('button', { name: 'Delete the series The Salt Road series' }).click()
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'))
    await expect(confirm.getByText(/its book, “The Salt Road”, and the cast, places and lore they share/)).toBeVisible()
    await confirm.getByRole('button', { name: /Delete|Confirm/ }).last().click()
    await expect(series).toHaveCount(0)
    const left = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { count: () => Promise<number> }>
      return { worlds: await db.worlds.count(), characters: await db.characters.count() }
    })
    expect(left).toEqual({ worlds: 0, characters: 0 })
  })

  test('book two opens where book one ended: one dead at its end is dead at book two’s first scene, and the checker names book one', async ({ page }) => {
    const bookId = await bookWithAnna(page)
    // Book one: one scene, at which Anna dies.
    const seedScene = async (worldId: string, sceneId: string, dies: boolean) => page.evaluate(async ({ worldId, sceneId, dies }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: `tl-${sceneId}`, worldId, name: 'Main', description: '', color: '#fff', createdAt: now, updatedAt: now })
      await db.chapters.add({ id: `ch-${sceneId}`, worldId, timelineId: `tl-${sceneId}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: sceneId, worldId, chapterId: `ch-${sceneId}`, timelineId: `tl-${sceneId}`, title: 'The ford', description: '', locationMarkerId: null,
        involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now,
      })
      if (dies) await db.characterSnapshots.add({ id: `dead-${sceneId}`, worldId, characterId: 'anna', eventId: sceneId, isAlive: false, sortKey: 1, createdAt: now, updatedAt: now })
    }, { worldId, sceneId, dies })
    await seedScene(bookId, 'b1s1', true)

    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'More actions for The Salt Road' }).click()
    await main.getByRole('menuitem', { name: /Make a series/ }).click()
    await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
    await main.getByRole('region', { name: /^Series:/ }).getByRole('button', { name: 'Add a book' }).click()
    await page.getByLabel('Title').fill('The Second Road')
    await page.getByRole('button', { name: 'Add the book' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const twoId = worldOf(page)
    await seedScene(twoId, 'b2s1', false)

    // At book two's first scene Anna has no record there; she is as book one left her. Alive here would be a return.
    await page.goto(`/#/worlds/${twoId}/characters/anna`, { waitUntil: 'load' })
    await parkCursor(page, 'b2s1')
    await page.getByRole('tab', { name: 'Current State' }).click()
    const panel = page.getByRole('tabpanel').first()
    const cameBack = panel.getByText('They came back in this scene')
    await expect(panel.getByRole('button', { name: 'Alive' })).toBeVisible({ timeout: 30_000 })
    await expect(cameBack).toHaveCount(0)
    await panel.getByRole('button', { name: 'Alive' }).click()
    await expect(cameBack).toBeVisible()

    // Saved alive with no return said: the checker says so, naming the book she died at the end of.
    await panel.getByRole('button', { name: 'Save State' }).click()
    await expect(panel.getByRole('button', { name: 'Save State' })).toBeDisabled()
    await page.getByTitle('Continuity Checker').click()
    const checker = page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
    await expect(checker.getByText('Anna is alive again in Ch. 1 after dying at the end of The Salt Road')).toBeVisible()
  })
})
