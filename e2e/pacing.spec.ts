import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

// Covers the browser-only parts of the pacing curve that unit tests can't reach:
// the EventCard tension picker, the SVG curve reflecting a rating, and clicking
// a curve point to move the global time cursor.

async function setupEvent(page: Page) {
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Pacing World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).click()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await page.getByRole('button', { name: 'Add Chapter' }).first().click()
  await page.getByPlaceholder('Chapter title').fill('Act One')
  await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  await page.getByTitle('Open chapter detail').click()
  await expect(page).toHaveURL(/#\/worlds\/.+\/timeline\/.+/)

  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Add Event' }).first().click()
  await page.getByPlaceholder('Event title').fill('The Departure')
  await page.getByRole('button', { name: 'Add Event' }).last().click()
  await expect(main.getByRole('button', { name: 'The Departure', exact: true })).toBeVisible()
}

test.describe('Pacing curve', () => {
  test('rating a scene draws it on the curve and points move the time cursor', async ({ page }) => {
    await setupEvent(page)

    // The curve is present on the timeline but empty until a scene is rated.
    await page.getByRole('link', { name: /timeline/i }).click()
    await expect(page.getByText('Pacing — dramatic tension')).toBeVisible()
    await expect(page.getByText('rate scenes on their cards to draw the curve')).toBeVisible()

    // Rate the scene's tension from the event card (browser-only picker). The
    // picker buttons are labelled by level; target by exact name so the header
    // badge (whose title also contains "(5/5)") doesn't collide.
    await page.getByTitle('Open chapter detail').click()
    await page.getByRole('main').getByRole('button', { name: 'The Departure', exact: true }).click()
    // An unrated scene does not draw the Dramatic Tension section any more — it
    // is offered as a chip instead, so open it first.
    await page.getByRole('main').getByRole('button', { name: '+ Dramatic Tension' }).click()
    await page.getByRole('button', { name: '5', exact: true }).click()
    // Header badge reflects the rating.
    await expect(page.getByText('5/5')).toBeVisible()

    // Back on the timeline the curve now has a rated point (the hint is gone).
    await page.getByRole('link', { name: /timeline/i }).click()
    await settleNav(page)
    await expect(page.getByText('rate scenes on their cards to draw the curve')).not.toBeVisible()

    // Clicking the curve point moves the global time cursor to that event —
    // verified via the Writer's Brief, which briefs that moment once one is
    // active. Asserted as a presence: the panel's no-cursor state is now a
    // scene picker (WB-1), so an absence here would pass either way.
    await page.locator('g.cursor-pointer').first().click()
    await page.getByTitle("Writer's Brief").click()
    await expect(page.getByText('Active Event')).toBeVisible()
  })

  test('clicking the active tension level clears the rating', async ({ page }) => {
    await setupEvent(page)

    await page.getByRole('main').getByRole('button', { name: 'The Departure', exact: true }).click()
    await page.getByRole('main').getByRole('button', { name: '+ Dramatic Tension' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.getByText('3/5')).toBeVisible()

    // Clicking the same level again clears it back to unrated.
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.getByText('3/5')).toHaveCount(0)
  })
})
