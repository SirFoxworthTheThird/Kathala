import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { parkCursor } from './helpers/cursor'

/*
  Each book of a series opens where the one before ended (issue #698, part 2),
  on every screen that reads a thing's state at the cursor: who holds an item
  (Current State), its condition (Items), a place's state and a region's (the
  map's panels). Book one says each at its one scene; book two says nothing of
  any of them, and shows each as book one left it.
*/

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')
const worldOf = (page: Page) => page.url().split('/worlds/')[1].split('/')[0]
type Db = Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Array<{ id: string }>> }>

/** One timeline, chapter and scene, in a book. */
async function oneScene(page: Page, worldId: string, sceneId: string) {
  await page.evaluate(async ({ worldId, sceneId }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
    const now = Date.now()
    await db.timelines.add({ id: `tl-${sceneId}`, worldId, name: 'Main', description: '', color: '#fff', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: `ch-${sceneId}`, worldId, timelineId: `tl-${sceneId}`, number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: sceneId, worldId, chapterId: `ch-${sceneId}`, timelineId: `tl-${sceneId}`, title: `Scene ${sceneId}`, description: '', locationMarkerId: null,
      involvedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0, status: 'draft', createdAt: now, updatedAt: now,
    })
  }, { worldId, sceneId })
}

/** From the shelf: book one made a series, and book two added; book two's id. */
async function seriesFrom(page: Page, name: string): Promise<string> {
  await page.goto('/#/', { waitUntil: 'load' })
  const main = page.getByRole('main')
  await main.getByRole('button', { name: `More actions for ${name}` }).click()
  await main.getByRole('button', { name: /Make a series/ }).click()
  await page.getByRole('dialog', { name: 'Make a series' }).getByRole('button', { name: 'Make the series' }).click()
  await main.getByRole('region', { name: /^Series:/ }).getByRole('button', { name: 'Add a book' }).click()
  await page.getByLabel('Title').fill('Book Two')
  await page.getByRole('button', { name: 'Add the book' }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return worldOf(page)
}

async function newBook(page: Page, name: string): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return worldOf(page)
}

test.describe('Book two opens on book one’s end, on every screen', () => {
  test.describe.configure({ timeout: 180_000 })

  test('who holds an item, and its condition', async ({ page }) => {
    const one = await newBook(page, 'Book One')
    await oneScene(page, one, 'b1s1')
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const now = Date.now()
      await db.characters.add({ id: 'bo', worldId, name: 'Bo', description: '', aliases: [], color: null, birthDate: null, portraitImageId: null, tags: [], isAlive: true, createdAt: now, updatedAt: now })
      for (const [id, name] of [['key', 'Brass Key'], ['lamp', 'Storm Lamp']]) {
        await db.items.add({ id, worldId, name, description: '', iconType: 'other', imageId: null, tags: [], createdAt: now, updatedAt: now })
      }
      // Bo has a state in book one, as anyone carrying something does: custody is what a person's state holds.
      await db.characterSnapshots.add({ id: 'bo-b1s1', worldId, characterId: 'bo', eventId: 'b1s1', isAlive: true, sortKey: 1, createdAt: now, updatedAt: now })
      await db.itemCustody.add({ id: 'custody:key:b1s1', worldId, itemId: 'key', eventId: 'b1s1', holderId: 'bo', placeId: null, sortKey: 1, createdAt: now, updatedAt: now })
      await db.itemSnapshots.add({ id: 'lamp-b1s1', worldId, itemId: 'lamp', eventId: 'b1s1', condition: 'cracked', notes: '', sortKey: 1, createdAt: now, updatedAt: now })
    }, one)
    const two = await seriesFrom(page, 'Book One')
    await oneScene(page, two, 'b2s1')

    // Bo still has the key at book two's first scene, which says nothing of it.
    await page.goto(`/#/worlds/${two}/characters/bo`, { waitUntil: 'load' })
    await parkCursor(page, 'b2s1')
    await page.getByRole('tab', { name: 'Current State' }).click()
    await expect(page.getByRole('tabpanel').first().getByRole('button', { name: 'Take Brass Key out of the inventory' })).toBeVisible({ timeout: 30_000 })

    // The lamp is still cracked.
    await page.goto(`/#/worlds/${two}/items`, { waitUntil: 'load' })
    await settle(page)
    const lamp = page.getByRole('main').getByRole('link', { name: /Storm Lamp/ })
    await expect(lamp.getByText('cracked')).toBeVisible({ timeout: 30_000 })
    // And at book one's own scene, so the check is not passing on a condition shown everywhere.
    await page.goto(`/#/worlds/${one}/items`, { waitUntil: 'load' })
    await parkCursor(page, 'b1s1')
    await expect(page.getByRole('main').getByRole('link', { name: /Storm Lamp/ }).getByText('cracked')).toBeVisible({ timeout: 30_000 })
  })

  test('a place’s state and a region’s, on the map', async ({ page }) => {
    const one = await newBook(page, 'Book One')
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('The Coast')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
    await oneScene(page, one, 'b1s1')
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Db
      const [layer] = await db.mapLayers.toArray()
      const now = Date.now()
      await db.locationMarkers.add({ id: 'harbour', worldId, mapLayerId: layer.id, linkedMapLayerId: null, name: 'Harbour', description: '', x: 300, y: 300, iconType: 'city', tags: [], createdAt: now, updatedAt: now })
      await db.locationSnapshots.add({ id: 'harbour-b1s1', worldId, locationMarkerId: 'harbour', eventId: 'b1s1', status: 'destroyed', notes: '', sortKey: 1, createdAt: now, updatedAt: now })
      await db.mapRegions.add({
        id: 'marsh', worldId, mapLayerId: layer.id, name: 'The Marsh',
        vertices: [{ x: 200, y: 200 }, { x: 700, y: 220 }, { x: 720, y: 600 }, { x: 180, y: 560 }],
        fillColor: '#22c55e', opacity: 0.3, notes: '', linkedMapLayerId: null, factionId: null, createdAt: now, updatedAt: now,
      })
      await db.mapRegionSnapshots.add({ id: 'marsh-b1s1', worldId, regionId: 'marsh', eventId: 'b1s1', status: 'contested', notes: '', sortKey: 1, createdAt: now, updatedAt: now })
    }, one)
    const two = await seriesFrom(page, 'Book One')
    await oneScene(page, two, 'b2s1')

    await page.goto(`/#/worlds/${two}/maps`, { waitUntil: 'load' })
    await parkCursor(page, 'b2s1')
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
    await settle(page)

    // The harbour, destroyed in book one, is destroyed at book two's first scene.
    await page.getByRole('button', { name: /^Locations \d+$/ }).click()
    await page.locator('[data-sidebar-section-body="Locations"]').getByRole('button', { name: /^Harbour/ }).click()
    await expect(page.getByText('State at this scene', { exact: true })).toBeVisible({ timeout: 20_000 })
    // Its state is the select's trigger, named by the state it shows; no region panel is open yet to show its own.
    await expect(page.getByRole('button', { name: 'destroyed', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close location panel' }).click()

    // The marsh, contested in book one, is contested there too.
    await page.getByRole('button', { name: /^Regions/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: /^The Marsh/ }).first().click()
    // The panel's own root, by the classes only it has (as regionMoment.spec.ts finds it).
    const region = page.locator('div.h-full.shrink-0.border-l.shadow-xl').filter({ has: page.getByRole('button', { name: 'Close region panel' }) })
    await expect(region.getByRole('button', { name: 'contested', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
    await expect(region.getByRole('button', { name: 'active', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })
})
