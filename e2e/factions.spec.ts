import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Factions on a phone viewport', () => {
  // World creation plus a route change is ~30s of real work here, right on
  // Playwright's default per-test budget.
  test.describe.configure({ timeout: 90_000 })

  test('detail panel opens as a full-screen overlay without horizontal overflow', async ({ page }) => {
    // Phone-sized viewport: the two-column split layout must collapse.
    await page.setViewportSize({ width: 390, height: 780 })

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

test.describe('Factions on a desktop viewport', () => {
  test('the grid uses the full width until a faction is selected', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 820 })

    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Fac Desktop')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]
    await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })

    await page.getByRole('button', { name: 'New Faction' }).click()
    await page.getByPlaceholder('Faction name…').fill('The Order')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Delete Faction' })).toBeVisible()

    // Creating auto-selects, so the panel is open and the grid is inset by it.
    const edges = () =>
      page.evaluate(() => {
        const main = document.querySelector('main') as HTMLElement
        const grid = document.querySelector('main .grid') as HTMLElement
        return {
          gap: Math.round(
            main.getBoundingClientRect().right - grid.getBoundingClientRect().right,
          ),
        }
      })
    expect((await edges()).gap).toBeGreaterThan(200)

    // Closing it gives the width back — no reserved placeholder column, which is
    // how every other list view in the app behaves.
    await page.getByRole('button', { name: 'Close faction panel' }).click()
    await expect(page.getByRole('button', { name: 'Delete Faction' })).toHaveCount(0)
    expect((await edges()).gap).toBeLessThanOrEqual(24)
  })
})
