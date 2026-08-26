import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Tag one of two scenes with a plot thread, then use the Timeline's thread
// filter to focus on that subplot. The filter maths is unit-tested in
// src/lib/__tests__/plotThreads.test.ts; this drives the real view.

test('the timeline thread filter shows only scenes on the chosen subplot', async ({ page }) => {
  test.setTimeout(90000)
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Braided')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  // Hovering a nav link expands the left rail (it overlays content); move the
  // cursor into the content afterwards so the rail collapses and doesn't
  // intercept clicks on left-aligned controls.
  const settleNav = async () => { await page.mouse.move(700, 400); await page.waitForTimeout(200) }
  const gotoTimeline = async () => {
    await page.getByRole('link', { name: /timeline/i }).first().click()
    await settleNav()
  }

  // Timeline → chapter → two events.
  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').first().click()
  const addEvent = async (title: string) => {
    await main.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
  }
  await addEvent('Romance scene')
  await addEvent('Heist scene')

  // Create a plot thread on the dashboard.
  await page.getByRole('link', { name: /dashboard/i }).first().click()
  await settleNav()
  await page.getByRole('button', { name: 'New thread' }).click()
  await page.getByPlaceholder(/Thread name/).fill('The Romance')
  await page.getByPlaceholder(/Thread name/).press('Enter')
  await expect(page.getByText('The Romance')).toBeVisible()

  // Tag only the first scene with the thread (in the chapter detail card).
  await gotoTimeline()
  await page.getByTitle('Open chapter detail').first().click()
  await main.getByRole('button', { name: 'Romance scene', exact: true }).click()
  // A scene with no threads on it does not draw the Plot Threads section any
  // more — it is offered as a chip instead, so open it first.
  await main.getByRole('button', { name: '+ Plot Threads' }).click()
  await main.getByRole('button', { name: '+ Tag a thread…' }).click()
  await page.getByRole('option', { name: 'The Romance' }).click()
  await expect(main.getByLabel('Remove thread The Romance')).toBeVisible()

  // Back on the timeline, filter to the thread → only the tagged scene remains.
  await gotoTimeline()
  await page.getByRole('button', { name: 'The Romance' }).click()
  await expect(main.getByRole('button', { name: 'Romance scene', exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Heist scene', exact: true })).toHaveCount(0)

  // Clearing the filter and expanding the chapter brings the other scene back.
  await page.getByRole('button', { name: 'All threads' }).click()
  await main.getByText('Ch. 1 — One').click()
  await expect(main.getByRole('button', { name: 'Romance scene', exact: true })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Heist scene', exact: true })).toBeVisible()
})
