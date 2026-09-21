import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Reading mode now hands the reader the book, and follows them through it.
 *
 * Thirty-one of the shipped worlds carry the complete text of a public-domain
 * novel — their catalogue entries call themselves reading-mode editions — and
 * the screen that shows it was closed to exactly the reader it was assembled
 * for. The rules that keep the cursor from taking anything away live in
 * `src/lib/readingPosition.ts` and are unit-tested there; what needs a browser
 * is whether the screen is reachable, whether it reads as a book rather than as
 * a draft, and whether a freshly downloaded world starts closed.
 */

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a downloaded book opens at its first scene, not at "all chapters"', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  // A null cursor means every chapter, which on a book nobody has read is the
  // whole plot. The position is recorded against the world, so read it back.
  const position = await page.evaluate(() => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : null
    const byWorld = st?.state?.eventByWorld ?? {}
    const ids = Object.values(byWorld)
    return { count: ids.length, anyNull: ids.some((v) => v === null) }
  })
  expect(position.count).toBeGreaterThan(0)
  expect(position.anyNull).toBe(false)
})

test('the reader is offered the book, under a reader’s name for it', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Read', exact: true })).toBeVisible()
  // "Manuscript" is what an author calls their draft; there is no author here.
  await expect(nav.getByRole('link', { name: 'Manuscript', exact: true })).toHaveCount(0)
})

test('a world with no prose offers no book at all', async ({ page }) => {
  // The paired absence. Harry Potter is structural notes only — its own
  // catalogue entry says "no text from the book is included" — so a Read link
  // there would open a screen with nothing on it.
  await downloadLibraryBook(page, "Harry Potter and the Philosopher's Stone")
  await settle(page)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Characters' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Read', exact: true })).toHaveCount(0)
})

test('the book reads as a book, not as a draft', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)

  const main = page.getByRole('main')
  // The prose is there.
  await expect(main.getByText(/Jonathan Harker/i).first()).toBeVisible()

  // And the author's instruments are not: no draft/reading switch, no word
  // goal, no "scenes written" tally, no export or find-and-replace.
  await expect(main.getByRole('group', { name: 'View mode' })).toHaveCount(0)
  await expect(main.getByLabel('Word goal for the book')).toHaveCount(0)
  await expect(main.getByText(/scenes written/)).toHaveCount(0)
  await expect(main.getByRole('button', { name: /Find & replace/ })).toHaveCount(0)
  await expect(main.getByRole('button', { name: /^Export$/ })).toHaveCount(0)
})

/**
 * The reader's place, which is two things and was only ever one.
 *
 * The cursor — how far the story bible is unlocked — survived leaving the book
 * and closing the tab from the start, because it is stored per world. The page
 * did not: the prose came back scrolled to the top, so a reader four hundred
 * pages into *The Count of Monte Cristo* was returned to chapter one and had to
 * find their place by hand. The gate was right and the book was wrong, which is
 * the half a test about what is *revealed* never notices.
 */
const scroller = (page: import('@playwright/test').Page) =>
  page.locator('div.flex-1.overflow-auto').first()

async function openBook(page: import('@playwright/test').Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)
}

const cursor = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const raw = localStorage.getItem('kathala-ui')
  return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
})

test('reading on carries the reader\u2019s place with it, and turning back does not', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)
  await openBook(page)

  const opened = await cursor(page)
  expect(opened).toBeTruthy()

  // Read a good way in: the cursor follows.
  await scroller(page).evaluate((el) => { el.scrollTop = 12000 })
  await expect.poll(() => cursor(page), { timeout: 15_000 }).not.toBe(opened)
  const readTo = await cursor(page)

  // Turn back to re-read an earlier chapter: what has been learned stays.
  await scroller(page).evaluate((el) => { el.scrollTop = 0 })
  await page.waitForTimeout(1500)
  expect(await cursor(page)).toBe(readTo)
})

test('the book reopens where it was left, after leaving it and after a reload', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)
  await openBook(page)

  await scroller(page).evaluate((el) => { el.scrollTop = 12000 })
  await expect.poll(() => cursor(page), { timeout: 15_000 }).not.toBe('dracula-event-1')

  // Leave the book for another screen, then come back.
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Characters' }).click()
  await settle(page)
  await openBook(page)
  await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop), { timeout: 15_000 })
    .toBeGreaterThan(6000)

  // And close the tab on it.
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop).catch(() => 0), { timeout: 30_000 })
    .toBeGreaterThan(6000)
})
