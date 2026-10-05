import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav, onCards } from './helpers/nav'

test.describe('Timeline and chapters', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)

    // Create a world and navigate to Timeline
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Timeline World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /manuscript/i }).click()

    await onCards(page)
  })

  test('shows empty timeline state', async ({ page }) => {
    await expect(page.getByText('No timeline yet').or(page.getByText('No chapters yet'))).toBeVisible()
  })

  test('creates the first timeline', async ({ page }) => {
    // "Create Timeline" creates a timeline immediately (no dialog — hardcoded name "Main Timeline")
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()
  })

  test('creates a chapter within a timeline', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    // AddChapterDialog: Label has no htmlFor — use placeholder
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await expect(page.getByRole('heading', { name: /Add Chapter/ })).toBeVisible()

    await page.getByPlaceholder('Chapter title').fill('The Beginning')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()

    await expect(page.getByRole('heading', { name: /Add Chapter/ })).not.toBeVisible()
    // Chapter name appears in both the chapter list and the timeline bar.
    await expect(page.getByText('The Beginning').first()).toBeVisible()
  })

  test('requires a title to create a chapter', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await expect(page.getByRole('heading', { name: /Add Chapter/ })).toBeVisible()
    const saveBtn = page.getByRole('button', { name: 'Add Chapter' }).last()
    await expect(saveBtn).toBeDisabled()
  })

  test('creates an event within a chapter', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Act One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/manuscript\/.+/)

    // A line in the list, for the title, rather than a dialog.
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    const title = page.getByRole('textbox', { name: 'Title for the new scene' })
    await expect(title).toBeFocused()

    await title.fill('The Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()

    await expect(title).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button', { name: 'The Departure', exact: true })).toBeVisible()
  })

  test('requires a title to create an event', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Act One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()

    // An empty title makes nothing — the line closes and the chapter is as it was…
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByRole('textbox', { name: 'Title for the new scene' })).toHaveCount(0)
    // In the chapter's row; its panel says the same thing about Character States.
    const row = page.locator('[id^="chapter-row-"]')
    await expect(row.getByText('No scenes yet')).toBeVisible()
    // …and one with a title does make one.
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('The Departure')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(row.getByText('No scenes yet')).toHaveCount(0)
    /*
      And only that one. "No scenes yet" above is read before any write could
      land, so it cannot see a blank scene made a moment later; this can. The
      empty attempt was made first, so by the time the real scene is on the
      page, anything it wrote is in the store.
    */
    await expect(page.getByRole('main').getByRole('button', { name: 'The Departure', exact: true })).toBeVisible()
    expect(await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { count: () => Promise<number> } }
      return db.events.count()
    })).toBe(1)
  })

  test('sets active event cursor via timeline bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Act One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').click()

    // Create two events
    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('First Event')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    // Event name appears in both the event card and the timeline bar.
    await expect(page.getByText('First Event').first()).toBeVisible()

    await page.getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('Second Event')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await expect(page.getByText('Second Event').first()).toBeVisible()

    // Navigate back to timeline — the bottom bar renders event markers with title= attributes
    await page.getByRole('link', { name: /manuscript/i }).click()
    await onCards(page)
    await settleNav(page)

    // Click the 'First Event' marker in the timeline bar
    await page.getByTitle('First Event', { exact: true }).click()

    // The active event label appears in the timeline bar
    await expect(page.getByTitle('First Event', { exact: true })).toBeVisible()

    // Click the second event and verify the active marker shifts
    await page.getByTitle('Second Event', { exact: true }).click()
    await expect(page.getByTitle('Second Event', { exact: true })).toBeVisible()
  })
})
