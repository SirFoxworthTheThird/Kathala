import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

/**
 * A map layer must open showing the whole map, at any window shape.
 *
 * Both `fitBounds` and `getBoundsZoom` clamp to the map's current minZoom, and
 * Leaflet's default is 0 — the zoom at which a CRS.Simple image draws 1:1. So
 * an image larger than its container could never be fitted: the fit clamped to
 * 0 and the map opened on the middle of the image. A desktop window hid it
 * (only the vertical overflow was cut); a 390px phone left three of five
 * markers off-screen entirely.
 *
 * Checked as geometry rather than a screenshot: the rendered image must sit
 * inside the Leaflet container on both axes. The narrow case is the regression;
 * the wide case runs beside it so a fit that silently stopped happening at all
 * could not satisfy both.
 */
test.describe('Map fit', () => {
  test.describe.configure({ timeout: 120_000 })

  async function buildMap(page: Page) {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Fit Test')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // By URL rather than the nav link: at phone width the rail collapses behind
    // a hamburger, and this test is about the map, not about reaching it.
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]
    await page.goto(`/#/worlds/${worldId}/maps`)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await expect(page.getByRole('heading', { name: /Upload Map/ })).toBeVisible()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByRole('heading', { name: /Upload Map/ })).not.toBeVisible()
    await expect(page.locator('.leaflet-image-layer')).toBeVisible({ timeout: 30_000 })
  }

  /** The rendered image box relative to the Leaflet container, once settled. */
  async function fitGeometry(page: Page) {
    await expect(page.locator('.leaflet-image-layer')).toBeVisible()
    await page.waitForTimeout(2500) // the fit is deferred a macro-task, then animates
    return page.evaluate(() => {
      const c = document.querySelector('.leaflet-container')!.getBoundingClientRect()
      const i = document.querySelector('.leaflet-image-layer')!.getBoundingClientRect()
      return {
        overflowRight: Math.round(i.right - c.right),
        overflowLeft: Math.round(c.left - i.left),
        overflowTop: Math.round(c.top - i.top),
        overflowBottom: Math.round(i.bottom - c.bottom),
      }
    })
  }

  for (const vp of [
    { label: 'a phone-width window', width: 390, height: 844 },
    { label: 'a desktop window', width: 1440, height: 900 },
  ]) {
    test(`shows the whole map in ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await buildMap(page)
      const g = await fitGeometry(page)

      // A couple of pixels of slack for sub-pixel rounding in Leaflet's transform.
      expect(g.overflowRight, `image overflows the container on the right by ${g.overflowRight}px`).toBeLessThanOrEqual(2)
      expect(g.overflowLeft, `image overflows the container on the left by ${g.overflowLeft}px`).toBeLessThanOrEqual(2)
      expect(g.overflowTop, `image overflows the container above by ${g.overflowTop}px`).toBeLessThanOrEqual(2)
      expect(g.overflowBottom, `image overflows the container below by ${g.overflowBottom}px`).toBeLessThanOrEqual(2)
    })
  }
})
