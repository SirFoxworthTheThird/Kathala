import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')
const SUB_MAP  = path.resolve(__dirname, 'map_example/sub_map.jpg')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Upload a map image via the UploadMapDialog (works for both root maps and sub-maps). */
async function uploadMap(page: Page, imagePath: string, mapName: string) {
  // The dialog title is either "Upload Map" or "Add Sub-Map" — wait for it
  await expect(page.getByRole('heading', { name: /Upload Map|Add Sub-Map/ })).toBeVisible()

  // The file input is hidden; set the file directly. Scoped to the dialog's
  // form, because a location panel open behind it has an image upload of its
  // own and an unscoped selector matches both.
  const fileInput = page.locator('form input[type="file"][accept="image/*"]')
  await fileInput.setInputFiles(imagePath)

  // Auto-fills name from filename; override with our desired name
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill(mapName)

  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  // Wait for the dialog to close
  await expect(page.getByRole('heading', { name: /Upload Map|Add Sub-Map/ })).not.toBeVisible()
}

/**
 * Hovering a nav link expands the left rail, which then overlays the page —
 * including the timeline bar at the bottom. Move the pointer back over the
 * content so the rail collapses before clicking anything underneath it.
 */
const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/** Click the "Location" button then click the Leaflet canvas to place a pin. */
async function addLocationViaButton(page: Page, position?: { x: number; y: number }) {
  await page.getByRole('button', { name: 'Location', exact: true }).click()
  // The canvas shows "Click on the map to place the location" banner
  await expect(page.getByText('Click on the map to place the location')).toBeVisible()

  // Click the Leaflet map container (at a specific position if provided)
  const canvas = page.locator('.leaflet-container')
  if (position) {
    await canvas.click({ position })
  } else {
    await canvas.click()
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('Map management', () => {
  // Each test uploads a real JPEG, renders Leaflet, and round-trips through the
  // timeline — genuinely ~30s of work, right on Playwright's default budget.
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async ({ page }) => {
    await resetDB(page)

    // Create a world
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Map Test World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Create a character and a chapter (needed for placement tests)
    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aragorn')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aragorn')).toBeVisible()

    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Legolas')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Legolas')).toBeVisible()

    // Navigate to Maps
    await page.getByRole('link', { name: /maps/i }).click()
  })

  // ── Upload main map ─────────────────────────────────────────────────────────

  test('uploads a main map and displays it', async ({ page }) => {
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.getByText('Middle Earth').first()).toBeVisible()
    // The Leaflet container should now be visible
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  // ── Add locations ───────────────────────────────────────────────────────────

  test('adds two locations to the main map', async ({ page }) => {
    // Upload main map first
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    // Add first location
    await addLocationViaButton(page, { x: 200, y: 200 })
    await expect(page.getByRole('heading', { name: 'Add Location' })).toBeVisible()
    await page.getByPlaceholder('e.g. Thornwall City').fill('Minas Tirith')
    await page.getByRole('button', { name: 'Add Location' }).last().click()
    await expect(page.getByRole('heading', { name: 'Add Location' })).not.toBeVisible()

    // Add second location at a different canvas position to avoid overlap
    await addLocationViaButton(page, { x: 400, y: 200 })
    await expect(page.getByRole('heading', { name: 'Add Location' })).toBeVisible()
    await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Location' }).last().click()
    await expect(page.getByRole('heading', { name: 'Add Location' })).not.toBeVisible()

    // Both should appear in the map (as marker icon labels)
    await expect(page.getByText('Minas Tirith')).toBeVisible()
    await expect(page.getByText('Rivendell')).toBeVisible()
  })

  // ── Sub-map via location panel ──────────────────────────────────────────────

  test('creates a sub-map linked to a location', async ({ page }) => {
    // Upload main map and add a location
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await addLocationViaButton(page)
    await page.getByPlaceholder('e.g. Thornwall City').fill('Minas Tirith')
    await page.getByRole('button', { name: 'Add Location' }).last().click()

    // Click the location marker on the map to open the detail panel
    await page.getByText('Minas Tirith').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()

    // Upload sub-map from the location panel
    await page.getByRole('button', { name: 'Upload Sub-map' }).click()
    await uploadMap(page, SUB_MAP, 'Minas Tirith Interior')

    // After upload the sub-map is auto-linked and we drill down into it
    await expect(page.getByText('Minas Tirith Interior').first()).toBeVisible()
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  // ── Assign characters to locations ─────────────────────────────────────────

  test('assigns a character to a location', async ({ page }) => {
    // Upload map and add a location
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await addLocationViaButton(page)
    await page.getByPlaceholder('e.g. Thornwall City').fill('Minas Tirith')
    await page.getByRole('button', { name: 'Add Location' }).last().click()

    // Need an active chapter to place characters — create one via the location panel
    await page.getByText('Minas Tirith').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()

    // Create a chapter from within the panel
    await page.getByRole('button', { name: 'New chapter' }).click()
    await page.getByPlaceholder('Chapter title...').fill('The Fellowship Sets Out')
    await page.getByRole('button', { name: 'Add' }).click()

    // "Add character here" button should now appear
    await expect(page.getByRole('button', { name: 'Add character here' })).toBeVisible()
    await page.getByRole('button', { name: 'Add character here' }).click()

    // Select Aragorn from the dropdown
    await page.getByRole('button', { name: 'Choose character...' }).click()
    await page.getByRole('option', { name: 'Aragorn' }).click()

    // Aragorn should now appear in the location panel
    await expect(page.getByText('Aragorn').first()).toBeVisible()
  })

  // ── Move character between locations ───────────────────────────────────────

  test('moves a character from one location to another', async ({ page }) => {
    // Upload map and add two locations
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await addLocationViaButton(page, { x: 200, y: 200 })
    await page.getByPlaceholder('e.g. Thornwall City').fill('Minas Tirith')
    await page.getByRole('button', { name: 'Add Location' }).last().click()

    await addLocationViaButton(page, { x: 400, y: 200 })
    await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Location' }).last().click()

    // Open Minas Tirith, create a chapter, place Aragorn there
    await page.getByText('Minas Tirith').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()

    await page.getByRole('button', { name: 'New chapter' }).click()
    await page.getByPlaceholder('Chapter title...').fill('Chapter One')
    await page.getByRole('button', { name: 'Add' }).click()

    await page.getByRole('button', { name: 'Add character here' }).click()
    await page.getByRole('button', { name: 'Choose character...' }).click()
    await page.getByRole('option', { name: 'Aragorn' }).click()
    await expect(page.getByText('Aragorn').first()).toBeVisible()

    // Remove Aragorn from Minas Tirith (UserMinus icon button)
    await page.getByRole('button', { name: 'Remove character from location' }).click()
    // Remove button gone means Aragorn was successfully removed from this location
    await expect(page.getByRole('button', { name: 'Remove character from location' })).not.toBeVisible()

    // Close via the X button at the top of the Location panel
    await page.getByRole('button', { name: 'Close location panel' }).click()

    await page.getByText('Rivendell').first().click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()

    // Aragorn should now be available to place here
    await page.getByRole('button', { name: 'Add character here' }).click()
    await page.getByRole('button', { name: 'Choose character...' }).click()
    await page.getByRole('option', { name: 'Aragorn' }).click()
    // Remove button present means Aragorn was successfully added to this location
    await expect(page.getByRole('button', { name: 'Remove character from location' })).toBeVisible()
  })

  // ── Tap-to-place a character (touch-friendly, no HTML5 drag) ────────────────

  /**
   * A map with one location called Rivendell, and the time cursor parked on a
   * scene so there is a moment to place a character into.
   */
  async function mapWithRivendellAndCursor(page: Page) {
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await uploadMap(page, MAIN_MAP, 'Middle Earth')
    await expect(page.locator('.leaflet-container')).toBeVisible()

    await addLocationViaButton(page, { x: 300, y: 250 })
    await page.getByPlaceholder('e.g. Thornwall City').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Location' }).last().click()
    await expect(page.getByRole('heading', { name: 'Add Location' })).not.toBeVisible()

    // A chapter + event are needed so an active event cursor exists to place into.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Chapter One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()

    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('The Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText('The Departure').first()).toBeVisible()

    // Select the event in the timeline bar to set the active cursor.
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    await page.getByTitle('The Departure', { exact: true }).click()

    await page.getByRole('link', { name: /maps/i }).click()
    await settleNav(page)
    await expect(page.locator('.leaflet-container')).toBeVisible()
  }

  /** Where each character is recorded, by location name, straight from Dexie. */
  const placements = (page: Page) => page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      characters: { toArray: () => Promise<Array<{ id: string; name: string }>> }
      locationMarkers: { toArray: () => Promise<Array<{ id: string; name: string }>> }
      characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; currentLocationMarkerId: string | null }>> }
    }
    const [characters, markers, snaps] = await Promise.all([
      db.characters.toArray(), db.locationMarkers.toArray(), db.characterSnapshots.toArray(),
    ])
    const markerName = new Map(markers.map((m) => [m.id, m.name]))
    const out: Record<string, string | null> = {}
    for (const c of characters) {
      const s = snaps.find((x) => x.characterId === c.id)
      out[c.name] = s ? (s.currentLocationMarkerId ? markerName.get(s.currentLocationMarkerId) ?? null : null) : null
    }
    return out
  })

  test('places a character by arming the crosshair then tapping a location', async ({ page }) => {
    // The Leaflet map + timeline round-trip is heavy; give slow renders headroom.
    test.setTimeout(120_000)
    page.setDefaultTimeout(60_000)

    await mapWithRivendellAndCursor(page)

    // Arm placement for Aragorn; the placement HUD appears.
    await page.getByRole('button', { name: 'Place Aragorn on the map' }).click()
    await expect(page.getByText(/Tap a location to place/)).toBeVisible()

    // Tap the location marker to drop the character there.
    await page.getByText('Rivendell').first().click()
    await expect(page.getByText(/Tap a location to place/)).not.toBeVisible()

    // Aragorn's pin now renders on the map.
    await expect(page.locator('.leaflet-container').getByText('Aragorn')).toBeVisible()
  })

  /**
   * W19-1. The test above places into an *empty* location, which is the only
   * case that ever worked: a character pin covers its own location pin to
   * within about three pixels, and the location markers were lifted above the
   * pins only while an HTML5 drag was in flight. So tapping the middle of a
   * place somebody already stood in selected *them* and opened their panel —
   * over a hint still reading "Tap a location to place …" — while the placement
   * silently did not happen. Two people in one room is the ordinary case, and
   * the drag that worked around it does not exist on touch.
   *
   * This taps the exact centre of the occupied pin, which is the point that
   * failed, and reads the answer out of Dexie rather than off the screen.
   */
  test('and places a second character onto a location the first one is standing in', async ({ page }) => {
    test.setTimeout(120_000)
    page.setDefaultTimeout(60_000)

    await mapWithRivendellAndCursor(page)

    await page.getByRole('button', { name: 'Place Aragorn on the map' }).click()
    await page.getByText('Rivendell').first().click()
    const aragornPin = page.locator('.leaflet-container').getByText('Aragorn')
    await expect(aragornPin).toBeVisible()
    await expect.poll(async () => (await placements(page)).Aragorn).toBe('Rivendell')

    // Now Legolas, onto the same place — aiming at the middle of Aragorn's pin.
    await page.getByRole('button', { name: 'Place Legolas on the map' }).click()
    await expect(page.getByText(/Tap a location to place/)).toBeVisible()

    const box = (await aragornPin.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // Both are at Rivendell. Aragorn is in the assertion because a fix that
    // moved him instead of placing her would satisfy a check on Legolas alone.
    await expect.poll(async () => await placements(page), { timeout: 15_000 })
      .toMatchObject({ Aragorn: 'Rivendell', Legolas: 'Rivendell' })

    // And the crosshair let go, rather than the tap being swallowed by a panel.
    await expect(page.getByText(/Tap a location to place/)).toHaveCount(0)
  })

  /**
   * W23-3. The character pill is painted over the location marker it stands on
   * — measured at 145×34 against the marker's 143×34, on the same anchor — and
   * the pill used to drop the place name the moment a second character arrived:
   * `YS · Ysolde Vane / Wenmere Weir` became `YS +1 / 2 characters`. So the map
   * stopped answering *where* exactly when the answer to *who* got interesting,
   * and on the shipped Alice map `Riverbank above Wonderland` read as
   * `…lerland`.
   *
   * Both halves are asserted in one test, because the finding *is* the
   * difference between them: one character keeps the name, two must too.
   */
  test('and the place name stays on the pin when a second character joins', async ({ page }) => {
    test.setTimeout(120_000)
    page.setDefaultTimeout(60_000)

    await mapWithRivendellAndCursor(page)
    const canvas = page.locator('.leaflet-container')

    await page.getByRole('button', { name: 'Place Aragorn on the map' }).click()
    await page.getByText('Rivendell').first().click()
    await expect(canvas.getByText('Aragorn')).toBeVisible()

    /*
      Scoped to the character pin, not to the canvas.

      The first version of this asserted `canvas.getByText('Rivendell')` and was
      **vacuous**: the location marker's own label says Rivendell too and is
      still in the DOM, merely painted under the pill — so it passed with the
      fix reverted. Caught by mutating. What has to be true is that the *pin*
      carries the name.
    */
    const pinWith = (text: string) => canvas.locator('.leaflet-marker-icon', { hasText: text })

    // One character: the pill names them, and the place under them.
    await expect(pinWith('Aragorn')).toContainText('Rivendell')

    await page.getByRole('button', { name: 'Place Legolas on the map' }).click()
    const box = (await canvas.getByText('Aragorn').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // Two characters: the pill stops naming one of them, and must not stop
    // naming where they are.
    await expect(pinWith('2 characters')).toBeVisible({ timeout: 15_000 })
    await expect(pinWith('2 characters')).toContainText('Rivendell')
  })
})
