import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * **R14.** The chapter bar dimmed unread chapters to 0.42 opacity and titled
 * them in full, all the way to the end of the book — and every scene inside
 * them was a `<button title={event.title}>`, so the whole plot sat in the
 * accessible names of the controls along the bottom of every screen. Dimming a
 * title you can still read is not hiding it, and this was the one ungated
 * surface left in reading mode.
 *
 * The reader's report: one click on the dimmed *"9 · Mina Murray's Journal"*
 * moved them to a scene called *"Jonathan and Mina Marry"*, and the reveal was
 * the click itself rather than the screen it landed on. So the titles are
 * withheld first, and the confirm is second — a confirm alone would be asking
 * about something already read.
 *
 * The bar only renders on the timeline screen, which is where these go.
 */

const bar = (page: Page) => page.locator('[data-chapter-bar]')

test.describe('Reading ahead in the chapter bar', () => {
  test.describe.configure({ timeout: 180_000 })

  async function openBar(page: Page) {
    await resetDB(page)
    const worldId = await downloadLibraryBook(page, DEFAULT_BOOK)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(bar(page)).toBeVisible({ timeout: 60_000 })
    await settle(page)
    return worldId
  }

  test('a chapter ahead keeps its number and loses its title', async ({ page }) => {
    const worldId = await openBar(page)

    // Reached: the chapter at the cursor is named, so this is not passing by
    // the bar being empty or unrendered.
    await expect(bar(page).locator('[title="Ch. 1 — The Boy Who Lived"]')).toBeVisible()
    await expect(bar(page)).toContainText('The Boy Who Lived')

    // Ahead: numbered, not named — and the scenes inside it are named by where
    // they are rather than by what happens in them.
    await expect(bar(page).locator('[title="Ch. 5 — not yet reached"]')).toBeVisible()
    await expect(bar(page)).not.toContainText('Diagon Alley')
    await expect(bar(page).locator('[title="Chapter 5, moment 1 — not yet reached"]')).toBeVisible()

    /*
      The pair. A writer is surveying their own draft and needs every title, so
      turning reading mode off must bring them all back — otherwise this test
      would pass just as well against a bar that had lost its titles entirely.
    */
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn off reading mode' }).click()
    await settle(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(bar(page)).toBeVisible({ timeout: 60_000 })
    await expect(bar(page)).toContainText('Diagon Alley')
  })

  test('a skip of two chapters asks first; the next chapter does not', async ({ page }) => {
    await openBar(page)
    const confirm = page.getByRole('heading', { name: /^Read ahead to chapter/ })

    // Three chapters forward: asked about, and answering "no" leaves the
    // reader exactly where they were.
    await bar(page).locator('[title="Ch. 4 — not yet reached"]').click()
    await expect(confirm).toHaveText('Read ahead to chapter 4?')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(bar(page).locator('[title="Ch. 4 — not yet reached"]')).toBeVisible()

    // And answering "yes" moves them, so the guard is a question rather than a
    // block.
    await bar(page).locator('[title="Ch. 4 — not yet reached"]').click()
    await page.getByRole('button', { name: 'Read ahead' }).click()
    await expect(bar(page).locator('[title="Ch. 4 — The Keeper of the Keys"]'))
      .toBeVisible({ timeout: 30_000 })

    /*
      The half that keeps this from being an interruption on every click:
      reading on into the next chapter is the ordinary move and is never
      questioned. Asserted with the move actually happening, so it cannot pass
      by the click doing nothing at all.
    */
    await bar(page).locator('[title="Ch. 5 — not yet reached"]').click()
    await expect(bar(page).locator('[title="Ch. 5 — Diagon Alley"]'))
      .toBeVisible({ timeout: 30_000 })
    await expect(confirm).toHaveCount(0)
  })
})
