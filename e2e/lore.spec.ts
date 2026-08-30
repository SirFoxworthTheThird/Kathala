import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Lore on a phone viewport', () => {
  test('category sidebar collapses into a drawer, no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 })

    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })

    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

    // The header and content fit — no sideways scroll.
    await expect(page.getByRole('heading', { name: 'Lore' })).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)

    // The category sidebar is off-canvas by default: "New category" (a sidebar-only
    // control) sits off the left edge until the drawer is opened.
    const newCategory = page.getByRole('button', { name: 'New category' })
    const closedBox = await newCategory.boundingBox()
    expect(closedBox).not.toBeNull()
    expect(closedBox!.x).toBeLessThan(0)

    // Tapping "Categories" slides the drawer in on-screen.
    await page.getByRole('button', { name: 'Categories' }).click()
    await expect.poll(async () => (await newCategory.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})
