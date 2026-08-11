import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MW-4: a region polygon writes its own name across the middle of what it
 * covers, and a location pin of the same name standing inside it writes the
 * name again on its pill — *Rohan* and *Rohan / Region*, overlapping in the
 * shipped Fellowship.
 *
 * The geometry is unit-tested in `src/features/maps/__tests__/labelDeclutter.test.ts`;
 * this checks the canvas is actually wired to it, and that the pin keeps
 * everything except the duplicated word.
 */
test('a pin inside a region of its own name does not say it twice', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Twice Named')
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

  // Two pins well apart — far enough that the ordinary overlap decluttering
  // leaves both labels alone, so the only thing that can take one away is the
  // region rule under test. Placing them close was the first version of this
  // test, and it passed with the fix disabled: Rohan's label was already gone
  // for the overlap reason and the surviving "Rohan" was the polygon's.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      mapLayers: { toArray: () => Promise<{ id: string; worldId: string }[]> }
      locationMarkers: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      mapRegions: { add: (v: unknown) => Promise<unknown> }
    }
    const [layer] = await db.mapLayers.toArray()
    const now = Date.now()
    const base = {
      worldId: layer.worldId, mapLayerId: layer.id, linkedMapLayerId: null,
      iconType: 'region', tags: [], factionId: null, imageId: null,
      createdAt: now, updatedAt: now,
    }
    await db.locationMarkers.bulkAdd([
      { ...base, id: 'marker-rohan', name: 'Rohan', x: 120, y: 120 },
      { ...base, id: 'marker-edoras', name: 'Edoras', x: 460, y: 460, iconType: 'city' },
    ])
    await db.mapRegions.add({
      id: 'region-rohan', worldId: layer.worldId, mapLayerId: layer.id, name: 'Rohan',
      vertices: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 }],
      fillColor: '#7c9a6a', opacity: 0.4, linkedMapLayerId: null, factionId: null,
      createdAt: now, updatedAt: now,
    })
  })
  await page.waitForTimeout(2500)

  const canvasText = () => page.evaluate(() => {
    const root = document.querySelector('.leaflet-container')
    if (!root) return null
    const count = (word: string) =>
      Array.from(root.querySelectorAll('*'))
        .filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() === word).length
    return {
      rohan: count('Rohan'),
      edoras: count('Edoras'),
      pins: root.querySelectorAll('.leaflet-marker-icon').length,
    }
  })

  // "Rohan" is written once — by the region across the area it covers.
  await expect.poll(canvasText, { timeout: 20_000 })
    .toMatchObject({ rohan: 1 })

  const shown = await canvasText()
  // The pin is still there: it kept its dot, its click target and its position.
  expect(shown!.pins, 'both pins still render').toBeGreaterThanOrEqual(2)
  // And a neighbour the region does not name keeps its own label, so this is
  // not simply "labels are off inside regions".
  expect(shown!.edoras, 'Edoras is not a duplicate, so it keeps its name').toBe(1)
})
