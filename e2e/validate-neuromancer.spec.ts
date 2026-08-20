import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PWK_PATH = path.resolve(__dirname, '../public/library/neuromancer.pwk')
const SS = (name: string) => path.join(__dirname, '../screenshots/validation', name)

test.describe('Neuromancer Visual Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
  })

  test('import and validate Neuromancer', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(PWK_PATH)
    await expect(page.getByRole('heading', { name: 'Neuromancer' })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: SS('01-world-home.png'), fullPage: false })

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
    await page.screenshot({ path: SS('02-characters.png'), fullPage: false })
    for (const name of ['Henry Dorsett Case', 'Molly Millions', 'Armitage', 'Dixie Flatline',
      'Lady 3Jane Tessier-Ashpool', 'Peter Riviera', 'Maelcum']) {
      await expect(main.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 5000 })
    }
    console.log('All key characters visible')

    // Timeline
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('03-timeline.png'), fullPage: false })

    // Maps
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('04-maps.png'), fullPage: false })

    // Relationships
    await page.getByRole('link', { name: /relations/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('05-relationships.png'), fullPage: false })

    // Lore
    await page.getByRole('link', { name: /lore/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('06-lore.png'), fullPage: false })

    // Factions
    await page.getByRole('link', { name: /factions/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('07-factions.png'), fullPage: false })

    // Items
    await page.getByRole('link', { name: /items/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('08-items.png'), fullPage: false })

    // Calendar
    await page.getByRole('link', { name: /calendar/i }).first().click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: SS('09-calendar.png'), fullPage: false })

    console.log('Visual validation complete')
  })
})
