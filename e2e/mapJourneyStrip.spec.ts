import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * PAN-2: selecting a character on the map opened the right panel and the
 * journey strip together, costing the panel's width and a band of map height in
 * one click — and the strip's own X cleared the selection, so it closed the
 * panel too. There was no way to keep one without the other.
 */
test('the journey strip can be put away without losing the panel', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Journeys')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByTitle('Characters').click()
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Frodo')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Frodo').first()).toBeVisible()

  await page.getByRole('link', { name: /maps/i }).first().click()
  await page.mouse.move(900, 500)
  await page.getByRole('button', { name: 'Upload Map' }).first().click()
  await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)

  // The strip draws a stop per recorded location, so it needs a journey to
  // show — two scenes with Frodo somewhere in each.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      mapLayers: { toArray: () => Promise<{ id: string; worldId: string }[]> }
      characters: { toArray: () => Promise<{ id: string }[]> }
      locationMarkers: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      timelines: { add: (v: unknown) => Promise<unknown> }
      chapters: { add: (v: unknown) => Promise<unknown> }
      events: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      characterSnapshots: { bulkAdd: (v: unknown[]) => Promise<unknown> }
    }
    const [layer] = await db.mapLayers.toArray()
    const [char] = await db.characters.toArray()
    const now = Date.now()
    const w = layer.worldId
    await db.locationMarkers.bulkAdd([
      { id: 'mk-shire', worldId: w, mapLayerId: layer.id, linkedMapLayerId: null, name: 'The Shire', x: 120, y: 120, iconType: 'city', tags: [], factionId: null, imageId: null, createdAt: now, updatedAt: now },
      { id: 'mk-bree', worldId: w, mapLayerId: layer.id, linkedMapLayerId: null, name: 'Bree', x: 400, y: 300, iconType: 'city', tags: [], factionId: null, imageId: null, createdAt: now, updatedAt: now },
    ])
    await db.timelines.add({ id: 'tl-1', worldId: w, name: 'Main', description: '', color: '#6366f1', createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch-1', worldId: w, timelineId: 'tl-1', number: 1, title: 'Out', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.bulkAdd([
      { id: 'ev-1', worldId: w, timelineId: 'tl-1', chapterId: 'ch-1', title: 'Leaving', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], mentionedCharacterIds: [], threadIds: [], tags: [], sortOrder: 0, status: 'draft', povCharacterId: null, isFlashback: false, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, createdAt: now, updatedAt: now },
      { id: 'ev-2', worldId: w, timelineId: 'tl-1', chapterId: 'ch-1', title: 'Arriving', description: '', locationMarkerId: null, involvedCharacterIds: [], involvedItemIds: [], mentionedCharacterIds: [], threadIds: [], tags: [], sortOrder: 1, status: 'draft', povCharacterId: null, isFlashback: false, travelDays: null, inWorldTime: null, tension: null, structureBeat: null, createdAt: now, updatedAt: now },
    ])
    await db.characterSnapshots.bulkAdd([
      { id: 'sn-1', worldId: w, characterId: char.id, eventId: 'ev-1', isAlive: true, currentLocationMarkerId: 'mk-shire', currentMapLayerId: layer.id, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 100, createdAt: now, updatedAt: now },
      { id: 'sn-2', worldId: w, characterId: char.id, eventId: 'ev-2', isAlive: true, currentLocationMarkerId: 'mk-bree', currentMapLayerId: layer.id, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 200, createdAt: now, updatedAt: now },
    ])
  })
  await page.waitForTimeout(2500)

  const canvasHeight = () => page.evaluate(() =>
    document.querySelector('.leaflet-container')!.getBoundingClientRect().height)
  const mapHeight = await canvasHeight()

  // Select the character from the map sidebar.
  await page.getByRole('main').getByText('Frodo', { exact: true }).first().click()
  const panel = page.getByRole('button', { name: 'Close character panel' })
  await expect(panel).toBeVisible({ timeout: 15_000 })

  const hide = page.getByRole('button', { name: 'Hide journey' })
  await expect(hide).toBeVisible()

  // What the strip costs, measured rather than estimated. It sits over the
  // canvas rather than shrinking it — the canvas keeps its height and the strip
  // covers the bottom band of it — so the cost is the strip's own height, not a
  // change in the canvas's.
  const strip = page.getByRole('group', { name: "Frodo's journey" })
  await expect(strip).toBeVisible()
  const covered = Math.round((await strip.boundingBox())!.height)
  expect(covered, `the journey strip covers ${covered}px of a ${Math.round(mapHeight)}px map`)
    .toBeGreaterThan(20)

  // The strip's own X closes the strip. This is the heart of the finding: it
  // used to clear the character selection, so the control that looked like
  // "close the strip" took the panel with it.
  await strip.getByRole('button', { name: 'Close journey strip' }).click()
  await expect(strip).toHaveCount(0)
  await expect(panel, 'the panel survives the strip being closed').toBeVisible()

  // And it can be asked for again, from the panel that outlived it.
  const show = page.getByRole('button', { name: 'Show journey' })
  await expect(show).toBeVisible()
  await show.click()
  await expect(strip).toBeVisible()

  // The panel's own toggle does the same thing from the other side.
  await hide.click()
  await expect(strip).toHaveCount(0)
  await expect(panel).toBeVisible()
  await page.getByRole('button', { name: 'Show journey' }).click()
  await expect(strip).toBeVisible()

  // Closing the panel is still what deselects the character, so the two
  // controls do different things rather than the same thing twice.
  await page.getByRole('button', { name: 'Close character panel' }).click()
  await expect(page.getByRole('button', { name: /journey/ })).toHaveCount(0)
  await expect(strip).toHaveCount(0)
})
