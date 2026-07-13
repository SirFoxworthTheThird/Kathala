import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Factions on a phone viewport', () => {
  test('detail panel opens as a full-screen overlay without horizontal overflow', async ({ page }) => {
    // Phone-sized viewport: the two-column split layout must collapse.
    await page.setViewportSize({ width: 390, height: 780 })

    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Fac World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Go straight to the factions route (the nav link lives behind the mobile menu).
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]
    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })

    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    // The empty/list view must not overflow horizontally.
    await expect(page.getByRole('heading', { name: 'Factions' })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)

    // Create a faction — this auto-selects it and opens the detail panel.
    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('The Order')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // The detail panel is shown (its footer action is the open signal) and the
    // page still doesn't scroll sideways.
    const deleteBtn = page.getByRole('button', { name: 'Delete Faction' })
    await expect(deleteBtn).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)

    // On mobile the panel covers the full width (overlay), so its footer action
    // is fully on-screen rather than pushed off the right edge by a fixed column.
    const box = await deleteBtn.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  })
})
