import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { shot } from './helpers/shot'
import { settle } from './helpers/settle'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PWK_PATH = path.resolve(__dirname, '../public/library/the-secret-garden.pwk')

test.describe('Secret Garden Visual Validation', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('import and validate The Secret Garden', async ({ page }, testInfo) => {
    // Import
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(PWK_PATH)
    await expect(page.getByRole('heading', { name: 'The Secret Garden' })).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    await shot(page, testInfo, '01-world-home.png')

    // Disable reading mode via Dexie's own API (window.__pwdb is exposed in dev/e2e)
    await page.evaluate(async () => {
      const db = (window as any).__pwdb
      if (db) await db.worlds.update('secret-garden-world', { readingMode: false })
    })
    await page.waitForTimeout(2000)

    // Characters
    await page.getByRole('link', { name: /characters/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '02-characters.png')

    // Verify key characters (use exact:true + first() to avoid ambiguity)
    const main = page.getByRole('main')
    for (const name of ['Mary Lennox', 'Colin Craven', 'Dickon Sowerby', 'Martha Sowerby',
      'Archibald Craven', 'Ben Weatherstaff', 'Susan Sowerby', 'Mrs Medlock', 'Dr Craven']) {
      await expect(main.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 5000 })
    }
    console.log('All characters visible')

    // Timeline
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '03-timeline.png')
    // Verify Ch.7 title fix
    await expect(main.getByText('The Key in the Garden')).toBeVisible()
    console.log('Ch.7 title verified')

    // Maps
    await page.getByRole('link', { name: /maps/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '04-maps.png')

    // Relationships
    await page.getByRole('link', { name: /relations/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '05-relationships.png')

    // Lore
    await page.getByRole('link', { name: /lore/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '06-lore.png')

    // Factions
    await page.getByRole('link', { name: /factions/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '07-factions.png')

    // Knowledge
    await page.getByRole('link', { name: /knowledge/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '08-knowledge.png')

    // Items
    await page.getByRole('link', { name: /items/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '09-items.png')

    // Calendar
    await page.getByRole('link', { name: /calendar/i }).first().click()
    await settle(page)
    await shot(page, testInfo, '10-calendar.png')

    console.log('Visual validation complete')
  })
})
