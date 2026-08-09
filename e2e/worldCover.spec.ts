import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

import { IMAGE_URL } from './helpers/imageUrl'

test.describe('World cover image', () => {
  test('links a cover in settings and shows it on the world card', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // A same-origin image the dev server actually serves, so it loads + measures.
    const imageUrl = IMAGE_URL

    // Set the cover from settings by linking a URL.
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Link cover image by URL' }).click()
    await page.getByPlaceholder('https://…/image.png').fill(imageUrl)
    await page.getByRole('button', { name: 'Add linked image' }).click()

    // The settings preview now renders the linked cover, fitted (not cropped)
    // into its box so nothing is cut off.
    const preview = page.locator(`img[src="${imageUrl}"]`).first()
    await expect(preview).toBeVisible()
    await expect(preview).toHaveCSS('object-fit', 'contain')

    // Removing clears it, then we re-add so the card assertion has something to show.
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.locator(`img[src="${imageUrl}"]`)).toHaveCount(0)
    await page.getByRole('button', { name: 'Link cover image by URL' }).click()
    await page.getByPlaceholder('https://…/image.png').fill(imageUrl)
    await page.getByRole('button', { name: 'Add linked image' }).click()
    await expect(page.locator(`img[src="${imageUrl}"]`).first()).toBeVisible()

    // Back on the world list, the card shows the cover thumbnail.
    await page.goto('/#/', { waitUntil: 'load' })
    await expect(page.locator(`img[src="${imageUrl}"]`).first()).toBeVisible()
  })
})
