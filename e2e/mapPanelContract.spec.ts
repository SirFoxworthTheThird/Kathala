import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * PAN-1: the four detail panels open on the same edge of the same screen by the
 * same gesture and disagreed about what a panel is. The character panel named
 * the moment in its header; the location panel's header said only *"Location"*,
 * and the route and region panels only *"Route"* and *"Region"*. The location
 * panel ended in a full-width saturated red **Delete Location** — louder than
 * the place's own name (LP-1) — while route and region used a quiet one and the
 * character panel had no delete at all.
 *
 * The contract now: the header names the thing, and a destructive action, where
 * there is one, is the quietest control on the panel.
 */

/** The panel header's own box, wherever it is on screen. */
function headerOf(page: Page, closeLabel: string) {
  return page.getByRole('button', { name: closeLabel }).locator('xpath=..')
}

async function setUpMap(page: Page, world: string) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(world)
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
}

test.describe('The four map panels share one contract', () => {
  test.describe.configure({ timeout: 180_000 })

  test('every panel header names the thing it opened on', async ({ page }) => {
    await setUpMap(page, 'Panel Contract')

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
        locationMarkers: { add: (v: unknown) => Promise<unknown> }
        mapRoutes: { add: (v: unknown) => Promise<unknown> }
        mapRegions: { add: (v: unknown) => Promise<unknown> }
        characters: { add: (v: unknown) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      const w = Number(layer.imageWidth), h = Number(layer.imageHeight)
      const now = Date.now()
      await db.locationMarkers.add({
        id: 'loc-riv', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'Rivendell', description: '', type: 'landmark',
        x: w * 0.3, y: h * 0.3, factionId: null, linkedMapLayerId: null,
        iconType: 'city', color: null, createdAt: now, updatedAt: now,
      })
      await db.mapRoutes.add({
        id: 'rt-1', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'The Great East Road', routeType: 'road', notes: '',
        waypoints: [{ x: w * 0.2, y: h * 0.5 }, { x: w * 0.7, y: h * 0.5 }],
        color: null, createdAt: now, updatedAt: now,
      })
      await db.mapRegions.add({
        id: 'rgn-1', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'The Trollshaws', notes: '',
        vertices: [{ x: w * 0.1, y: h * 0.1 }, { x: w * 0.2, y: h * 0.1 }, { x: w * 0.2, y: h * 0.2 }],
        fillColor: '#22c55e', opacity: 0.5, factionId: null, linkedMapLayerId: null,
        createdAt: now, updatedAt: now,
      })
      await db.characters.add({
        id: 'chr-frodo', worldId: layer.worldId, name: 'Frodo Baggins',
        role: '', description: '', tags: [], portraitImageId: null,
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    // ── Location ──
    await page.getByText('Rivendell').first().click()
    const locationHeader = headerOf(page, 'Close location panel')
    await expect(locationHeader).toBeVisible({ timeout: 10_000 })
    await expect(locationHeader).toContainText('Rivendell')
    // The kind is still stated — it just is not the whole header any more.
    await expect(locationHeader).toContainText(/city/i)
    await page.getByRole('button', { name: 'Close location panel' }).click()

    // ── Route ── opened from the sidebar, which is where routes are listed.
    await page.getByRole('button', { name: /^Routes/i }).first().click()
    await page.getByText('The Great East Road').first().click()
    const routeHeader = headerOf(page, 'Close route panel')
    await expect(routeHeader).toBeVisible({ timeout: 10_000 })
    await expect(routeHeader).toContainText('The Great East Road')
    await page.getByRole('button', { name: 'Close route panel' }).click()

    // ── Region ──
    await page.getByRole('button', { name: /^Regions/i }).first().click()
    await page.getByText('The Trollshaws').first().click()
    const regionHeader = headerOf(page, 'Close region panel')
    await expect(regionHeader).toBeVisible({ timeout: 10_000 })
    await expect(regionHeader).toContainText('The Trollshaws')
    await page.getByRole('button', { name: 'Close region panel' }).click()

    // ── Character ── the panel the others are held to. Its sidebar section
    // ships open, so clicking the header here would close it.
    await expect(page.getByRole('button', { name: /^Characters/i }).first())
      .toHaveAttribute('aria-expanded', 'true')
    await page.getByText('Frodo Baggins').first().click()
    const characterHeader = headerOf(page, 'Close character panel')
    await expect(characterHeader).toBeVisible({ timeout: 10_000 })
    await expect(characterHeader).toContainText('Frodo Baggins')
  })

  test('LP-1: delete is the quietest control on the location panel, not the loudest', async ({ page }) => {
    await setUpMap(page, 'Quiet Delete')

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
        locationMarkers: { add: (v: unknown) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      const now = Date.now()
      await db.locationMarkers.add({
        id: 'loc-riv', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'Rivendell', description: '', type: 'landmark',
        x: Number(layer.imageWidth) * 0.3, y: Number(layer.imageHeight) * 0.3,
        factionId: null, linkedMapLayerId: null, iconType: 'city', color: null,
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded).toBe(true)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    await page.getByText('Rivendell').first().click()
    const del = page.getByRole('button', { name: /Delete location/i })
    await expect(del).toBeVisible({ timeout: 10_000 })

    // Absence: it no longer carries a filled destructive plate. Read the paint,
    // not the class list — the finding is about what the eye lands on.
    const plate = await del.evaluate((el) => {
      const bg = getComputedStyle(el).backgroundColor
      const [r, g, b, a = '1'] = bg.match(/[\d.]+/g) ?? ['0', '0', '0', '0']
      return { alpha: Number(a), red: Number(r), green: Number(g), blue: Number(b) }
    })
    expect(plate.alpha, `the delete control is painted ${JSON.stringify(plate)}`).toBeLessThan(0.05)

    // Presence: another control on the same panel *is* filled, so the assertion
    // above is measuring restraint rather than a page that paints nothing.
    const edit = page.getByRole('button', { name: 'Edit', exact: true })
    const editBorder = await edit.evaluate((el) => getComputedStyle(el).borderTopWidth)
    expect(parseFloat(editBorder), 'the panel should still draw its ordinary controls').toBeGreaterThan(0)

    // And it still deletes — quiet is not disabled.
    await del.click()
    await expect(page.getByRole('dialog')).toContainText('Rivendell')
  })

  /**
   * LP-2: the panel was clipped by its own delete bar — *Upload Sub-map* cut in
   * half by it, so the last section could not be read or reached at the default
   * height. The footer is `shrink-0` now, so it takes its own space instead of
   * eating the body's.
   *
   * LP-3: three sections in a row sent you somewhere else and none of them took
   * you there. Measured before: zero links in the whole panel.
   */
  test('LP-2/LP-3: the last section is reachable, and the copy that names a screen goes there', async ({ page }) => {
    await setUpMap(page, 'Panel Errands')

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        mapLayers: { toArray: () => Promise<Record<string, string | number>[]> }
        locationMarkers: { add: (v: unknown) => Promise<unknown> }
      }
      const layer = (await db.mapLayers.toArray())[0]
      const now = Date.now()
      await db.locationMarkers.add({
        id: 'loc-riv', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'Rivendell', description: '', type: 'landmark',
        x: Number(layer.imageWidth) * 0.3, y: Number(layer.imageHeight) * 0.3,
        factionId: null, linkedMapLayerId: null, iconType: 'city', color: null,
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded).toBe(true)

    await page.reload({ waitUntil: 'load' })
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)
    await page.getByText('Rivendell').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible({ timeout: 10_000 })

    // ── LP-2 ──
    // Presence: the delete footer is really there, so the absence below is not
    // passing on a panel that simply has no footer to be clipped by.
    const footer = page.getByRole('button', { name: /Delete location/i })
    await expect(footer).toBeVisible()
    const sub = page.getByRole('button', { name: 'Upload Sub-map' })
    await sub.scrollIntoViewIfNeeded()
    const overlap = await page.evaluate(() => {
      const s = [...document.querySelectorAll('button')].find((b) => /Upload Sub-map/i.test(b.textContent || ''))!
      const f = [...document.querySelectorAll('button')].find((b) => /Delete location/i.test(b.textContent || ''))!
      const sr = s.getBoundingClientRect(), fr = f.getBoundingClientRect()
      return { subBottom: Math.round(sr.bottom), footerTop: Math.round(fr.top), covered: sr.bottom > fr.top }
    })
    expect(overlap.covered,
      `the last section runs under the delete bar: ${JSON.stringify(overlap)}`).toBe(false)
    await expect(sub).toBeVisible()

    // ── LP-3 ──
    // Presence: both errands are one click, not a sentence naming a screen.
    const toFactions = page.getByRole('link', { name: 'Open Factions' })
    const toLore = page.getByRole('link', { name: 'Open Lore' })
    await expect(toFactions).toBeVisible()
    await expect(toLore).toBeVisible()
    await toFactions.click()
    await expect(page).toHaveURL(/\/factions$/)

    // Absence, the opposite condition: once a faction exists the panel offers
    // the picker instead, so the link is an empty state rather than furniture.
    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('Rivendell Guard')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('Rivendell Guard').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('link', { name: /maps/i }).first().click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)
    await page.getByText('Rivendell').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Open Factions' })).toHaveCount(0)
  })
})
