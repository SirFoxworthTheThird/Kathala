import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// A phone-sized viewport where a Select trigger low in the location panel would,
// without viewport-aware positioning, push its option list off the bottom edge.
test.use({ viewport: { width: 390, height: 667 } })

test('sub-map link dropdown stays within the viewport on mobile', async ({ page }) => {
  test.slow() // the maps view mounts a Leaflet canvas

  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  // Generate a few places: some with children (→ sub-map layers, so the "link a
  // sub-map" Select has options) and a leaf whose marker has no sub-map yet.
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [
      { name: 'Northshire', children: [{ name: 'A Hamlet' }] },
      { name: 'Southvale', children: [{ name: 'A Village' }] },
      { name: 'Eastwood', children: [{ name: 'A Camp' }] },
      { name: 'Plainville' },
    ],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await expect(page.getByRole('button', { name: 'AI Locations' })).toBeVisible({ timeout: 15_000 })

  // Open the mobile drawer, expand Locations, and open the leaf location's panel.
  await page.getByRole('button', { name: 'Open map panels' }).click()
  await page.getByRole('button', { name: /^Locations/ }).first().click()
  await page.getByRole('button', { name: 'Plainville' }).first().click()
  // The drawer sits above the detail panel on mobile; close it to reveal the panel.
  await page.getByRole('button', { name: 'Close map panels' }).click()

  // Open the sub-map link Select (shows "None" since this leaf has no sub-map).
  const trigger = page.getByRole('button', { name: 'None', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()

  // The whole option list must stay on screen (it flips above / caps its height
  // and scrolls internally) so every sub-map option is reachable.
  const listbox = page.locator('[role="listbox"]')
  await expect(listbox).toBeVisible()
  const box = (await listbox.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height).toBeLessThanOrEqual(667 + 1)
})
