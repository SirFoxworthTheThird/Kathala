import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A reader can turn back without un-revealing the book.
 *
 * The rules are unit-tested in `src/lib/__tests__/readingContents.test.ts`.
 * What needs a browser is the part that is the whole point: that using the
 * contents list moves the *page* and not the *gate*, which is a claim about two
 * pieces of state changing independently and cannot be made without both.
 */

const scroller = (page: Page) => page.locator('div.flex-1.overflow-auto').first()
const contents = (page: Page) => page.getByRole('button', { name: 'Contents' })
const chapterList = (page: Page) => page.getByRole('group', { name: 'Chapters you have read' })

const cursor = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('kathala-ui')
  return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
})

async function openBook(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)
}

async function readTo(page: Page, fraction: number) {
  await scroller(page).evaluate((el, f) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) * f
  }, fraction)
  await page.waitForTimeout(700)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('jumping back through the contents moves the page, not the gate', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  await readTo(page, 0.75)
  const reached = await cursor(page)
  const deepScroll = await scroller(page).evaluate((el) => el.scrollTop)
  expect(deepScroll, 'the reader is well into the book').toBeGreaterThan(1000)

  await contents(page).click()
  await expect(chapterList(page)).toBeVisible()
  await chapterList(page).getByRole('button', { name: /^1\./ }).click()

  // The page went back...
  await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBeLessThan(deepScroll / 2)
  // ...and the gate did not.
  expect(await cursor(page), 'nothing the reader learned was taken away').toBe(reached)
})

test('the contents offer only what has been read, and grow as the reader does', async ({ page }) => {
  /*
    The presence and the absence in one: a chapter ahead must not be listed,
    and the same chapter must appear once it has been reached — otherwise "not
    listed" could be satisfied by a list that never grows at all.
  */
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  await contents(page).click()
  await expect(chapterList(page).getByRole('button', { name: /^1\./ })).toBeVisible()
  await expect(
    chapterList(page).getByRole('button', { name: /^9\./ }),
    'chapter nine is not offered to a reader on chapter one',
  ).toHaveCount(0)
  await page.keyboard.press('Escape')

  await readTo(page, 0.85)
  await contents(page).click()
  await expect(
    chapterList(page).getByRole('button', { name: /^9\./ }),
    'and is offered once they have read that far',
  ).toBeVisible()
})

test('the way back to your place appears only once you have left it', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  const back = page.getByRole('button', { name: 'Back to your place' })
  await expect(back, 'nothing to return to at the opening').toHaveCount(0)

  await readTo(page, 0.6)
  const place = await scroller(page).evaluate((el) => el.scrollTop)
  await expect(back, 'still on it').toHaveCount(0)

  await readTo(page, 0)
  await expect(back, 'having turned back, the way forward is offered').toBeVisible()

  await back.click()
  await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop))
    .toBeGreaterThan(place * 0.7)
  await expect(back, 'and having returned, it stands down again').toHaveCount(0)
})
