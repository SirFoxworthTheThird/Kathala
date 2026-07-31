import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

// The bottom bar in a multi-timeline world: a scope selector that switches
// between one timeline and a merged view, and a read-through Play for the merge.
// The ordering maths is unit-tested in src/lib/__tests__/combinedTimeline.test.ts;
// these drive the real bar.

const settleNav = (page: Page) => page.mouse.move(700, 400).then(() => page.waitForTimeout(150))

/** Two timelines, each with one chapter + event. Leaves the app on the timeline. */
async function setupTwoTimelines(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Braided')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  const main = page.getByRole('main')
  const gotoTimeline = async () => { await page.getByRole('link', { name: /timeline/i }).first().click(); await settleNav(page) }
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
}

test('the bottom bar scope selector switches between one timeline and all', async ({ page }) => {
  test.setTimeout(90000)
  await setupTwoTimelines(page)

  // Defaults to the merged view (chapter order), showing both timelines' scenes.
  const scope = page.getByLabel('Timeline bar scope')
  await expect(scope).toHaveValue('all-chapter')
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toBeVisible()

  // Focus one timeline → the map play control returns and the other timeline's
  // scene drops out of the bar.
  await scope.selectOption('Main Timeline')
  await expect(page.getByTitle('Play story on the map')).toBeVisible()
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toHaveCount(0)

  // Back to a merged view (chronological) → both scenes return.
  await scope.selectOption('all-chrono')
  await expect(page.getByTitle('A stolen glance', { exact: true })).toBeVisible()
  await expect(page.getByTitle('Ash writes home', { exact: true })).toBeVisible()
})

test('the merged view plays every timeline on the map, following each event', async ({ page }) => {
  test.setTimeout(90000)
  await setupTwoTimelines(page)

  await expect(page.getByLabel('Timeline bar scope')).toHaveValue('all-chapter')

  // The merged Play runs on the map like any playback…
  await page.getByTitle('Play all timelines on the map').click()
  await expect(page).toHaveURL(/#\/worlds\/[^/]+\/maps/)

  // …advancing the cursor from the first timeline's scene ("A stolen glance")
  // into the second timeline's ("Ash writes home"); the bar stays visible.
  await expect(page.getByText('Ash writes home', { exact: true })).toBeVisible({ timeout: 15000 })
})
