import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * SB-1: the map sidebar's six sections sat in one unbounded scroll, so opening
 * Items (18 rows) pushed Map Layers, Characters and Locations off the top of
 * the column entirely. Measured before the fix, on this fixture, four of the
 * six headers were outside the sidebar's own box — the third section you wanted
 * was unreachable without hunting.
 *
 * The column is a panel stack now: headers never move, only the bodies give
 * way, and each body scrolls inside itself.
 */
test.describe('The map sidebar is a panel stack', () => {
  test.describe.configure({ timeout: 180_000 })

  test('every section header stays in the column, however much is open', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Crowded Sidebar')
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
    await page.waitForTimeout(1500)

    // The review's world: 29 locations, 45 characters, 18 items. Enough that any
    // two open sections used to bury the rest.
    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
        locationMarkers: { bulkAdd: (v: unknown[]) => Promise<unknown> }
        characters: { bulkAdd: (v: unknown[]) => Promise<unknown> }
        items: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      const now = Date.now()
      await db.locationMarkers.bulkAdd(Array.from({ length: 29 }, (_, i) => ({
        id: `loc-${i}`, worldId: layer.worldId, mapLayerId: layer.id,
        name: `Place Number ${i + 1}`, description: '', type: 'landmark',
        x: Number(layer.imageWidth) * (0.2 + (i % 6) * 0.1),
        y: Number(layer.imageHeight) * (0.2 + Math.floor(i / 6) * 0.1),
        factionId: null, linkedMapLayerId: null, iconType: 'city', color: null,
        createdAt: now, updatedAt: now,
      })))
      await db.characters.bulkAdd(Array.from({ length: 45 }, (_, i) => ({
        id: `chr-${i}`, worldId: layer.worldId, name: `Character Number ${i + 1}`,
        role: '', description: '', tags: [], portraitImageId: null,
        createdAt: now, updatedAt: now,
      })))
      await db.items.bulkAdd(Array.from({ length: 18 }, (_, i) => ({
        id: `itm-${i}`, worldId: layer.worldId, name: `Artefact Number ${i + 1}`,
        description: '', type: 'object', tags: [], imageId: null, isCollective: false,
        createdAt: now, updatedAt: now,
      })))
      return true
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(2500)

    // Open the four that ship closed, so all six sections are expanded at once.
    for (const name of [/^Locations/i, /^Items/i, /^Routes/i, /^Regions/i]) {
      await page.getByRole('button', { name }).first().click()
    }
    await page.waitForTimeout(600)

    const measured = await page.evaluate(() => {
      const body = document.querySelector('[data-sidebar-section-body]')
      if (!body?.parentElement) return null
      const col = body.parentElement
      const cr = col.getBoundingClientRect()
      const headers = [...col.querySelectorAll('button[aria-expanded]')]
      return {
        headers: headers.map((h) => ({
          text: (h.textContent ?? '').trim(),
          inside: h.getBoundingClientRect().top >= cr.top - 1
            && h.getBoundingClientRect().bottom <= cr.bottom + 1,
        })),
        // A body that holds more than it shows must be able to show the rest.
        bodiesScrollTheirOwnContent: [...col.querySelectorAll('[data-sidebar-section-body]')]
          .filter((b) => b.scrollHeight > b.clientHeight + 1)
          .map((b) => getComputedStyle(b).overflowY),
      }
    })

    // Presence: all six sections are really there and expanded, so the absence
    // below cannot pass on a sidebar that failed to render.
    expect(measured, 'the sidebar should have rendered').not.toBeNull()
    expect(measured!.headers.map((h) => h.text.replace(/\d+$/, ''))).toEqual(
      ['Map Layers', 'Characters', 'Locations', 'Items', 'Routes', 'Regions'],
    )

    // Absence: not one of them has been pushed out of the column.
    const outside = measured!.headers.filter((h) => !h.inside).map((h) => h.text)
    expect(outside, `section headers pushed out of the sidebar: ${outside.join(', ')}`).toEqual([])

    // And a section too tall for its share scrolls rather than being clipped.
    expect(measured!.bodiesScrollTheirOwnContent.length,
      'the seeded lists should overflow their share').toBeGreaterThan(0)
    expect(new Set(measured!.bodiesScrollTheirOwnContent)).toEqual(new Set(['auto']))

    // The bottom section is not just measurably present, it is usable: closing
    // Regions and reopening it works without any scrolling first.
    const regions = page.getByRole('button', { name: /^Regions/i }).first()
    await expect(regions).toHaveAttribute('aria-expanded', 'true')
    await regions.click()
    await expect(regions).toHaveAttribute('aria-expanded', 'false')
  })
})
