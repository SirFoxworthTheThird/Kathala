import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

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
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.mapLayers.add({
        id: 'l1', worldId: id, parentMapId: null, name: 'Vantage', description: '',
        imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null,
        scaleUnit: null, levelGroupId: null, levelIndex: null, levelLabel: null,
        createdAt: now, updatedAt: now,
      })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/maps/l1`, { waitUntil: 'load' })
    await settle(page)
    return worldId
  }

  test('offers a word to call it, and only for Custom', async ({ page }) => {
    await mapWithADialog(page)

    await page.getByRole('button', { name: /Add location|\+ Location/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })

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

    await page.getByRole('button', { name: /Add location|\+ Location/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
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
