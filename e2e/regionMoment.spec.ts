import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * RG-1. A region's **status** — active, occupied, contested, abandoned,
 * destroyed, unknown — is the one part of a region that changes with the story.
 * The Continuity Checker reads it (*"a character who travels through a
 * destroyed or abandoned region"*), and it is what makes a region more than a
 * coloured shape.
 *
 * It lived in an editor that unfolded inside the **sidebar row**, shown only
 * while that row was selected — which is precisely when the region *panel* is
 * open. So one region had two homes side by side, and the one holding its name,
 * colour, notes and faction was the half that could not say what had become of
 * it. Section 27 filed that; this drives the move.
 *
 * The two notes fields are the other half: the panel's own **Notes** are the
 * region's, and are not per-moment. Both were called "Notes".
 */

async function mapWithRegion(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Middle Earth')
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
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await settle(page)

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<{ id: string }[]> }>
    const [layer] = await db.mapLayers.toArray()
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Road', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'Departure',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.mapRegions.add({
      id: 'rg1', worldId: id, mapLayerId: layer.id, name: 'Rohan',
      vertices: [{ x: 200, y: 200 }, { x: 700, y: 220 }, { x: 720, y: 600 }, { x: 180, y: 560 }],
      fillColor: '#22c55e', opacity: 0.3, notes: 'The grass plains of the Mark.',
      linkedMapLayerId: null, factionId: null, createdAt: now, updatedAt: now,
    })
  }, worldId)

  await page.reload()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await settle(page)
  await page.getByRole('button', { name: /^Regions/ }).first().click()
  await settle(page)
  return worldId
}

/**
 * The panel's own root, by the classes only it has. `div.flex.h-full` filtered
 * by the close button matched three nested elements — every ancestor contains
 * it too, which is what `filter({ has })` means.
 */
const panel = (page: Page) =>
  page.locator('div.h-full.shrink-0.border-l.shadow-xl')
    .filter({ has: page.getByRole('button', { name: 'Close region panel' }) })

async function storedSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { mapRegionSnapshots: { toArray: () => Promise<{ regionId: string; status: string; notes: string }[]> } }
    return db.mapRegionSnapshots.toArray()
  })
}

test.describe('A region says what has become of it, in its own panel', () => {
  test.describe.configure({ timeout: 180_000 })

  test('setting the status writes a snapshot at the moment on the cursor', async ({ page }) => {
    await mapWithRegion(page)

    // Put the cursor on a scene — the status is per-moment, so without one
    // there is nothing for it to be about.
    await page.getByRole('button', { name: /Departure/ }).first().click()
    await settle(page)

    await page.getByRole('button', { name: /^Rohan/ }).first().click()
    await expect(panel(page)).toBeVisible()

    // The moment is named in the header, which is where PAN-1 puts it when a
    // panel's content is per-chapter.
    await expect(panel(page).getByText(/Region · /)).toBeVisible()
    await expect(panel(page).getByText('At this moment', { exact: true })).toBeVisible()

    expect(await storedSnapshot(page), 'nothing recorded yet').toEqual([])

    await panel(page).getByRole('button', { name: 'destroyed' }).click()
    await expect.poll(async () => (await storedSnapshot(page)).map((s) => s.status)).toEqual(['destroyed'])

    // Pressed state, so the panel shows which one is current rather than only
    // having written it.
    await expect(panel(page).getByRole('button', { name: 'destroyed' })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel(page).getByRole('button', { name: 'active' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('the two notes are named apart, and go to different places', async ({ page }) => {
    await mapWithRegion(page)
    await page.getByRole('button', { name: /Departure/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: /^Rohan/ }).first().click()
    await expect(panel(page)).toBeVisible()

    // The region's own notes came from the seed and are not per-moment.
    await expect(panel(page).getByLabel('Notes', { exact: true })).toHaveValue('The grass plains of the Mark.')

    const atMoment = panel(page).getByLabel('Notes at this moment')
    await expect(atMoment).toHaveValue('')
    await atMoment.fill('Burned by the Isengarders.')
    await atMoment.blur()

    await expect.poll(async () => (await storedSnapshot(page))[0]?.notes).toBe('Burned by the Isengarders.')

    // …and the region's own notes are untouched by that write.
    const regionNotes = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { mapRegions: { get: (id: string) => Promise<{ notes?: string }> } }
      return (await db.mapRegions.get('rg1'))?.notes
    })
    expect(regionNotes).toBe('The grass plains of the Mark.')
  })

  test('with no moment it says so, rather than offering a control that cannot work', async ({ page }) => {
    await mapWithRegion(page)

    // Cursor left on "All chapters" — the default for a fresh world.
    await page.getByRole('button', { name: /^Rohan/ }).first().click()
    await expect(panel(page)).toBeVisible()

    await expect(panel(page).getByText('At this moment', { exact: true })).toBeVisible()
    await expect(panel(page).getByText(/Pick a scene on the bar below/)).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'destroyed' })).toHaveCount(0)
  })

  test('the sidebar shows the status but no longer edits it', async ({ page }) => {
    await mapWithRegion(page)
    await page.getByRole('button', { name: /Departure/ }).first().click()
    await settle(page)
    await page.getByRole('button', { name: /^Rohan/ }).first().click()
    await expect(panel(page)).toBeVisible()

    await panel(page).getByRole('button', { name: 'contested' }).click()
    await expect.poll(async () => (await storedSnapshot(page))[0]?.status).toBe('contested')

    // Presence: the row reports the status, which is what a list is for…
    const sidebar = page.getByRole('button', { name: /^Rohan/ }).first()
    await expect(sidebar).toContainText('contested')

    // …and absence: the status pills exist once on the screen, in the panel,
    // not twice. Two homes for one region was the finding.
    await expect(page.getByRole('button', { name: 'destroyed' })).toHaveCount(1)
  })
})
