import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * TL-5: the timeline's thread filter wrapped without limit, so it grew a row at
 * a time as the writer added threads and took the space from the chapters
 * below. The fold maths is unit-tested in `src/lib/__tests__/threadStrip.test.ts`;
 * this drives the strip with more threads than fit.
 */
test('the thread filter stops growing, and folds the rest behind a count', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Braided Deep')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()

  // Eight threads — two more than the strip draws.
  await page.getByRole('link', { name: /dashboard/i }).first().click()
  await settleNav(page)
  for (let i = 1; i <= 8; i++) {
    await page.getByRole('button', { name: 'New thread' }).click()
    await page.getByPlaceholder(/Thread name/).fill(`Thread ${i}`)
    await page.getByPlaceholder(/Thread name/).press('Enter')
    await expect(page.getByText(`Thread ${i}`).first()).toBeVisible()
  }

  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  const strip = page.getByRole('group', { name: 'Filter by plot thread' })

  // "All threads", six thread pills, and the fold — not eleven.
  await expect(strip.getByRole('button')).toHaveCount(8, { timeout: 15_000 })
  await expect(strip.getByRole('button', { name: 'Thread 8', exact: true })).toHaveCount(0)
  const fold = strip.getByRole('button', { name: '+2 more' })
  await expect(fold).toBeVisible()

  // Unfolding shows the rest — the same locator that found nothing above, so
  // the absence cannot be passing vacuously.
  await fold.click()
  await expect(strip.getByRole('button', { name: 'Thread 8', exact: true })).toBeVisible()
  await expect(strip.getByRole('button')).toHaveCount(10)
  await expect(strip.getByRole('button', { name: 'Show fewer' })).toBeVisible()

  // Folding again while a hidden thread is the active filter keeps that thread
  // on screen: a strip cannot filter by something it does not show.
  await strip.getByRole('button', { name: 'Thread 8', exact: true }).click()
  await strip.getByRole('button', { name: 'Show fewer' }).click()
  await expect(strip.getByRole('button', { name: 'Thread 8', exact: true })).toBeVisible()
  await expect(strip.getByRole('button', { name: '+1 more' })).toBeVisible()
})
