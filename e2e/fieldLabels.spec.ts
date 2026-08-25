import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide, settleNav } from './helpers/nav'
import { waitForMapReady } from './helpers/map'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

/**
 * N10, from a blind writer run, measured live in the DOM: every control on
 * Character → Current State had `id: null`, `aria-label: null`,
 * `aria-labelledby: null` and no wrapping `<label>`, so a screen reader
 * announced the location picker as an unnamed collapsed button. The Add
 * Location dialog was the same — clicking "Name (required)" did not even focus
 * the field beside it.
 *
 * `getByLabel` resolves by accessible name, which is the thing the finding
 * measured: each of these fails if the control loses its name, whatever the
 * markup around it looks like. The source rule lives in
 * `src/lib/__tests__/labelAssociation.test.ts`.
 */

async function seed(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Named Controls')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.mapLayers.add({ id: 'map-a', worldId: id, name: 'The City', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Adze', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    // An item, or the "add existing item" picker does not render at all.
    await db.items.add({ id: 'bell-hook', worldId: id, name: 'The bell-hook', description: '', iconType: 'item', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The ninth bell does not ring',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['corvin'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

test.describe('Editing controls have names', () => {
  // Deliberately not the 300s some specs take: everything here is a lookup that
  // either resolves at once or is the bug, so a miss should cost seconds.
  test.describe.configure({ timeout: 150_000 })

  test('every control on Current State can be found by its name', async ({ page }) => {
    const worldId = await seed(page)
    await page.goto(`/#/worlds/${worldId}/characters/corvin?tab=state`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Next moment' }).click()
    await page.waitForTimeout(900)

    const main = page.getByRole('main')
    // The five the report measured, each resolved by accessible name alone.
    /*
      Named by its label *and* the value it shows, so a writer hears both and a
      voice-control user can ask for what is on screen. An associated <label>
      replaces a button's content in its name rather than adding to it, and
      wrapping this picker in a Field lost "Château d'If" from ten specs.
    */
    await expect(main.getByLabel(/Current Location/)).toBeVisible()
    await expect(main.getByRole('button', { name: /Current Location Unknown \/ not set/ })).toBeVisible()
    await expect(main.getByLabel('Status Notes')).toBeVisible()
    await expect(main.getByLabel('Inventory Notes')).toBeVisible()
    await expect(main.getByLabel('New item name')).toBeVisible()
    // This one names itself by its content, which never changes to a value.
    await expect(main.getByRole('button', { name: 'Add existing item' })).toBeVisible()

    // And the name reaches the control, not just the page: typing into the
    // field found by its label puts the text in that field.
    await main.getByLabel('Status Notes').fill('Waiting in the cistern.')
    await expect(main.getByPlaceholder(/Physical condition/)).toHaveValue('Waiting in the cistern.')

    // The pair of Alive/Deceased buttons is one choice, so it is named as a
    // group rather than by a label pointing at one of the two.
    await expect(main.getByRole('group', { name: 'Status' })).toBeVisible()
  })

  test('clicking a dialog label focuses the field beside it', async ({ page }) => {
    // Its own world, with no map seeded: the maps screen offers "Upload Map"
    // only while there is nothing there yet, and the dialog under test lives
    // behind a real map — the Location tool, then a click on the canvas that
    // decides where the pin goes.
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Cartography')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await dismissFirstRunGuide(page)

    await page.getByRole('link', { name: /maps/i }).first().click()
    await settleNav(page)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)

    await page.getByRole('button', { name: 'Location', exact: true }).click()
    await page.locator('.leaflet-container').click({ position: { x: 300, y: 250 } })

    const dialog = page.getByRole('dialog')
    const name = dialog.getByLabel(/^Name/)
    await expect(name).toBeVisible()

    // The finding's specific complaint: the label was not associated at all, so
    // clicking it did nothing. Blur first — the field opens autofocused, and an
    // already-focused field would make this pass without any association.
    await dialog.getByLabel('Description').click()
    await expect(name).not.toBeFocused()
    await dialog.getByText(/^Name/).first().click()
    await expect(name).toBeFocused()
  })
})
