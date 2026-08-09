import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * SEL-1: five equal-weight entry points in a row, with nothing grouping them.
 * Three mean "I already have something" and two mean "I'm starting fresh", so a
 * newcomer had to read all five to find themselves.
 *
 * The split is a real `role="group"`, not a visual arrangement — a heading that
 * only the eye can see would leave a screen-reader user with the original row.
 */
test.describe('World selector entry points', () => {
  test.describe.configure({ timeout: 90_000 })

  test('the five ways in are grouped by what you already have', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    const fresh = page.getByRole('group', { name: 'Start something new' })
    const bring = page.getByRole('group', { name: 'Bring something in' })
    await expect(fresh).toBeVisible({ timeout: 30_000 })
    await expect(bring).toBeVisible()

    // Each entry point is in exactly one group, and in the right one.
    await expect(fresh.getByRole('button', { name: 'New World' })).toBeVisible()
    await expect(fresh.getByRole('button', { name: 'Generate World from AI' })).toBeVisible()
    await expect(bring.getByRole('button', { name: 'Library' })).toBeVisible()
    await expect(bring.getByRole('button', { name: 'Import World' })).toBeVisible()
    await expect(bring.getByRole('button', { name: 'Import Manuscript' })).toBeVisible()

    // The paired absence: nothing has crossed over. Vacuity cannot satisfy both
    // halves — a group that failed to render would fail the assertions above.
    await expect(fresh.getByRole('button', { name: 'Library' })).toHaveCount(0)
    await expect(fresh.getByRole('button', { name: 'Import Manuscript' })).toHaveCount(0)
    await expect(bring.getByRole('button', { name: 'New World' })).toHaveCount(0)

    // Nothing was buried to achieve the grouping: all five are still one click
    // away, which is the cost the "primary plus a menu" alternative would have
    // charged to Library — the best first run this app has.
    for (const name of ['New World', 'Generate World from AI', 'Library', 'Import World', 'Import Manuscript']) {
      await expect(page.getByRole('button', { name, exact: true }).first(), `${name} should be visible without opening a menu`).toBeVisible()
    }

    // And the grouping is decoration only — the buttons still work.
    await fresh.getByRole('button', { name: 'New World' }).click()
    await expect(page.getByLabel('Name')).toBeVisible()
  })
})
