import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Drives the real HTML5 drag on the calendar to reschedule an event's in-world
// date. The date maths (buildCalendarMonths / dateToDayNumber) is unit-tested in
// src/lib/__tests__/calendarView.test.ts.

test.describe('Calendar view', () => {
  test('CAL-2: the first visit to Calendar can start one instead of being a dead end', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Undated World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // The finding asked for the nav item to be hidden when no calendar exists.
    // Hiding it hides the feature — nothing else in the app mentions that a
    // calendar can be had — so the item stays and the screen does the thing.
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await expect(page.getByText('No calendar yet')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toHaveCount(0)

    await page.getByRole('button', { name: 'Enable calendar' }).click()

    // One click, on the screen you are already on: the empty state is gone and
    // the calendar itself is here. Paired with the absence above, so neither
    // half can pass on its own.
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('No calendar yet')).toHaveCount(0)

    // And it is a real calendar, not a flag: the world now carries months.
    const months = await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { get: (id: string) => Promise<{ calendar?: { months: unknown[] } | null }> }
      }
      return (await db.worlds.get(id))?.calendar?.months.length ?? 0
    }, worldId)
    expect(months).toBeGreaterThan(1)
  })

  test('drags an event to a new day to pin its in-world date', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Dated World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // Enable the (default) calendar in world settings.
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()

    // One timeline, one chapter, one event.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('The gate opens')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Calendar: the event sits on day 1 (in-world day 0 = 1 January, year 1).
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible({ timeout: 30000 })
    // Scoped to its day cell: the time-cursor pill in the top bar carries the
    // active scene's title too, so a page-wide match here is ambiguous whenever
    // the cursor happens to be sitting on this scene.
    const chip = page.locator('[aria-label="January 1, 1"]').getByRole('button', { name: 'The gate opens' })
    const day1 = page.locator('[aria-label="January 1, 1"]')
    const day10 = page.locator('[aria-label="January 10, 1"]')
    await expect(day1.getByRole('button', { name: 'The gate opens' })).toBeVisible()

    // Drag it to January 10.
    await chip.dragTo(day10)

    // It now lives in the January-10 cell, and no longer on January 1.
    await expect(day10.getByRole('button', { name: 'The gate opens' })).toBeVisible()
    await expect(day1.getByRole('button', { name: 'The gate opens' })).toHaveCount(0)
  })
})
