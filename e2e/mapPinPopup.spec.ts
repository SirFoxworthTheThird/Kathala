import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MW-6 and MW-7 — the popup a crowded character pin opens.
 *
 * MW-6: a pin holding sixteen characters opened a list taller than the space
 * above it, and its first rows rendered off the top of the canvas behind the
 * floating toolbar — not scrolled into view and unreachable.
 *
 * MW-7: fourteen of those sixteen rows read *"(sub-map)"* — the same word over
 * and over, saying that the character is somewhere else and never where.
 */

const CROWD = Array.from({ length: 16 }, (_, i) => `Character ${String(i + 1).padStart(2, '0')}`)

async function mapWithCrowdedPin(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Crowded')
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
  await settle(page)

  const seeded = await page.evaluate(async (names) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
      string,
      {
        toArray: () => Promise<Record<string, string | number | null>[]>
        add: (v: unknown) => Promise<unknown>
        bulkAdd: (v: unknown[]) => Promise<unknown>
      }
    >
    const root = (await db.mapLayers.toArray())[0]
    const worldId = root.worldId as string
    const now = Date.now()

    // A child map, reached through a pin on the root — the shape that makes a
    // character "really somewhere below" (MW-7).
    await db.mapLayers.add({
      id: 'lyr-keep', worldId, name: 'The Keep', parentMapId: root.id,
      imageBlobId: root.imageBlobId, imageWidth: root.imageWidth, imageHeight: root.imageHeight,
      levelGroupId: null, levelIndex: 0, sortOrder: 1,
      scalePixelsPerUnit: null, scaleUnit: null, createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.add({
      id: 'loc-gate', worldId, mapLayerId: root.id, name: 'The Gate',
      description: '', type: 'landmark',
      x: Number(root.imageWidth) * 0.5, y: Number(root.imageHeight) * 0.15,
      factionId: null, linkedMapLayerId: 'lyr-keep', iconType: 'city', color: null,
      createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.add({
      id: 'loc-hall', worldId, mapLayerId: 'lyr-keep', name: 'The Hall',
      description: '', type: 'landmark',
      x: 100, y: 100,
      factionId: null, linkedMapLayerId: null, iconType: 'building', color: null,
      createdAt: now, updatedAt: now,
    })

    await db.characters.bulkAdd(names.map((name, i) => ({
      id: `chr-${i}`, worldId, name,
      role: '', description: '', tags: [], portraitImageId: null, createdAt: now, updatedAt: now,
    })))
    await db.timelines.add({ id: 'tl-1', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
    await db.chapters.add({
      id: 'ch-1', worldId, timelineId: 'tl-1', number: 1, title: 'Landfall',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev-1', worldId, chapterId: 'ch-1', timelineId: 'tl-1', title: 'The muster',
      description: '', locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
      travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
      threadIds: [], status: 'idea', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    // Everyone inside The Keep, so on the root map they all stack on one pin.
    await db.characterSnapshots.bulkAdd(names.map((_, i) => ({
      id: `snap-${i}`, worldId, characterId: `chr-${i}`, eventId: 'ev-1',
      isAlive: true, currentLocationMarkerId: 'loc-hall', currentMapLayerId: 'lyr-keep',
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })))
    return true
  }, CROWD)
  expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settle(page)
  await page.getByTitle('Open chapter detail').first().click()
  await page.waitForTimeout(1000)
  await page.getByRole('link', { name: /maps/i }).first().click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)
}

test.use({ viewport: { width: 1024, height: 600 } })

test.describe('A crowded character pin', () => {
  test.describe.configure({ timeout: 180_000 })

  test('MW-6/MW-7: the whole list is reachable, and each row says which map', async ({ page }) => {
    await mapWithCrowdedPin(page)

    // Absence first: no popup, so what is measured below is this popup.
    await expect(page.locator('.leaflet-popup')).toHaveCount(0)

    // The group pin itself, not the location marker underneath it — that one is
    // draggable and sits over the same spot.
    await page.locator('.leaflet-marker-icon').filter({ hasText: '16 characters' }).click()
    const popup = page.locator('.leaflet-popup')
    await expect(popup).toBeVisible({ timeout: 15_000 })
    // MW-8: the heading says what the rows do. A single pin opens a character's
    // panel and journey strip; this list looked like a different kind of thing
    // with no way through to one, though every row is that route.
    await expect(popup.getByText('At this location — pick one to open their journey:')).toBeVisible()

    // MW-7: the row names the map the character is really on. "(sub-map)" said
    // only that they were elsewhere, on fourteen rows out of sixteen.
    await expect(popup.getByText(/Character 01 · in The Keep/)).toBeVisible()
    await expect(popup.getByText('(sub-map)')).toHaveCount(0)

    /*
      MW-6: the popup never actually left the map container — Leaflet's auto-pan
      already keeps it inside — so the first version of this test, which
      asserted the canvas bounds, passed with the fix reverted and was no test
      at all. What the popup ran into was the *floating* toolbar sitting on top
      of the canvas.

      Measured on a 600px-tall viewport with the fix reverted: the popup opened
      at y=67 and stood 363px tall, while the toolbar occupies y=61..89. It rose
      straight into the toolbar's band and only missed it because this pin sits
      to one side; a pin under the toolbar is occluded outright. With the
      padding it opens at y=180 — clear of the band — and `maxHeight` brings it
      to 250px so the list scrolls inside itself rather than growing past the
      space it has.
    */
    const toolbar = page.getByRole('button', { name: 'Map tools' })
    await expect(toolbar).toBeVisible()
    const geom = await popup.evaluate((el) => {
      const t = document
        .querySelector('[aria-label="Map tools"], [title="Map tools"]')!
        .closest('div')!
        .getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { popupTop: Math.round(r.top), popupHeight: Math.round(r.height), toolbarBottom: Math.round(t.bottom) }
    })
    expect(geom.popupTop, 'the popup rises into the floating toolbar\u2019s band')
      .toBeGreaterThanOrEqual(geom.toolbarBottom)
    expect(geom.popupHeight, 'the popup grows past the room it has').toBeLessThan(300)

    // And every row can be reached: the last one is inside the popup's own
    // scroll box, not off the end of it.
    const last = popup.getByText(/Character 16 · in The Keep/)
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
  })
})
