import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { waitForMapReady } from './helpers/map'

function labels(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const all = req.result.transaction('mapLayers', 'readonly').objectStore('mapLayers').getAll()
          all.onsuccess = () => resolve(all.result.filter((l) => l.levelGroupId).map((l) => l.levelLabel))
          all.onerror = () => reject(all.error)
        }
      }),
  )
}

test('rename a floor from the switcher', async ({ page }) => {
  test.slow()

  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  // Generate a leveled castle (two floors).
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [
      { name: 'Castle', type: 'building', levels: [
        { name: 'Ground floor', children: [{ name: 'Great Hall' }] },
        { name: 'First floor', children: [{ name: 'Library' }] },
      ]},
    ],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await waitForMapReady(page)

  // Open the castle so the floor switcher appears.
  await page.locator('[data-layer-drop]').filter({ hasText: 'Castle' }).first().click()
  const firstFloorBtn = page.getByRole('button', { name: 'First floor' })
  await expect(firstFloorBtn).toBeVisible()

  // Double-click to rename it to "Attic".
  await firstFloorBtn.dblclick()
  const input = page.getByRole('textbox', { name: 'Rename level' })
  await expect(input).toBeVisible()
  await input.fill('Attic')
  await input.press('Enter')

  await expect(page.getByRole('button', { name: 'Attic' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'First floor' })).toHaveCount(0)
  await expect.poll(async () => (await labels(page)).sort()).toEqual(['Attic', 'Ground floor'])
})
