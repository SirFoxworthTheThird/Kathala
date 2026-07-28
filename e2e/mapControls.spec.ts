import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { openMapTools, waitForMapReady } from './helpers/map'

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

// The map's controls float over the canvas rather than sitting in header rows,
// so the canvas can run edge to edge. These tests cover the layout consequence
// (no chrome above the canvas), the overflow menu that holds the rare commands,
// and the scale-gated Measure button.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

async function setupMap(page: Page, opts: { withCharacter?: boolean } = {}) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Cartography')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  if (opts.withCharacter) {
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Frodo')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Frodo')).toBeVisible()
  }

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
  // …and the map's identity moved to the TopBar breadcrumb, so the canvas
  // doesn't give up a corner to a name chip.
  await expect(page.getByRole('banner').getByText('Middle Earth')).toBeVisible()
})

test('the breadcrumb names the open map layer and its scale', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  const banner = page.getByRole('banner')
  await expect(banner.getByText('Middle Earth')).toBeVisible()
  // No scale set yet, so no scale segment.
  await expect(banner.getByText(/= \d+ px/)).toHaveCount(0)

  await page.evaluate(async () => {
    const db = (window as { __pwdb?: any }).__pwdb
    const layers = await db.mapLayers.toArray()
    await db.mapLayers.update(layers[0].id, { scalePixelsPerUnit: 4, scaleUnit: 'km' })
  })
  await expect(banner.getByText('· 1 km = 4 px')).toBeVisible()

  // It is scoped to the map: leaving the view drops the layer segment.
  await page.getByRole('link', { name: /characters/i }).first().click()
  await settleNav(page)
  await expect(banner.getByText('Middle Earth')).toHaveCount(0)
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

test('clicking a character keeps its panel, film strip and zoom all usable', async ({ page }) => {
  test.setTimeout(150000)
  await setupMap(page, { withCharacter: true })

  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await expect(page.getByText('Click on the map to place the location')).toBeVisible()
  await page.locator('.leaflet-container').click({ position: { x: 300, y: 250 } })
  await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
  await page.getByRole('button', { name: 'Add Location' }).last().click()

  // A chapter *and* event: the film strip is built from events, so a chapter
  // alone leaves it empty.
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
  await page.getByPlaceholder('Event title').fill('The Departure')
  await page.getByRole('button', { name: 'Add Event' }).last().click()

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

  // Click Frodo's pin: this opens the snapshot panel AND the film strip, the
  // one place on the map where three floating surfaces share the canvas.
  await page.locator('.leaflet-marker-icon').filter({ hasText: 'Frodo' }).first().click()
  const strip = page.locator('[data-film-strip] .absolute.bottom-0')
  await expect(page.getByRole('button', { name: 'Close character panel' })).toBeVisible()
  await expect(strip).toBeVisible()

  // The toolbar stays reachable beside the panel rather than under it, and the
  // film strip is not clipped by the panel.
  await expect(page.getByRole('button', { name: 'Map tools' })).toBeVisible()
  const clipped = await page.evaluate(() => {
    const el = document.querySelector('[data-film-strip] .absolute.bottom-0') as HTMLElement
    const b = el.getBoundingClientRect()
    const top = document.elementFromPoint(b.right - 40, b.y + b.height / 2)
    return !el.contains(top)
  })
  expect(clipped).toBe(false)

  // Both zoom buttons sit above the strip rather than behind it.
  for (const [selector, label] of [
    ['.leaflet-control-zoom-in', 'Zoom in'],
    ['.leaflet-control-zoom-out', 'Zoom out'],
  ] as const) {
    const box = (await page.locator(selector).boundingBox())!
    const topmost = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y)
        // Leaflet nests a <span> inside the control's <a>.
        return el?.closest('a')?.getAttribute('aria-label') ?? el?.tagName ?? null
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    )
    expect(topmost).toBe(label)
  }
})

// The controls overlay the top of the canvas, so anything that works by
// clicking the map — placing a location or label, drawing a route or region,
// calibrating a scale — has to be able to reach the pixels underneath them.

test('a location can be placed under the floating controls', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  const canvas = page.locator('.leaflet-container')
  const cb = (await canvas.boundingBox())!
  // Right where the Show chips sit, which would otherwise swallow the click.
  const under = { x: 60, y: 62 }

  await page.getByRole('button', { name: 'Location', exact: true }).click()
  await expect(page.getByText('Click on the map to place the location')).toBeVisible()
  await page.mouse.click(cb.x + under.x, cb.y + under.y)

  await expect(page.getByPlaceholder('e.g. Thornwall City')).toBeVisible()
  await page.getByPlaceholder('e.g. Thornwall City').fill('Under The Chips')
  await page.getByRole('button', { name: 'Add Location' }).last().click()
  await expect(page.getByText('Under The Chips').first()).toBeVisible()
})

test('a region can take vertices under the floating controls', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  const cb = (await page.locator('.leaflet-container').boundingBox())!
  await page.getByRole('button', { name: 'Open map panels' }).click({ timeout: 3000 }).catch(() => {})
  await page.getByRole('button', { name: /REGIONS/i }).first().click()
  await page.getByRole('button', { name: 'New region' }).click()

  // Four vertices, two of them inside the band the controls occupy. The draw
  // HUD's live point count is the check: a swallowed click never arrives.
  for (const p of [{ x: 60, y: 62 }, { x: 320, y: 30 }, { x: 320, y: 300 }, { x: 60, y: 300 }]) {
    await page.mouse.click(cb.x + p.x, cb.y + p.y)
    await page.waitForTimeout(200)
  }
  await expect(page.getByText('4 points')).toBeVisible()

  // Escape backs out — the draw HUD goes away and the controls come back.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Drawing region — click map to place vertices')).toHaveCount(0)
  await openMapTools(page)
  await expect(page.getByRole('button', { name: 'Add level' })).toBeVisible()
})

test('Escape cancels a canvas-click mode and restores the controls', async ({ page }) => {
  test.setTimeout(120000)
  await setupMap(page)

  await page.getByRole('button', { name: 'Location', exact: true }).click()
  const banner = page.getByText('Click on the map to place the location')
  await expect(banner).toBeVisible()

  // While placing, the controls are click-through so the canvas underneath is
  // reachable; the toolbar itself must not answer a click.
  const toolsBox = (await page.getByRole('button', { name: 'Map tools' }).boundingBox())!
  const hits = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      return !!el?.closest('[aria-label="Map tools"]')
    },
    { x: toolsBox.x + toolsBox.width / 2, y: toolsBox.y + toolsBox.height / 2 },
  )
  expect(hits).toBe(false)

  await page.keyboard.press('Escape')
  await expect(banner).toHaveCount(0)
  await openMapTools(page)
  await expect(page.getByRole('button', { name: 'Add level' })).toBeVisible()
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
  await expect(page.getByRole('banner').getByText('· 1 km = 4 px')).toBeVisible()
})
