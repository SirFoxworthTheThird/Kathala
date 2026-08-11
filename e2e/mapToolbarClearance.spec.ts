import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MAP-2: the floating toolbar sits on top of the canvas, and the map was fitted
 * edge to edge, so a marker near the top of the image opened underneath it —
 * the finding names a marker and its label in the top-right corner.
 *
 * Measured as geometry rather than looked at: the marker's box and the toolbar
 * band's box must not intersect. The same read is taken for a marker in the
 * middle of the map, which is never under the band either way — so a fit that
 * silently stopped happening at all could not satisfy both halves.
 */
test('a marker at the top of the map opens clear of the toolbar', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Clearance')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /maps/i }).first().click()
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)

  // One marker in the very top-right of the image — the corner the finding
  // names — and one in the middle for the paired read.
  const size = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      mapLayers: { toArray: () => Promise<{ id: string; worldId: string; imageWidth: number; imageHeight: number }[]> }
      locationMarkers: { bulkAdd: (v: unknown[]) => Promise<unknown> }
    }
    const [layer] = await db.mapLayers.toArray()
    const now = Date.now()
    const base = {
      worldId: layer.worldId, mapLayerId: layer.id, linkedMapLayerId: null,
      iconType: 'city', tags: [], factionId: null, imageId: null,
      createdAt: now, updatedAt: now,
    }
    await db.locationMarkers.bulkAdd([
      // CRS.Simple puts y=0 at the bottom, so the top of the image is y =
      // imageHeight. Placing this at y=20 put it at the foot of the screen,
      // where the band never was — which is how the first version of this test
      // passed with the fix reverted.
      { ...base, id: 'mk-top', name: 'Northmost', x: layer.imageWidth - 40, y: layer.imageHeight - 20 },
      { ...base, id: 'mk-mid', name: 'Midpoint', x: layer.imageWidth / 2, y: layer.imageHeight / 2 },
    ])
    return { w: layer.imageWidth, h: layer.imageHeight }
  })
  expect(size.w, 'the seeded layer should have real dimensions').toBeGreaterThan(0)

  await page.reload({ waitUntil: 'load' })
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(3000)

  const geometry = await page.evaluate(() => {
    const band = document.querySelector('[data-map-overlay="top"]')
    const boxOf = (name: string) => {
      const el = Array.from(document.querySelectorAll('.leaflet-marker-icon'))
        .find((m) => (m.textContent ?? '').includes(name))
      return el ? el.getBoundingClientRect() : null
    }
    const r = (b: DOMRect | null) => b && { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }
    return {
      band: r(band ? band.getBoundingClientRect() : null),
      top: r(boxOf('Northmost')),
      mid: r(boxOf('Midpoint')),
    }
  })

  expect(geometry.band, 'the toolbar band should be on screen').not.toBeNull()
  expect(geometry.top, 'the top marker should be rendered').not.toBeNull()
  expect(geometry.mid, 'the middle marker should be rendered').not.toBeNull()

  const overlaps = (a: NonNullable<typeof geometry.top>, b: NonNullable<typeof geometry.band>) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

  const band = geometry.band!
  expect(
    overlaps(geometry.top!, band),
    `top marker ${JSON.stringify(geometry.top)} vs toolbar ${JSON.stringify(band)}`,
  ).toBe(false)
  // The paired read: a marker the band was never over is still on the map, so
  // this cannot be passing because nothing rendered.
  expect(overlaps(geometry.mid!, band)).toBe(false)
  expect(geometry.mid!.top).toBeGreaterThan(band.bottom)
})
