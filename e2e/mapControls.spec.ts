import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { openMapTools, waitForMapReady } from './helpers/map'

// The map's controls float over the canvas rather than sitting in header rows,
// so the canvas can run edge to edge. These tests cover the layout consequence
// (no chrome above the canvas), the overflow menu that holds the rare commands,
// and the scale-gated Measure button.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

async function setupMap(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Cartography')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /maps/i }).first().click()
  await page.mouse.move(700, 400)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await expect(page.getByRole('heading', { name: /Upload Map/ })).toBeVisible()
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await waitForMapReady(page)
}

test('the canvas starts at the top of the map region, with controls floating over it', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  const canvas = page.locator('.leaflet-container')
  await expect(canvas).toBeVisible()

  // No header/filter/hint rows above the canvas: it begins where its container
  // begins, so every pixel of the region below the app chrome is map.
  const offset = await page.evaluate(() => {
    const el = document.querySelector('.leaflet-container') as HTMLElement
    const parent = el.parentElement as HTMLElement
    return el.getBoundingClientRect().top - parent.getBoundingClientRect().top
  })
  expect(offset).toBeLessThanOrEqual(1)

  // The two commands used while working a map are on the surface…
  await expect(page.getByRole('button', { name: 'Location', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Label', exact: true })).toBeVisible()
  // …and the map's identity is a floating chip rather than a header row.
  await expect(page.getByText('Middle Earth').last()).toBeVisible()
})

test('rare map commands live behind the overflow menu', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  const addLevel = page.getByRole('button', { name: 'Add level' })
  const replaceImage = page.getByRole('button', { name: 'Replace image' })
  await expect(addLevel).toHaveCount(0)
  await expect(replaceImage).toHaveCount(0)

  await openMapTools(page)
  for (const name of ['Add level', 'Replace image', 'Export as PNG', 'AI Locations', 'AI Moves']) {
    await expect(page.getByRole('button', { name })).toBeVisible()
  }

  // Choosing a command closes the menu so the canvas is clear for what follows.
  await page.getByRole('button', { name: 'Add level' }).click()
  await expect(page.getByLabel('Level name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replace image' })).toHaveCount(0)
})

test('an open detail panel does not sit under the floating toolbar', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  // Place a location and open its panel.
  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await expect(page.getByText('Click on the map to place the location')).toBeVisible()
  await page.locator('.leaflet-container').click({ position: { x: 300, y: 250 } })
  await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
  await page.getByRole('button', { name: 'Add Location' }).last().click()
  await page.getByText('Rivendell').first().click()

  const close = page.getByRole('button', { name: 'Close location panel' })
  await expect(close).toBeVisible()

  // The panel occupies the top-right corner the toolbar would otherwise use.
  // Its close button must be the thing at that point, not the "..." menu — and
  // the toolbar has to stay reachable rather than being buried underneath.
  const box = (await close.boundingBox())!
  const topmost = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return el?.closest('button')?.getAttribute('aria-label') ?? el?.tagName ?? null
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  )
  expect(topmost).toBe('Close location panel')

  await expect(page.getByRole('button', { name: 'Map tools' })).toBeVisible()
  await close.click()
  await expect(close).toHaveCount(0)
})

test('Measure surfaces only once the map has a scale', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  // Without a scale there is nothing to measure against, so the button stays in
  // the menu — disabled, next to the calibration entry that unlocks it.
  await expect(page.getByRole('button', { name: 'Measure' })).toHaveCount(0)
  await openMapTools(page)
  await expect(page.getByRole('button', { name: 'Set map scale' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Measure distance' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.mouse.click(700, 500)

  // Calibrate the layer directly — the calibration click flow is covered by the
  // scale tests; here we only care that the toolbar reacts to having a scale.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: any }).__pwdb
    const layers = await db.mapLayers.toArray()
    await db.mapLayers.update(layers[0].id, { scalePixelsPerUnit: 4, scaleUnit: 'km' })
  })

  await expect(page.getByRole('button', { name: 'Measure' })).toBeVisible()
  await expect(page.getByText('1 km = 4 px')).toBeVisible()
})
