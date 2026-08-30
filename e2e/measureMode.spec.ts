import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MW-5: Measure did not take exclusive control of the canvas.
 *
 * Every overlay took its own clicks, so the first click of a measurement both
 * placed the point *and* selected the region polygon underneath, opening its
 * detail panel over the right of the map. That panel then covered the spot
 * meant for the second point and swallowed the click, so the measurement could
 * not be finished at all. A mode that says "click two points on the map" has to
 * own those two clicks.
 */
test.describe('Measure mode owns the canvas', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a region under the first point neither opens nor swallows the second', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Measuring')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    // A scale (so Measure is available) and one very large region covering the
    // whole image, so both measuring clicks land on top of it.
    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, number | string>[]>; update: (id: unknown, v: unknown) => Promise<unknown> }
        mapRegions: { add: (v: unknown) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      await db.mapLayers.update(layer.id, { scalePixelsPerUnit: 4, scaleUnit: 'km' })
      const w = Number(layer.imageWidth), h = Number(layer.imageHeight)
      await db.mapRegions.add({
        id: 'region-under', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'Wide Region', description: '',
        vertices: [{ x: 1, y: 1 }, { x: w - 1, y: 1 }, { x: w - 1, y: h - 1 }, { x: 1, y: h - 1 }],
        fillColor: '#22c55e', opacity: 0.5, factionId: null, linkedMapLayerId: null,
        createdAt: Date.now(), updatedAt: Date.now(),
      })
      return { w, h }
    })
    expect(seeded.w, 'the map should have loaded with dimensions').toBeGreaterThan(0)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    // Presence: with Measure off, the region is a normal control — clicking it
    // opens its panel. Without this the absence below could pass because the
    // region simply never rendered.
    const canvas = (await page.locator('.leaflet-container').boundingBox())!
    const p1 = { x: canvas.x + canvas.width * 0.35, y: canvas.y + canvas.height * 0.5 }
    const p2 = { x: canvas.x + canvas.width * 0.75, y: canvas.y + canvas.height * 0.5 }
    const regionPanel = page.getByRole('button', { name: 'Close region panel' })
    await page.mouse.click(p1.x, p1.y)
    await expect(regionPanel, 'clicking a region should normally open its panel').toBeVisible({ timeout: 10_000 })
    await regionPanel.click()
    await expect(regionPanel).toHaveCount(0)

    // Absence: with Measure armed, the same click measures and nothing else.
    await page.getByRole('button', { name: 'Measure' }).click()
    await page.mouse.click(p1.x, p1.y)
    await page.waitForTimeout(600)
    await expect(regionPanel,
      'the region panel should not open while measuring').toHaveCount(0)

    // And the second click lands, so the measurement completes — the part that
    // was impossible when the panel covered the spot.
    await page.mouse.click(p2.x, p2.y)
    await expect(page.getByText(/\d+(\.\d+)?\s*km/).first(),
      'a distance should be reported after two clicks').toBeVisible({ timeout: 10_000 })
  })
})
