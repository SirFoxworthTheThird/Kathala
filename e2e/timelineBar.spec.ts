import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// The bottom bar in a multi-timeline world: a scope selector that switches
// between one timeline and a merged view (chapter / chronological order). The
// ordering maths is unit-tested in src/lib/__tests__/combinedTimeline.test.ts;
// this drives the real bar.

test('the bottom bar scope selector switches between one timeline and all', async ({ page }) => {
  test.setTimeout(90000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Braided')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  const settleNav = async () => { await page.mouse.move(700, 400); await page.waitForTimeout(150) }
  const gotoTimeline = async () => { await page.getByRole('link', { name: /timeline/i }).first().click(); await settleNav() }
  const addEvent = async (title: string) => {
    await main.getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill(title)
    await page.getByRole('button', { name: 'Add Event' }).last().click()
  }
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }

  // Timeline A + Timeline B, each with an event.
  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await addChapter('The Meeting')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('A stolen glance')
  await gotoTimeline()
  await page.getByRole('button', { name: 'New Timeline' }).click()
  await addChapter('The Siege')
  await page.getByTitle('Open chapter detail').first().click()
  await addEvent('Ash writes home')
  await gotoTimeline()

  // The bar defaults to the merged view (chapter order) and shows both
  // timelines' scenes as scrubber ticks.
  const scope = page.getByLabel('Timeline bar scope')
  await expect(scope).toHaveValue('all-chapter')
  await expect(page.getByTitle('A stolen glance')).toBeVisible()
  await expect(page.getByTitle('Ash writes home')).toBeVisible()

  // Focus one timeline → the play control returns and the other timeline's
  // scene drops out of the bar.
  await scope.selectOption('Main Timeline')
  await expect(page.getByTitle('Play story on the map')).toBeVisible()
  await expect(page.getByTitle('A stolen glance')).toBeVisible()
  await expect(page.getByTitle('Ash writes home')).toHaveCount(0)

  // Back to a merged view (chronological) → both scenes return, no play control.
  await scope.selectOption('all-chrono')
  await expect(page.getByTitle('A stolen glance')).toBeVisible()
  await expect(page.getByTitle('Ash writes home')).toBeVisible()
  await expect(page.getByTitle('Play story on the map')).toHaveCount(0)
})
