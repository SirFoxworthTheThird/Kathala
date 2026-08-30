import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { waitForMapReady } from './helpers/map'

import { IMAGE_URL } from './helpers/imageUrl'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

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
const IMAGE = IMAGE_URL

const lightbox = (page: import('@playwright/test').Page) => page.getByTestId('image-lightbox')

test.describe('Opening images full size', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Gallery World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
  })

  /** Attach an image through the link-by-URL popover the detail screens expose. */
  /**
   * `triggerLabel` is the control that opens the URL popover. The character
   * portrait's is inside its menu now (CH-5) — two 10px icons on the avatar's
   * bottom edge became one named trigger — so a menu label is opened first and
   * "Link by URL" chosen inside it.
   */
  async function linkImage(page: import('@playwright/test').Page, triggerLabel: string) {
    if (triggerLabel.startsWith('Portrait for ')) {
      await page.getByRole('button', { name: triggerLabel }).click()
      await page.getByRole('menuitem', { name: 'Link by URL' }).click()
    } else {
      await page.getByRole('button', { name: triggerLabel }).click()
    }
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

    await linkImage(page, 'Portrait for Aria')

    // Nothing is showing until it is asked for — the other half of the assertion
    // below, so neither can pass vacuously.
    await expect(lightbox(page)).toHaveCount(0)

    // Exact: the header also carries "More actions for Aria" now (CH-4), and a
    // substring match would find both.
    await page.getByRole('button', { name: 'Aria', exact: true }).click()
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
    await linkImage(page, 'Portrait for Aria')

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

  test('opens the portrait in the map character panel', async ({ page }) => {
    // The map's panel is the one place a portrait is shown large but sits on a
    // floating surface over a canvas, so it is worth driving rather than
    // assuming it behaves like the detail screens.
    test.setTimeout(180_000)

    await page.getByRole('link', { name: /characters/i }).click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Frodo')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await page.getByText('Frodo').first().click()
    await linkImage(page, 'Portrait for Frodo')

    await page.getByRole('link', { name: /maps/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)

    await page.getByRole('button', { name: 'Location', exact: true }).click()
    await page.locator('.leaflet-container').click({ position: { x: 300, y: 250 } })
    await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Location' }).last().click()

    // Placing someone writes a snapshot against the cursor, so there has to be
    // an event for the cursor to be on.
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('The Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settleNav(page)
    await page.getByTitle('The Departure', { exact: true }).click()

    await page.getByRole('link', { name: /maps/i }).first().click()
    await settleNav(page)
    await waitForMapReady(page)
    await page.getByText('Rivendell').first().click()
    await page.getByRole('button', { name: 'Add character here' }).click()
    await page.getByRole('button', { name: 'Choose character...' }).click()
    await page.getByRole('option', { name: 'Frodo' }).click()
    await page.getByRole('button', { name: 'Close location panel' }).click()

    await page.locator('.leaflet-marker-icon').filter({ hasText: 'Frodo' }).first().click()
    await expect(page.getByRole('button', { name: 'Close character panel' })).toBeVisible()

    await expect(lightbox(page)).toHaveCount(0)
    // The portrait in the panel, not the map pin — the pin draws the same
    // picture and is a different control entirely.
    await page.locator(`img[alt="Frodo"][role="button"]`).click()
    await expect(lightbox(page)).toBeVisible()
    await expect(lightbox(page).locator(`img[src="${IMAGE}"]`)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(lightbox(page)).toHaveCount(0)
    // The panel it was opened from is still there underneath.
    await expect(page.getByRole('button', { name: 'Close character panel' })).toBeVisible()
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
