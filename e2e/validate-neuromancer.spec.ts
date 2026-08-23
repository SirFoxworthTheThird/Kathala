import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { shot } from './helpers/shot'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PWK_PATH = path.resolve(__dirname, '../public/library/neuromancer.pwk')

test.describe('Neuromancer Visual Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
  })

  test('import and validate Neuromancer', async ({ page }, testInfo) => {
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(PWK_PATH)
    await expect(page.getByRole('heading', { name: 'Neuromancer' })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    await shot(page, testInfo, '01-world-home.png')

    // Disable reading mode
    await page.evaluate(async () => {
      const db = (window as any).__pwdb
      if (db) await db.worlds.update('neuromancer-world', { readingMode: false })
    })
    await page.waitForTimeout(2000)

    const main = page.getByRole('main')

    // Characters
    await page.getByRole('link', { name: /characters/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '02-characters.png')
    for (const name of ['Henry Dorsett Case', 'Molly Millions', 'Armitage', 'Dixie Flatline',
      'Lady 3Jane Tessier-Ashpool', 'Peter Riviera', 'Maelcum']) {
      await expect(main.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 5000 })
    }
    console.log('All key characters visible')

    // Timeline
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '03-timeline.png')

    // Maps
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '04-maps.png')

    // Relationships
    await page.getByRole('link', { name: /relations/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '05-relationships.png')

    // Lore
    await page.getByRole('link', { name: /lore/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '06-lore.png')

    // Factions
    await page.getByRole('link', { name: /factions/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '07-factions.png')

    // Items
    await page.getByRole('link', { name: /items/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '08-items.png')

    // Calendar
    await page.getByRole('link', { name: /calendar/i }).first().click()
    await page.waitForTimeout(3000)
    await shot(page, testInfo, '09-calendar.png')

    console.log('Visual validation complete')
  })
})
