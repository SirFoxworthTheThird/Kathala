import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady, sidebarSection } from './helpers/map'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

/**
 * A place that exists in the story and is on no map.
 *
 * It has to be **reachable**, or the control that puts it on a map can never
 * be opened: a place named while writing would exist, be usable as a setting,
 * and be permanently unmappable. The map screen is where a writer goes to
 * think about where things are, so that is where it waits.
 *
 * Driven in a browser because the whole finding is whether the thing can be
 * got to, and by what.
 */
test.describe('a place with no map', () => {
  test.describe.configure({ timeout: 240_000 })

  test('is listed on the map screen, and can be put on the map from there', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Unmapped')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    /*
      A real uploaded image, not a seeded layer. The floating toolbar and the
      sidebar mount on an *active* layer, and a layer seeded through `__pwdb`
      with `imageId: null` never becomes one — a trap that has now cost two
      specs, so it is written down here too.
    */
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await expect(page.getByRole('heading', { name: /Upload Map/ })).toBeVisible()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('The House')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)

    // A place in the story, on no map at all.
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.locationMarkers.add({
        id: 'kitchen', worldId: id, mapLayerId: null, linkedMapLayerId: null,
        name: 'The kitchen', description: '', x: 0, y: 0, imageId: null,
        iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now,
      })
    }, worldId)
    await settle(page)

    // Findable under its own heading, beside the places that are on this map.
    // `sidebarSection`, not a page-wide lookup: the Show chip above the canvas
    // is also called "Locations". The helper discriminates on `aria-expanded`.
    await sidebarSection(page, /^Locations/).click()
    await expect(page.getByText('Not on a map yet')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'The kitchen' }).click()

    // Its panel offers the map, and says what being on none means.
    await expect(page.getByText(/without it being drawn anywhere/)).toBeVisible()
    await page.getByRole('button', { name: /^On the map/ }).click()
    await page.getByRole('option', { name: 'The House' }).click()

    /*
      It landed on that map, at its centre — findable, to be dragged where it
      belongs. Asserted as the relationship rather than as four numbers: the
      uploaded image's size is not ours to fix, and `any Number` four times
      over would have asserted nothing at all.
    */
    await expect.poll(async () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        locationMarkers: { get: (id: string) => Promise<{ mapLayerId: string | null; x: number; y: number }> }
        mapLayers: { toArray: () => Promise<Array<{ id: string; imageWidth: number; imageHeight: number }>> }
      }
      const m = await db.locationMarkers.get('kitchen')
      const home = (await db.mapLayers.toArray()).find((l) => l.id === m.mapLayerId)
      if (!home) return 'not on a map'
      return m.x === Math.round(home.imageWidth / 2) && m.y === Math.round(home.imageHeight / 2)
        ? 'at the centre of its map'
        : `at ${m.x},${m.y} of ${home.imageWidth}x${home.imageHeight}`
    }), { timeout: 20_000 }).toBe('at the centre of its map')

    /*
      And it leaves the waiting list when it stops waiting — otherwise the
      heading would be a permanent fixture rather than a state.

      The panel is closed first because its own select carries the same words
      on its "take it off a map" option, which is right on screen and wrong in
      a locator.
    */
    await page.getByRole('button', { name: 'Close location panel' }).click()
    await expect(page.getByText('Not on a map yet')).toHaveCount(0)
    // …and it is now in the list for this map instead, not simply gone.
    await expect(page.getByRole('button', { name: 'The kitchen', exact: true })).toBeVisible()
    /*
      And drawn on the canvas, which is the strongest form of the claim: a pin
      exists where there was none. Named after the place and its type, which is
      how Leaflet markers announce themselves.
    */
    await expect(page.getByRole('button', { name: 'The kitchen building' })).toBeVisible()
  })
})

/**
 * The route to a *first* place, in a world with no map at all.
 *
 * A place stopped needing a map two commits before the Maps screen stopped
 * saying it did, and a writer read the screen and believed it. The only route
 * left was to type the name into the prose, where the create rows are ordered
 * character-first and the documented Tab makes a character out of a place name.
 */
test.describe('a first place, before there is any map', () => {
  test.describe.configure({ timeout: 240_000 })

  test('can be named from the map screen, which no longer says it cannot', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Mapless')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)

    // The claim that sent a writer away, gone — paired with the line that
    // replaced it, so neither half can pass vacuously.
    await expect(page.getByText(/Places in Kathala are pins on a map/)).toBeHidden()
    await expect(page.getByText(/A place does not need a map/)).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Add a place', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Add a place' })).toBeVisible()
    await dialog.getByLabel('Name').fill('The Salt Court')
    await dialog.getByRole('button', { name: /Add|Create|Save/ }).last().click()

    // It exists, on no map, and is a place rather than a character.
    await expect.poll(async () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        locationMarkers: { toArray: () => Promise<Array<{ name: string; mapLayerId: string | null }>> }
        characters: { toArray: () => Promise<Array<{ name: string }>> }
      }
      return {
        places: (await db.locationMarkers.toArray()).map((m) => [m.name, m.mapLayerId]),
        characters: (await db.characters.toArray()).map((c) => c.name),
      }
    }), { timeout: 20_000 }).toEqual({
      places: [['The Salt Court', null]],
      characters: [],
    })
  })

  test('and is then offered as a scene’s setting, with no map in the world', async ({ page }) => {
    /*
      The other half of the dead end: naming the place is only worth anything if
      a scene can be set there. The Setting chip is offered on `locationMarkers
      .length > 0`, which an unmapped place satisfies — asserted here rather than
      assumed, because that gate was written when every place was a pin.
    */
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Mapless Setting')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'First Light', description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/manuscript/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'First Light', exact: true }).click()

    // The absence half: no places yet, so the chip is not offered.
    await expect(page.getByRole('main').getByRole('button', { name: /Setting/ })).toBeHidden()

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.locationMarkers.add({
        id: 'court', worldId: id, mapLayerId: null, linkedMapLayerId: null,
        name: 'The Salt Court', description: '', x: 0, y: 0, imageId: null,
        iconType: 'building', tags: [], factionId: null, createdAt: now, updatedAt: now,
      })
    }, worldId)

    // The presence half: an unmapped place is enough to offer it.
    await expect(page.getByRole('main').getByRole('button', { name: /Setting/ }))
      .toBeVisible({ timeout: 20_000 })
  })
})
