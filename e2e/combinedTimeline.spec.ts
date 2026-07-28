import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Two timelines, each with a chapter + event. The "All timelines" tab merges
// them into one sequence, with an order toggle shared (and persisted) with the
// bottom bar's scope selector. The ordering maths is unit-tested in
// src/lib/__tests__/combinedTimeline.test.ts; this drives the real view.

test('All timelines tab shows events from every timeline in one sequence', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Multi')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const gotoTimeline = () => page.getByRole('link', { name: /timeline/i }).first().click()
  const addEvent = async (title: string) => {
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill(title)
    await page.getByRole('button', { name: 'Add Event' }).last().click()
  }
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }

  // First timeline + chapter + event (added while it's the active timeline).
  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await addChapter('One')
  await addEvent('Alpha scene')

  // Second timeline (New Timeline makes it active) + chapter + event.
  await gotoTimeline()
  await page.getByRole('button', { name: 'New Timeline' }).click()
  await addChapter('Two')
  await addEvent('Beta scene')

  // Open the combined scope.
  await gotoTimeline()
  await page.getByRole('tab', { name: 'All timelines' }).click()

  // Both timelines' events appear in the one merged list — default order is
  // the reading-order merge, matching the bottom bar's default scope.
  const main = page.getByRole('main')
  await expect(main.getByText('Every timeline merged in reading order', { exact: false })).toBeVisible()
  await expect(main.getByText('Alpha scene', { exact: true })).toBeVisible()
  await expect(main.getByText('Beta scene', { exact: true })).toBeVisible()
  await expect(main.getByText(/2 timelines · 2 chapters/)).toBeVisible()

  // Each row is tagged with the timeline it belongs to.
  await expect(main.getByText(/Main Timeline · Ch\. 1 — One/)).toBeVisible()
  await expect(main.getByText(/Timeline 2 · Ch\. 1 — Two/)).toBeVisible()

  // The order toggle is shared with the bottom bar's scope selector:
  // switching to Chronological here updates the bar…
  const barScope = page.getByLabel('Timeline bar scope')
  await page.getByRole('button', { name: 'Chronological' }).click()
  await expect(main.getByText('Every timeline merged by in-world day', { exact: false })).toBeVisible()
  await expect(barScope).toHaveValue('all-chrono')

  // …and changing the bar updates the tab.
  await barScope.selectOption('all-chapter')
  await expect(main.getByText('Every timeline merged in reading order', { exact: false })).toBeVisible()

  // The chosen scope survives a reload (persisted store).
  await barScope.selectOption('all-chrono')
  await page.reload({ waitUntil: 'load' })
  await expect(page.getByLabel('Timeline bar scope')).toHaveValue('all-chrono')
})
