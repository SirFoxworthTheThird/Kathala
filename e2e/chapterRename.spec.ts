import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * W23-2. A chapter's title could not be changed anywhere in the app.
 * `updateChapter` had exactly two call sites — `{ notes }` and `{ wordGoal }` —
 * so `title` and `synopsis` were write-once at the Add Chapter dialog, while
 * the first-run guide promised *"All three can be renamed later"* and *"Rename
 * any of the three whenever you like, from the Timeline screen"*, and the guide
 * said it twice more. The only rename that existed renamed the **timeline**,
 * and rendered only when a world had more than one — which a novel does not.
 *
 * A writer retitles chapters constantly, and the only escape was to delete the
 * chapter and lose its scenes.
 */

async function timelineWithAChapter(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Rename World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('Chapter 1')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await expect(page.getByRole('main').getByText('Ch. 1 — Chapter 1')).toBeVisible()
  return worldId
}

/** The stored title, read from Dexie rather than off the screen. */
const storedTitle = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    chapters: { toArray: () => Promise<Array<{ title: string }>> }
  }
  return (await db.chapters.toArray())[0]?.title ?? null
})

test.describe('Renaming a chapter', () => {
  test.describe.configure({ timeout: 180_000 })

  test('is offered on the Timeline screen, where the guide says it is', async ({ page }) => {
    await timelineWithAChapter(page)

    await page.getByRole('button', { name: 'More actions for chapter 1' }).click()
    await page.getByRole('menuitem', { name: 'Rename chapter' }).click()

    const field = page.getByLabel('Chapter title')
    await expect(field).toBeVisible()
    await field.fill('The Weir')
    await field.press('Enter')

    await expect.poll(async () => await storedTitle(page), { timeout: 15_000 }).toBe('The Weir')
    await expect(page.getByRole('main').getByText('Ch. 1 — The Weir')).toBeVisible()
  })

  /*
    N6 from a blind writer run: the chapter's own screen showed "Ch. 1 —
    Chapter 1" as static text, and renaming meant going Back, finding the row
    among 117 of them, and opening its ⋯ menu. The synopsis directly below the
    heading has always been typed in place there, so the title is too.
  */
  test('is also offered on the chapter\'s own screen, in place', async ({ page }) => {
    const worldId = await timelineWithAChapter(page)
    await page.getByRole('button', { name: 'Open chapter detail — Ch. 1' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.*\/timeline\//)

    const field = page.getByRole('main').getByLabel('Chapter title')
    await expect(field).toBeVisible({ timeout: 20_000 })
    await expect(field).toHaveValue('Chapter 1')

    await field.fill('The Weir')
    await expect.poll(async () => await storedTitle(page), { timeout: 15_000 }).toBe('The Weir')

    // …and the pair: clearing it does not leave a nameless chapter behind.
    await field.fill('   ')
    await page.waitForTimeout(1500)
    expect(await storedTitle(page)).toBe('The Weir')

    // The timeline row shows the new name, so the two screens agree.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settleNav(page)
    await expect(page.getByRole('main').getByText('Ch. 1 — The Weir')).toBeVisible({ timeout: 20_000 })
  })

  test('Escape leaves the title alone', async ({ page }) => {
    // The pair to the test above: the same field, the other key. Without it,
    // "the title changed" would pass on a control that committed on any exit.
    await timelineWithAChapter(page)

    await page.getByRole('button', { name: 'More actions for chapter 1' }).click()
    await page.getByRole('menuitem', { name: 'Rename chapter' }).click()

    const field = page.getByLabel('Chapter title')
    await field.fill('Discarded')
    await field.press('Escape')

    await expect(field).toHaveCount(0)
    await expect(page.getByRole('main').getByText('Ch. 1 — Chapter 1')).toBeVisible()
    expect(await storedTitle(page)).toBe('Chapter 1')
  })

  test('an empty title is refused rather than written', async ({ page }) => {
    // A scene may be untitled; a chapter carries a number and a name on the
    // contents page, and blanking it by accident is the thing to prevent.
    await timelineWithAChapter(page)

    await page.getByRole('button', { name: 'More actions for chapter 1' }).click()
    await page.getByRole('menuitem', { name: 'Rename chapter' }).click()

    const field = page.getByLabel('Chapter title')
    await field.fill('   ')
    await field.press('Enter')

    await expect(field).toBeVisible()
    expect(await storedTitle(page)).toBe('Chapter 1')
  })
})
