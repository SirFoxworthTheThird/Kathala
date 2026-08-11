import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

async function uploadMap(page: import('@playwright/test').Page, name: string) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
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
}

/**
 * MW-1 was filed before the label declutter landed (#186 came after #185), so
 * this pins the property rather than re-fixing it: however many locations are
 * crowded together, no two labels that are actually drawn may overlap.
 */
test.describe('Map labels and scale', () => {
  test.describe.configure({ timeout: 180_000 })

  test('MW-1: crowded locations never draw two labels on top of each other', async ({ page }) => {
    await uploadMap(page, 'Crowded')

    // Twenty markers within a small patch of the map — the situation the review
    // saw, where Trollshaws / Rivendell / High Pass stacked on one another.
    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
        locationMarkers: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      const names = ['Trollshaws', 'Rivendell', 'High Pass', 'The Bruinen Ford', 'Dimrill Dale',
        'Lothlórien', 'Dol Guldur', 'Weathertop', 'The Last Bridge', 'Mirkwood',
        'Carrock', 'Beorn Hall', 'Gladden Fields', 'Anduin', 'Mount Gundabad',
        'Ettenmoors', 'Hoarwell', 'Mitheithel', 'Angmar', 'Fornost']
      await db.locationMarkers.bulkAdd(names.map((name, i) => ({
        id: `loc-${i}`, worldId: layer.worldId, mapLayerId: layer.id,
        name, description: '', type: 'landmark',
        // A tight cluster: 20 markers inside a fifth of the image.
        x: Number(layer.imageWidth) * (0.35 + (i % 5) * 0.03),
        y: Number(layer.imageHeight) * (0.35 + Math.floor(i / 5) * 0.03),
        factionId: null, linkedMapLayerId: null, iconType: 'landmark', color: null,
        createdAt: Date.now(), updatedAt: Date.now(),
      })))
      return names.length
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(20)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(2500)

    const boxes = await page.locator('.leaflet-marker-icon').evaluateAll((els) =>
      els
        .map((e) => {
          const label = e.querySelector('div:not(:empty)')
          const r = (label ?? e).getBoundingClientRect()
          return { text: (e.textContent || '').trim(), x: r.x, y: r.y, w: r.width, h: r.height }
        })
        .filter((b) => b.text && b.w > 0 && b.h > 0),
    )

    // Presence: markers are on the map and some of them are labelled, so the
    // absence below cannot pass because nothing rendered.
    expect(boxes.length, 'some markers should carry labels').toBeGreaterThan(0)

    const overlaps: string[] = []
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
          overlaps.push(`${a.text} ↔ ${b.text}`)
        }
      }
    }
    expect(overlaps, `labels drawn on top of each other:\n${overlaps.join('\n')}`).toEqual([])
  })

  test('MW-2: setting a scale says what it makes the whole map', async ({ page }) => {
    // The bundled Fellowship map was calibrated at 1.94 px per km, making Middle
    // Earth 822 km across — a fifth of what its own printed bar says, in the
    // wrong unit. "100 km between two points" looks reasonable on its own; only
    // the total gives it away, so the dialog now shows the total. (That layer
    // has since been re-measured off its bar and corrected under MW-9; the
    // dialog is what would have caught it at the time, which is why it is here.)
    await uploadMap(page, 'Scaled')

    await page.getByRole('button', { name: 'Map tools' }).click()
    await page.getByRole('button', { name: 'Set map scale' }).click()

    const canvas = (await page.locator('.leaflet-container').boundingBox())!
    await page.mouse.click(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.5)
    await page.mouse.click(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.5)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText('That makes the whole map')

    // The total tracks the number typed: saying the same two points are ten
    // times further apart makes the whole map ten times bigger.
    await dialog.getByLabel('Distance').fill('100')
    const at100 = (await dialog.innerText()).match(/whole map\s+([\d.]+)\s*km/)
    await dialog.getByLabel('Distance').fill('10')
    const at10 = (await dialog.innerText()).match(/whole map\s+([\d.]+)\s*km/)
    expect(at100, 'an extent should be shown for 100').not.toBeNull()
    expect(at10, 'an extent should be shown for 10').not.toBeNull()
    expect(Number(at100![1])).toBeGreaterThan(Number(at10![1]) * 5)

    // And it is stated in the unit chosen, not a fixed one.
    await dialog.getByLabel('Unit').click()
    await page.getByRole('option', { name: 'miles' }).click()
    await expect(dialog).toContainText(/whole map\s+[\d.]+\s*miles/)
  })
})
