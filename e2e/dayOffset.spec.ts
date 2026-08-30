import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// A per-timeline start day set in World settings shifts that timeline's clock
// in the chronological merge. The maths is unit-tested in
// src/lib/__tests__/inWorldTime.test.ts; this drives the settings input and
// the All-timelines view.

test('a timeline start day shifts its era in the chronological merge', async ({ page }) => {
  test.setTimeout(90000)
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Eras')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  const settleNav = async () => { await page.mouse.move(700, 400); await page.waitForTimeout(150) }
  const gotoTimeline = async () => { await page.getByRole('link', { name: /timeline/i }).first().click(); await settleNav() }
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }
  const addEvent = async (title: string) => {
    await main.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
  }

  // Two timelines, one event each.
  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await addChapter('The Past')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('An old wound')
  await gotoTimeline()
  await page.getByRole('button', { name: 'New Timeline' }).click()
  await addChapter('The Present')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('The wound aches')

  // Give the second timeline a start day in World settings.
  await page.getByRole('link', { name: /settings/i }).first().click()
  await settleNav()
  const offsetInput = page.getByLabel('starts at day').nth(1)
  await offsetInput.fill('100')
  await offsetInput.blur()

  // The chronological merge now places the present era at day 100.
  await gotoTimeline()
  await page.getByRole('tab', { name: 'All timelines' }).click()
  await page.getByRole('button', { name: 'Chronological' }).click()
  await expect(main.getByText('Day 100', { exact: true })).toBeVisible()
  await expect(main.getByText('Day 0', { exact: true })).toBeVisible()
})
