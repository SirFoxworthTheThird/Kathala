import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * IT-2 — the Items roster showed a type and a description, so with a cursor set
 * you still could not see what was where, on the screen devoted to items. The
 * resolution rules are unit-tested in `src/lib/__tests__/itemWhereabouts.test.ts`;
 * this drives the roster.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  items: [{ name: 'A brass key' }, { name: 'A salt chart' }],
  chapters: [{
    title: 'Landfall',
    events: [{
      id: 'e1', title: 'The wreck', characters: ['Kestrel'],
      changes: [{ who: 'Kestrel', location: 'Weathertop', gains: ['A brass key'] }],
    }],
  }],
})

async function itemsRoster(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('The Items roster', () => {
  test.describe.configure({ timeout: 150_000 })

  test('IT-2: with a moment set, a card says where the item is', async ({ page }) => {
    const worldId = await itemsRoster(page)

    // Absence first: on "all chapters" there is no moment to answer about, so
    // the card says nothing about where anything is.
    await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
    await expect(page.getByText('A brass key')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/carried by/)).toHaveCount(0)

    // Presence: opening the chapter sets the cursor (CD-2), and the key is in
    // Kestrel's hands at that moment.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Open chapter detail' }).first().click()
    await page.waitForTimeout(1200)
    await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })

    await expect(page.getByText(/carried by Kestrel/)).toBeVisible({ timeout: 20_000 })
    // The chart is in nobody's hands, so its card stays quiet rather than
    // inventing a place — which is what makes the line above worth reading.
    const chartLine = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('main a'))
        .find((a) => a.textContent?.includes('A salt chart'))
      return (card?.textContent ?? '').includes('carried by')
    })
    expect(chartLine, 'an unplaced item should not claim a carrier').toBe(false)
  })
})
