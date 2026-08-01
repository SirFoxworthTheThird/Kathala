import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * Opening a picture full size.
 *
 * Portraits and covers are held at up to 2048px and shown at 48px, so the point
 * of the feature is that the stored image can actually be looked at. What needs
 * guarding is not only that a lightbox opens, but that it opens *where the
 * image is the subject* and stays out of the way everywhere else — the same
 * portrait inside a character card belongs to a control that navigates, and
 * stealing that click would be a regression, not a feature.
 */

// Served by the dev server itself, so it genuinely loads and measures.
const IMAGE = 'http://localhost:5173/favicon.png'

const lightbox = (page: import('@playwright/test').Page) => page.getByTestId('image-lightbox')

test.describe('Opening images full size', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Gallery World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
  })

  /** Attach an image through the link-by-URL popover the detail screens expose. */
  async function linkImage(page: import('@playwright/test').Page, triggerLabel: string) {
    await page.getByRole('button', { name: triggerLabel }).click()
    await page.getByPlaceholder('https://…/image.png').fill(IMAGE)
    await page.getByRole('button', { name: 'Add linked image' }).click()
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()
  }

  test('opens a character portrait, and closes on Escape', async ({ page }) => {
    await page.getByRole('link', { name: /characters/i }).click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await page.getByText('Aria').first().click()
    await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+/)

    await linkImage(page, 'Link portrait by URL')

    // Nothing is showing until it is asked for — the other half of the assertion
    // below, so neither can pass vacuously.
    await expect(lightbox(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Aria' }).click()
    await expect(lightbox(page)).toBeVisible()
    // The picture in the overlay is the stored one, not a placeholder.
    await expect(lightbox(page).locator(`img[src="${IMAGE}"]`)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(lightbox(page)).toHaveCount(0)
  })

  test('makes the picture a control only where it is the subject', async ({ page }) => {
    await page.getByRole('link', { name: /characters/i }).click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await page.getByText('Aria').first().click()
    await linkImage(page, 'Link portrait by URL')

    // On the detail screen the portrait is the subject, so it is itself the
    // control that opens it.
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toHaveAttribute('role', 'button')

    // Back to the list, where the very same picture is drawn on the card — and
    // there it is only a label. The card around it is the control.
    await page.getByRole('link', { name: /characters/i }).click()
    await settleNav(page)
    const cardPortrait = page.locator(`img[src="${IMAGE}"]`).first()
    await expect(cardPortrait).toBeVisible()
    await expect(cardPortrait).not.toHaveAttribute('role', 'button')

    // Both halves are asserted here on purpose. Checking the *outcome* instead —
    // "no lightbox after clicking the card" — proved worthless: navigating away
    // unmounts the card, so its overlay vanishes whether or not it ever opened,
    // and the assertion passed with the lightbox wired to every portrait in the
    // app. The role attribute is the thing that actually differs.
    await cardPortrait.click()
    await expect(page).toHaveURL(/#\/worlds\/[^/]+\/characters\/[^/]+/)
  })

  test('opens an item image', async ({ page }) => {
    await page.getByTitle('Items').click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Excalibur')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await page.getByText('Excalibur').first().click()

    await linkImage(page, 'Link item image by URL')

    await expect(lightbox(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Excalibur' }).click()
    await expect(lightbox(page)).toBeVisible()
  })

  test('opens the world cover, and dismisses only from outside the picture', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).first().click()
    await settleNav(page)

    await linkImage(page, 'Link cover image by URL')

    await expect(lightbox(page)).toHaveCount(0)
    await page.getByRole('button', { name: /cover/i }).first().click()
    await expect(lightbox(page)).toBeVisible()

    // Clicking the picture is how someone looks closer, so it must not dismiss.
    await lightbox(page).locator('img').click()
    await expect(lightbox(page)).toBeVisible()

    // The space around it does. Click the top-left corner, well clear of both
    // the centred image and the close button in the opposite corner.
    await lightbox(page).click({ position: { x: 8, y: 8 } })
    await expect(lightbox(page)).toHaveCount(0)
  })
})
