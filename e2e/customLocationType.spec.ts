import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady } from './helpers/map'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

/**
 * **Custom** is an escape hatch, not a seventh label.
 *
 * The six named types are a fantasy vocabulary — City, Town, Dungeon,
 * Landmark, Region, Building — and `custom` was a literal member of the enum.
 * A writer mapping a space station got four "Building"s and one pin reading
 * *Marn's Office · Custom*, with the word printed as though it were a kind of
 * place, and a type filter that could not tell any of them apart.
 *
 * The field only appears for Custom, so this is about what is on screen.
 */
test.describe('a custom location type carries the writer\'s own word', () => {
  test.describe.configure({ timeout: 240_000 })

  async function mapWithADialog(page: import('@playwright/test').Page) {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Station')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    /*
      A real uploaded image, not a seeded blank layer. The floating toolbar —
      which is the only way to reach Add location — mounts on an active layer,
      and a layer seeded through `__pwdb` with `imageId: null` never becomes
      one. Seeding it looked like the cheap route and cost an hour.
    */
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await expect(page.getByRole('heading', { name: /Upload Map/ })).toBeVisible()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Vantage')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)
    return worldId
  }

  /**
   * The dialog has no button of its own. **Location** on the floating toolbar
   * puts the map into add-marker mode, and the dialog opens where you then
   * click the canvas — so placing a pin is two steps, not one.
   */
  async function openAddLocation(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Location', exact: true }).click()
    await page.locator('.leaflet-container').click({ position: { x: 300, y: 220 } })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    return dialog
  }

  test('offers a word to call it, and only for Custom', async ({ page }) => {
    await mapWithADialog(page)

    const dialog = await openAddLocation(page)

    /*
      The absence half first, on the type the dialog opens with. Without it a
      field rendered unconditionally would satisfy the presence half below.
    */
    await expect(dialog.getByLabel('Call it')).toHaveCount(0)

    await dialog.getByRole('button', { name: /^Type / }).click()
    await page.getByRole('option', { name: 'Custom' }).click()
    await expect(dialog.getByLabel('Call it')).toBeVisible()

    // Switching back takes it away again — the field belongs to the type.
    await dialog.getByRole('button', { name: /^Type / }).click()
    await page.getByRole('option', { name: 'City' }).click()
    await expect(dialog.getByLabel('Call it')).toHaveCount(0)
  })

  test('and stores it against the marker, not the enum', async ({ page }) => {
    const worldId = await mapWithADialog(page)

    const dialog = await openAddLocation(page)
    await dialog.getByLabel('Name').fill('Bay Nineteen')
    await dialog.getByRole('button', { name: /^Type / }).click()
    await page.getByRole('option', { name: 'Custom' }).click()
    await dialog.getByLabel('Call it').fill('Docking bay')
    await dialog.getByRole('button', { name: /^(Add|Create|Save)/ }).last().click()
    await expect(dialog).toHaveCount(0)

    const stored = await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ name: string; iconType: string; customType?: string }>> } } }>
      return (await db.locationMarkers.where('worldId').equals(id).toArray())
        .map((m) => ({ name: m.name, iconType: m.iconType, customType: m.customType }))
    }, worldId)

    // The enum still picks the pin; the word is only the label.
    expect(stored).toEqual([{ name: 'Bay Nineteen', iconType: 'custom', customType: 'Docking bay' }])
  })
})
