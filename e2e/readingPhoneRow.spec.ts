import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The reading row works on a phone.
 *
 * A blind reader run read at 390, 360 and 320px and found two faults in work
 * that had just shipped:
 *
 * - the progress line ended `"5% of the book · Chapter 6 of 117 ·"` — the
 *   separator was a sibling of the span it belonged to, and only the span
 *   carried `hidden sm:inline`. At 320px the row wrapped and stranded a second
 *   dot alone at the right edge.
 * - `Snug / Relaxed / Airy` were `sm:flex` and rendered not at all, so line
 *   spacing — the setting that matters most in a narrow column — was withheld
 *   from the readers most likely to want it.
 *
 * Phone viewport, because that is the only width where either is a bug.
 */

test.use({ viewport: { width: 390, height: 780 } })

const progressRow = (page: Page) =>
  page.getByRole('progressbar', { name: 'Progress through the book' }).locator('..')

const prose = (page: Page) => page.locator('[data-scene-event-id] p').first()

/**
 * By URL rather than by the nav. At phone width the navigation is a drawer, so
 * clicking the Read link waits on a control that is not on screen — the first
 * version of this timed out there rather than testing anything.
 */
async function openBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the progress line never ends on a separator pointing at nothing', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const text = (await progressRow(page).innerText()).replace(/\s+/g, ' ').trim()
  expect(text, `row read: ${text}`).toMatch(/of the book/)
  expect(text, 'no dangling separator').not.toMatch(/·\s*$/)
  // And no doubled one where the row wraps.
  expect(text, 'no separator with nothing between it and the next').not.toMatch(/·\s*·/)
})

test('line spacing is reachable on a phone, and changes the prose', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const lineHeight = () => prose(page).evaluate((el) =>
    getComputedStyle(el.parentElement as HTMLElement).lineHeight)

  const before = await lineHeight()
  const spacing = page.getByRole('button', { name: /^Line spacing:/ })
  await expect(spacing, 'the control exists at phone width').toBeVisible()

  await spacing.click()
  await expect.poll(lineHeight, { timeout: 10_000 }).not.toBe(before)

  // It cycles rather than dead-ending: three presses from any start returns.
  await spacing.click()
  await spacing.click()
  expect(await lineHeight(), 'three steps come back round').toBe(before)
})

test('the wide screen keeps the three named buttons', async ({ page }) => {
  /*
    The presence beside the absence. The narrow control is a compromise for
    width; where there is room the reader should see all three states at once
    rather than pressing to discover them — so "reachable on a phone" must not
    be satisfied by replacing the good control everywhere.
  */
  await page.setViewportSize({ width: 1280, height: 860 })
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  await expect(page.getByRole('button', { name: 'Snug' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Relaxed' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Airy' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Line spacing:/ }),
    'and not the cycling one as well, which would be two controls for one setting',
  ).toHaveCount(0)
})
