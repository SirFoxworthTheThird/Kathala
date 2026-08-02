import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Cover art on the Library cards.
 *
 * The covers are real remote URLs, so the bytes are stubbed here rather than
 * fetched: the app still asks for the exact URL the manifest names, and the
 * test stays about our rendering instead of somebody else's uptime. The
 * failure case is driven the same way, by refusing the request.
 */

const COVER_HOSTS = /upload\.wikimedia\.org|commons\.wikimedia\.org|static\.posters\.cz/

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
  <rect width="400" height="600" fill="#6d5f8f"/>
</svg>`

/** Serve stand-in bytes for every remote cover. */
async function serveCovers(page: Page) {
  await page.route(COVER_HOSTS, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PLACEHOLDER }))
}

async function openLibrary(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
}

test('shows cover art for the books that link one', async ({ page }) => {
  await serveCovers(page)
  await openLibrary(page)

  // Dracula's cover is a linked URL, so it is drawn.
  const dracula = page.locator('li', { hasText: 'Dracula' }).first()
  const cover = dracula.getByRole('img', { name: /Dracula cover/ })
  await expect(cover).toBeVisible()
  await expect.poll(() => cover.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  // The Name of the Wind has no cover to link, and its card is text — the
  // pairing is the point, since "an image is present" proves nothing about
  // whether the right cards get one.
  const notw = page.locator('li', { hasText: 'The Name of the Wind' }).first()
  await expect(notw).toContainText('Patrick Rothfuss')
  await expect(notw.locator('img')).toHaveCount(0)
})

test('a cover that will not load takes itself off the card', async ({ page }) => {
  // These point at other people's servers, so this is the ordinary case in a
  // few years, not an edge one.
  await page.route(COVER_HOSTS, (route) => route.abort())
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
