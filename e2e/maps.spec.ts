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

  // The file input is hidden; set the file directly
  const fileInput = page.locator('input[type="file"][accept="image/*"]')
  await fileInput.setInputFiles(imagePath)

  // Auto-fills name from filename; override with our desired name
  await page.getByLabel('Map Name').clear()
  await page.getByLabel('Map Name').fill(mapName)

  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  // Wait for the dialog to close
  await expect(page.getByRole('heading', { name: /Upload Map|Add Sub-Map/ })).not.toBeVisible()
}

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
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
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
})
