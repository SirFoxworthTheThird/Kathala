import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * Part C: the continuity checker runs its rules only while it is open. It used
 * to be mounted always, rendering nothing while closed and still re-running
 * every rule on every write — on Little Women most of the time a paste onto the
 * Page took (`e2e/scalePerf.spec.ts`).
 *
 * A run is counted by its `kathala:checker` measure. None while the panel is
 * closed, across writes it would have re-run for; one as soon as it opens, so
 * the count is one that can move.
 */

const runs = (page: Page) => page.evaluate(() => performance.getEntriesByName('kathala:checker').length)

async function addCharacter(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill(name)
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByRole('main').getByText(name).first()).toBeVisible()
}

test('the checker runs nothing while it is closed, and runs when it is opened', async ({ page }) => {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Closed Book')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByTitle('Characters').click()
  await settleNav(page)
  await addCharacter(page, 'Amalia')
  await addCharacter(page, 'Bertil')
  // Long enough for a run each write would have set off.
  await page.waitForTimeout(1_000)
  expect(await runs(page)).toBe(0)

  await page.getByTitle('Continuity Checker').click()
  await expect(page.getByRole('dialog').getByText('Continuity Checker').first()).toBeVisible()
  await expect.poll(() => runs(page)).toBeGreaterThan(0)

  // Closed again, it stops.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const opened = await runs(page)
  await addCharacter(page, 'Cecilia')
  await page.waitForTimeout(1_000)
  expect(await runs(page)).toBe(opened)
})
