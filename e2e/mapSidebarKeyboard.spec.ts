import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * The map sidebar's route and region rows, and the item row beside them, were
 * `div`s with click handlers — no role, no tab stop, no key handler. The review
 * recorded the consequence in prose rather than as a finding, which is how it
 * outlived **X-7**:
 *
 * > *"It is not reachable by role: measured, zero region rows respond to
 * > `role=button`… A keyboard user cannot open the region panel at all."*
 *
 * The location markers immediately above them were already buttons, so the same
 * sidebar was navigable in some rows and not others.
 *
 * Two things are pinned here. The row opens its panel from the keyboard, and
 * the delete beside it cannot be tapped while it is invisible — **LORE-1**
 * measured that exact shape (`opacity-0` with pointer events live, hit-testing
 * to itself) and found it worse than a permanent icon, because on a touch
 * device the resting state is the only state.
 */

async function mapWithRegion(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Reachable')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.getByRole('link', { name: /maps/i }).first().click()
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)

  const seeded = await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      mapLayers: { toArray: () => Promise<{ id: string }[]> }
      mapRegions: { add: (v: unknown) => Promise<unknown> }
      mapRoutes: { add: (v: unknown) => Promise<unknown> }
      characters: { add: (v: unknown) => Promise<unknown> }
    }
    const [layer] = await db.mapLayers.toArray()
    const now = Date.now()
    await db.characters.add({
      id: 'ch1', worldId: id, name: 'Tom Bombadil', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null,
      createdAt: now, updatedAt: now,
    })
    // Shapes are from `src/types/map.ts` — a region stores `vertices`, not
    // `points`, and getting that wrong crashes `MapExplorerView` outright
    // rather than merely producing a row that looks odd.
    await db.mapRegions.add({
      id: 'rg1', worldId: id, mapLayerId: layer.id, name: 'The Old Forest',
      vertices: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }],
      fillColor: '#22c55e', opacity: 0.3, notes: '',
      linkedMapLayerId: null, factionId: null, createdAt: now, updatedAt: now,
    })
    await db.mapRoutes.add({
      id: 'rt1', worldId: id, mapLayerId: layer.id, name: 'The Great East Road',
      routeType: 'road', color: '#a1a1aa', notes: '',
      waypoints: [{ x: 100, y: 100 }, { x: 400, y: 400 }],
      createdAt: now, updatedAt: now,
    })
    return layer.id
  }, worldId)
  expect(seeded, 'the seeding seam should be present in an e2e build').toBeTruthy()
  await page.waitForTimeout(800)

  // Routes and Regions are `defaultOpen={false}` — the sidebar's own headers
  // were already buttons, which is what made the rows inside them look fine.
  for (const section of ['Routes', 'Regions']) {
    await page.getByRole('button', { name: new RegExp(`^${section}`) }).first().click()
  }
  await page.waitForTimeout(400)
  return worldId
}

/*
 * Anchored, because the delete beside each row is named *after* that row —
 * `Delete region The Old Forest` contains `The Old Forest`, and `getByRole`
 * matches by substring, so the unanchored form resolves to two buttons. The
 * accessible name of a row starts with its own name.
 */
const REGION_ROW = /^The Old Forest/
const ROUTE_ROW = /^The Great East Road/

/** Give a control focus from the keyboard alone, without ever clicking it. */
async function tabTo(page: Page, name: RegExp | string, limit = 80): Promise<boolean> {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return true
  }
  return false
}

test.describe('The map sidebar is reachable from the keyboard', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a region row is a control, and Enter on it opens the panel', async ({ page }) => {
    await mapWithRegion(page)

    // Presence, as a role rather than as a div with a handler: the review's
    // measurement was "zero region rows respond to role=button".
    const row = page.getByRole('button', { name: REGION_ROW })
    await expect(row).toHaveCount(1)

    // Absence first: the panel is not open.
    await expect(page.getByRole('button', { name: /^Close .* panel$/ })).toHaveCount(0)

    // Reached and activated by keyboard alone — no click anywhere in this test.
    await page.locator('body').press('Tab')
    const reached = await tabTo(page, REGION_ROW)
    expect(reached, 'the region row should be a tab stop').toBe(true)
    await page.keyboard.press('Enter')

    // Presence: the panel a keyboard user could not open at all.
    await expect(page.getByRole('button', { name: /^Close .* panel$/ })).toHaveCount(1, { timeout: 15_000 })
  })

  test('the route row is one too, and its delete is named', async ({ page }) => {
    await mapWithRegion(page)

    const row = page.getByRole('button', { name: ROUTE_ROW })
    await expect(row).toHaveCount(1)

    // LORE-1: the delete had no accessible name at all, so a screen reader met
    // an unlabelled button beside every row.
    const del = page.getByRole('button', { name: 'Delete route The Great East Road' })
    await expect(del).toHaveCount(1)

    // …and it cannot be tapped while it is invisible. `pointer-events: none` at
    // rest is what stops a tap on apparently blank row deleting the route on a
    // touch device, where there is no hover to reveal it.
    const atRest = await del.evaluate((el) => ({
      opacity: getComputedStyle(el).opacity,
      pointerEvents: getComputedStyle(el).pointerEvents,
    }))
    expect(atRest.opacity).toBe('0')
    expect(atRest.pointerEvents, 'an invisible control must not hit-test').toBe('none')

    // Paired with the opposite condition, in the same test: hovering the row
    // brings it back, so this is "hidden until wanted", not "unreachable".
    await row.hover()
    await expect.poll(async () => del.evaluate((el) => getComputedStyle(el).pointerEvents))
      .toBe('auto')
    await expect(del).toBeVisible()
  })

  test('so is the character row, which X-7 named and then never counted', async ({ page }) => {
    await mapWithRegion(page)

    // The Characters section is open by default, so no header click is needed —
    // and an earlier check of this sidebar read "0 of 0 clickable divs" only
    // because the world it ran against had no cast at all. This one has one.
    const row = page.getByRole('button', { name: /^Tom Bombadil/ })
    await expect(row).toHaveCount(1)

    await page.locator('body').press('Tab')
    const reached = await tabTo(page, /^Tom Bombadil/)
    expect(reached, 'the character row should be a tab stop').toBe(true)

    // Dragging a character onto the map is how they get placed, and the drag
    // source is the nearest draggable ancestor — so it has to stay on the row
    // *around* the button, not move onto the button, or the crosshair beside it
    // would fall outside the draggable area. (The attribute reads `false` here
    // because there is no moment selected; what is pinned is where it lives.)
    const wrapsTheButton = await row.evaluate((el) => {
      const src = el.closest('[draggable]')
      return src !== null && src !== el
    })
    expect(wrapsTheButton, 'the drag source should be the row, not the button').toBe(true)
  })
})
