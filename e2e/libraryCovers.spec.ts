import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { serveCovers, refuseCovers } from './helpers/covers'

/**
 * Cover art on the Library cards.
 *
 * The bytes are stubbed rather than fetched (`helpers/covers.ts`): the app
 * still asks for the exact URL the catalogue names, and the test stays about
 * our rendering instead of somebody else's uptime or art the suite does not
 * stage. The failure case is driven the same way, by refusing the request.
 */

async function openLibrary(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
}

test('shows cover art for the books that link one', async ({ page }) => {
  await serveCovers(page)
  await openLibrary(page)

  // Dracula links a cover, so it is drawn.
  const dracula = page.locator('li', { hasText: 'Dracula' }).first()
  const cover = dracula.getByRole('img', { name: /Dracula cover/ })
  await expect(cover).toBeVisible()
  // The cover is `loading="lazy"`, and with the shelf as long as it is now the
  // card starts below the fold, where the image is never asked for.
  await dracula.scrollIntoViewIfNeeded()
  await expect.poll(() => cover.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  /*
    The pairing is the point: "an image is present" proves nothing about whether
    the *right* cards get one.

    This half named *The Name of the Wind*, which **does** link a cover — the
    claim was false about the catalogue and passed only because that card sat
    where its lazy-loaded image had not been fetched yet. Reordering the
    catalogue alphabetically moved it and the test went red, which is the test
    doing its job late rather than a regression. Only two entries genuinely have
    no cover, both Tolkien, whose artwork lives inside the image bundle.
  */
  /*
    One tab across: the catalogue is split into what can be read and what
    cannot, and the two coverless worlds are both Tolkien — structure only, and
    not mounted until their shelf is open.
  */
  await page.getByRole('tab', { name: /Structure only/ }).click()
  const noCover = page.locator('li', { hasText: 'The Fellowship of the Ring' }).first()
  await expect(noCover).toContainText('J.R.R. Tolkien')
  await noCover.scrollIntoViewIfNeeded()
  await expect(noCover.locator('img')).toHaveCount(0)
})

test('a cover that will not load takes itself off the card', async ({ page }) => {
  // These point at other people's servers, so this is the ordinary case in a
  // few years, not an edge one.
  await refuseCovers(page)
  await openLibrary(page)

  const dracula = page.locator('li', { hasText: 'Dracula' }).first()
  await expect(dracula.locator('img')).toHaveCount(0)

  // The card still does its job: title, author, blurb and a way to download.
  await expect(dracula).toContainText('Bram Stoker')
  await expect(dracula.getByRole('button', { name: /^Download \(/ })).toBeVisible()
})

test('the cover does not get in the way of downloading', async ({ page }) => {
  await serveCovers(page)
  await openLibrary(page)

  const dracula = page.locator('li', { hasText: 'Dracula' }).first()
  await dracula.getByRole('button', { name: /^Download \(/ }).click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
})
