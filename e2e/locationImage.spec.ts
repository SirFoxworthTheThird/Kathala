import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'
import { waitForMapReady } from './helpers/map'

/**
 * A picture of a place.
 *
 * A location already had two visuals — the pin's `iconType`, and a sub-map you
 * drill into — but nothing that shows what the place *looks* like. This covers
 * the third: attaching one, seeing it, opening it, and taking it away again.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

// Served by the dev server itself, so it genuinely loads and measures.
const IMAGE = 'http://localhost:5173/favicon.png'

test.describe('A location picture', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000)
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Cartography')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

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
    // Creating it does not open it — the panel is a click away, on the pin or
    // the sidebar entry.
    await page.getByText('Rivendell').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()
  })

  /** Attach a picture through the link-by-URL popover on the location panel. */
  async function linkPicture(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Link location image by URL' }).click()
    await page.getByPlaceholder('https://…/image.png').fill(IMAGE)
    await page.getByRole('button', { name: 'Add linked image' }).click()
  }

  test('offers a labelled way in when there is no picture yet', async ({ page }) => {
    // The first version of this shipped with the controls copied from the
    // character panel: a tiny icon pill in the corner of the empty box. On a
    // 48px avatar that reads fine; on a 128px empty banner it is a speck
    // nobody finds, and nobody did. Empty and filled are drawn differently now,
    // and this is the half that says so.
    await expect(page.getByText('No picture of this place yet')).toBeVisible()
    // Both controls carry visible text here, which is the whole point — the
    // upload one is a <label> wrapping the file input, so it is matched by that
    // text rather than by a button role it does not have.
    await expect(page.getByText('Upload', { exact: true })).toBeVisible()
    const link = page.getByRole('button', { name: 'Link location image by URL' })
    await expect(link).toBeVisible()
    await expect(link).toHaveText(/Link/)

    await linkPicture(page)
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()

    // Once there is something to look at, the invitation gets out of its way —
    // the controls shrink into the corner of the picture instead.
    await expect(page.getByText('No picture of this place yet')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Link location image by URL' })).not.toHaveText(/Link/)
  })

  test('is attached, shown on the panel, and opens full size', async ({ page }) => {
    // Nothing to show yet — the other half of the assertion below, so neither
    // can pass for the wrong reason.
    await expect(page.locator(`img[src="${IMAGE}"]`)).toHaveCount(0)

    await linkPicture(page)
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()

    await expect(page.getByTestId('image-lightbox')).toHaveCount(0)
    await page.getByRole('button', { name: 'Rivendell', exact: true }).click()
    await expect(page.getByTestId('image-lightbox')).toBeVisible()
    await expect(page.getByTestId('image-lightbox').locator(`img[src="${IMAGE}"]`)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('image-lightbox')).toHaveCount(0)
    // The panel it was opened from is still there underneath.
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()
  })

  test('survives closing and reopening the location', async ({ page }) => {
    await linkPicture(page)
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()

    await page.getByRole('button', { name: 'Close location panel' }).click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toHaveCount(0)

    await page.getByText('Rivendell').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()
    // Reads back from the record rather than from panel state.
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()
  })

  test('can be taken away again', async ({ page }) => {
    await linkPicture(page)
    await expect(page.locator(`img[src="${IMAGE}"]`).first()).toBeVisible()
    // Removal is only offered once there is something to remove.
    const remove = page.getByRole('button', { name: 'Remove location image' })
    await expect(remove).toBeVisible()

    await remove.click()

    await expect(page.locator(`img[src="${IMAGE}"]`)).toHaveCount(0)
    // …and the control goes away with the picture, rather than lingering as a
    // button that does nothing.
    await expect(remove).toHaveCount(0)
    // The upload slot is still there, so the place can be given another one.
    await expect(page.getByRole('button', { name: 'Link location image by URL' })).toBeVisible()
  })
})
