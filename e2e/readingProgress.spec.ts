import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The reader is told where they are in the book.
 *
 * The arithmetic is unit-tested in `src/lib/__tests__/readingPlace.test.ts`.
 * What needs a browser is whether the measurements reaching it are real: the
 * extents are read from laid-out DOM, cached, and re-read on resize, and any of
 * that can be wrong in a way no pure test would notice — an `offsetTop` taken
 * before layout reads zero for every chapter and the bar would sit at chapter
 * one all the way through the book.
 */

const scroller = (page: Page) => page.locator('div.flex-1.overflow-auto').first()
const progress = (page: Page) => page.getByRole('progressbar', { name: 'Progress through the book' })

async function openBook(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)
}

async function scrollFraction(page: Page, f: number) {
  await scroller(page).evaluate((el, frac) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) * frac
  }, f)
  await page.waitForTimeout(400)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('progress through the book tracks the reader, and names the chapter', async ({ page }) => {
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  const bar = progress(page)
  await expect(bar).toBeVisible()
  await expect(bar).toHaveAttribute('aria-valuenow', '0')
  await expect(page.getByText(/Chapter 1 of 12/)).toBeVisible()

  await scrollFraction(page, 0.5)
  const half = Number(await bar.getAttribute('aria-valuenow'))
  expect(half, 'halfway through the column reads about half').toBeGreaterThan(35)
  expect(half).toBeLessThan(65)

  await scrollFraction(page, 1)
  await expect(bar).toHaveAttribute('aria-valuenow', '100')
  // Alice's last chapter, which the reader has now reached.
  await expect(page.getByText(/Chapter 12 of 12/)).toBeVisible()
})

test('the chapter follows the reader backwards, where the spoiler gate does not', async ({ page }) => {
  /*
    The two are deliberately different. The cursor is a high-water mark — turning
    back to re-read does not re-hide what has been learned — but "where am I"
    must answer with where the reader is *looking*, or it would claim they are
    ten chapters further on than the page in front of them.
  */
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)

  await scrollFraction(page, 0.8)
  await expect(page.getByText(/Chapter (9|10|11|12) of 12/)).toBeVisible()
  const cursorAfterReading = await page.evaluate(() => {
    const raw = localStorage.getItem('kathala-ui')
    return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
  })

  await scrollFraction(page, 0.05)
  await expect(page.getByText(/Chapter 1 of 12/), 'the readout came back with them').toBeVisible()

  // And the gate did not close behind them.
  expect(await page.evaluate(() => {
    const raw = localStorage.getItem('kathala-ui')
    return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
  })).toBe(cursorAfterReading)
})

test('a writer drafting the same manuscript is not shown a reader’s progress', async ({ page }) => {
  /*
    The absence beside the presences above, and it has to be the *same book*.

    The first version of this created an empty world, where the row is absent
    because there is no prose — so it passed with the reading-mode condition
    removed entirely, which a mutation run caught. An absence checked on a
    screen where the control could never appear anyway is worth less than no
    test. So: a book with all of its prose, reading mode turned off, and the row
    must still be gone.
  */
  const worldId = await downloadLibraryBook(page, 'Alice\u2019s Adventures in Wonderland')
  await settle(page)
  await openBook(page)
  await expect(progress(page), 'the row is here while reading').toBeVisible()

  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)

  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Manuscript', exact: true }).click()
  await settle(page)

  // Same prose, same screen, no reader's progress.
  await expect(page.locator('[data-scene-event-id]').first(), 'the prose is still here').toBeVisible()
  await expect(progress(page), 'but the reader-s progress row is not').toHaveCount(0)
})
