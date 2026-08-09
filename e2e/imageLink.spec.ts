import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

import { IMAGE_URL } from './helpers/imageUrl'

test.describe('Linking images by URL', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Image World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aria')).toBeVisible()
  })

  test('sets a character portrait from an image URL', async ({ page }) => {
    // Open the character's detail page.
    await page.getByText('Aria').first().click()
    await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+/)

    // A same-origin image the dev server actually serves, so it loads + measures.
    const imageUrl = IMAGE_URL

    await page.getByRole('button', { name: 'Link portrait by URL' }).click()

    // The popover must stay within the viewport (it opens rightward from the
    // portrait, which sits near the left edge).
    const field = page.getByPlaceholder('https://…/image.png')
    const box = await field.boundingBox()
    const viewport = page.viewportSize()!
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)

    await field.fill(imageUrl)
    await page.getByRole('button', { name: 'Add linked image' }).click()

    // The portrait now renders from the linked URL.
    await expect(page.locator(`img[src="${imageUrl}"]`).first()).toBeVisible()
  })
})
