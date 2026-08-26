import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady } from './helpers/map'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * A scene that happens inside a sub-map should show that sub-map.
 *
 * Two separate things stopped it, and both had to go:
 *
 * 1. `focusOnLocation` panned the *current* map to the marker's coordinates
 *    whatever map the marker was on. For a place one level down that means
 *    sliding the outer map to a point that means nothing on it — the pin never
 *    arrives, because it is not on that image.
 * 2. Under the reading gate a sub-map waited for the marker *linking* to it, so
 *    the map of Bree stayed hidden while the reader was in the Prancing Pony,
 *    which is on it. The scene reveals its own location; nothing revealed the
 *    town marker pointing down at the street map.
 *
 * The gate is still a gate, which is the half worth guarding: reading the
 * earlier scene, out on the road, must still leave the sub-map hidden and must
 * not drill into it. Every test here pairs the two.
 */

const CURSOR = { onTheRoad: 'ev1', insideTheInn: 'ev2' } as const

async function middleEarth(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  // A real upload, so the layer has an image and the canvas mounts at all.
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Eriador')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await settle(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, {
        add: (v: unknown) => Promise<unknown>
        bulkAdd: (v: unknown[]) => Promise<unknown>
        toArray: () => Promise<Record<string, unknown>[]>
      }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'At the Sign of the Pony', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })

    // Bree hangs off the root map and shares its image, so both render.
    const [root] = await db.mapLayers.toArray()
    await db.mapLayers.add({ ...root, id: 'sub', name: 'Bree', parentMapId: root.id, createdAt: now, updatedAt: now })
    await db.locationMarkers.bulkAdd([
      { id: 'mk-bree', worldId: id, mapLayerId: root.id, name: 'Bree', x: 400, y: 300, iconType: 'town', description: '', linkedMapLayerId: 'sub', createdAt: now, updatedAt: now },
      { id: 'mk-weathertop', worldId: id, mapLayerId: root.id, name: 'Weathertop', x: 900, y: 250, iconType: 'landmark', description: '', linkedMapLayerId: null, createdAt: now, updatedAt: now },
      { id: 'mk-pony', worldId: id, mapLayerId: 'sub', name: 'The Prancing Pony', x: 800, y: 500, iconType: 'building', description: '', linkedMapLayerId: null, createdAt: now, updatedAt: now },
    ])
    const ev = (eid: string, title: string, marker: string, order: number) => ({
      id: eid, worldId: id, chapterId: 'ch1', timelineId: 'tl', title, description: '', sortOrder: order,
      tags: [], locationMarkerId: marker, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    // Only the second scene is set inside the sub-map. Nothing ever names Bree
    // itself, which is exactly the case that used to hide the street map.
    await db.events.bulkAdd([
      ev('ev1', 'On the road', 'mk-weathertop', 0),
      ev('ev2', 'Inside the inn', 'mk-pony', 1),
    ])
  }, worldId)

  await page.reload({ waitUntil: 'load' })
  await waitForMapReady(page)
  await page.waitForTimeout(2000)
  return worldId
}

/** Turn reading mode on for the world, and park the cursor on a scene. */
async function readAt(page: Page, worldId: string, eventId: string) {
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { update: (k: string, c: Record<string, unknown>) => Promise<unknown> }>
    await db.worlds.update(id, { readingMode: true })
  }, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  // Set the cursor *after* the mode is on: opening a world in reading mode
  // moves it, so a value written beforehand does not survive.
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('plotweave-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('plotweave-ui', JSON.stringify(st))
  }, eventId)
  await page.reload({ waitUntil: 'load' })
  await waitForMapReady(page)
  await page.waitForTimeout(2500)
}

/** The map that is open, from the breadcrumb the reader sees. */
const openMap = (page: Page) => page.getByRole('banner').getByText(/^(Eriador|Bree)$/).first().innerText()

/** Maps offered in the sidebar's Map Layers tree. */
const layerNames = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll('[data-map-layer]')].map((e) => (e.textContent ?? '').trim()))

/** Move the cursor the way the chapter bar does when a scene names a place. */
const focusMarker = (page: Page, markerId: string) => page.evaluate((id: string) => {
  window.dispatchEvent(new CustomEvent('wb:map:focusMarker', { detail: { markerId: id } }))
}, markerId)

test.describe('A scene inside a sub-map opens that sub-map', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the cursor crosses into the sub-map instead of panning the outer one', async ({ page }) => {
    await middleEarth(page)

    // Absence: the outer map is open and the indoor pin is nowhere.
    await expect.poll(() => openMap(page)).toBe('Eriador')
    await expect(page.getByRole('button', { name: /The Prancing Pony/ })).toHaveCount(0)

    await focusMarker(page, 'mk-pony')

    // Presence: the map itself changed, not just the camera.
    await expect.poll(() => openMap(page)).toBe('Bree')
    await expect(page.getByRole('button', { name: /The Prancing Pony/ })).toHaveCount(1)
  })

  test('a place on the map already open still just pans', async ({ page }) => {
    await middleEarth(page)
    await expect.poll(() => openMap(page)).toBe('Eriador')

    /*
      The other half of the branch, and it has to be watched on the camera
      rather than the breadcrumb: crossing layers for *every* focus would leave
      the breadcrumb saying "Eriador" anyway, because the layer it switched to
      is the one already open. What would actually be lost is the pan, since the
      new centre is only applied when the canvas remounts onto a different
      layer — the map would quietly stop following the cursor.

      Zoomed in first, because at the opening fit there is nothing to pan to:
      the canvas fits the whole image and sets `maxBounds` to it, so every pan
      is clamped straight back and the whole map is on screen already. Four
      steps in, the image is far larger than its frame and the move is plain.
    */
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: 'Zoom in' }).click()
      await settle(page)
    }
    await page.waitForTimeout(1000)

    // The *pin*, not the sidebar row of the same name — both are buttons named
    // "Weathertop", and the row is the one that comes first in the document.
    const pin = page.locator('.leaflet-marker-icon').filter({ hasText: 'Weathertop' })
    // Vertical distance from the middle of the canvas. Vertical, because the
    // horizontal pan is the one `maxBounds` clips at the image's edge.
    const offset = async () => {
      const b = await pin.first().boundingBox()
      const m = await page.locator('.leaflet-container').boundingBox()
      if (!b || !m) return null
      return Math.round(Math.abs((b.y + b.height / 2) - (m.y + m.height / 2)))
    }

    // Absence: zoomed in on somewhere else, the pin is far off screen.
    expect(await offset(), 'the pin should start well away from the middle').toBeGreaterThan(200)

    await focusMarker(page, 'mk-weathertop')

    // Presence: the map brought it to the middle, and stayed on the same map.
    await expect.poll(offset, { timeout: 10_000 }).toBeLessThan(40)
    await expect.poll(() => openMap(page)).toBe('Eriador')
  })

  test('reading the scene set there reveals the sub-map and opens it', async ({ page }) => {
    const worldId = await middleEarth(page)
    await readAt(page, worldId, CURSOR.insideTheInn)

    await expect.poll(() => layerNames(page)).toContain('Bree')
    // The revealed sub-map must also have a visible way in from its parent.
    await expect(page.locator('.leaflet-marker-icon').filter({ hasText: 'Bree' })).toHaveCount(1)

    await focusMarker(page, 'mk-pony')
    await expect.poll(() => openMap(page)).toBe('Bree')
  })

  test('reading the earlier scene still hides it, and will not drill in', async ({ page }) => {
    const worldId = await middleEarth(page)
    await readAt(page, worldId, CURSOR.onTheRoad)

    // The gate is still a gate. Nothing so far names Bree or anywhere on it.
    await expect.poll(() => layerNames(page)).toEqual(['Eriador'])
    await expect(page.locator('.leaflet-marker-icon').filter({ hasText: 'Bree' })).toHaveCount(0)

    // And a focus request for a place on the hidden map is refused rather than
    // quietly drilling past the gate — the map is reached, not the coordinates.
    await focusMarker(page, 'mk-pony')
    await page.waitForTimeout(1500)
    await expect.poll(() => openMap(page)).toBe('Eriador')
    await expect(page.getByRole('button', { name: /The Prancing Pony/ })).toHaveCount(0)
  })
})
