import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Covers the chapter-diff modal: opening it from the timeline bar (only shown
// once an event is active), and comparing the active chapter against another.

test.describe('Chapter diff', () => {
  test('compares the active chapter against another', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Diff World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Timeline with two chapters.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Alpha')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Alpha').first()).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Beta')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Beta').first()).toBeVisible()

    // An event in Ch. 1 so a chapter can be the active (base) chapter.
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene One')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Activate the event from the bar — this reveals the "Compare chapters" button.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByTitle('Scene One', { exact: true }).click()

    // Open the diff modal.
    await page.getByTitle('Compare chapters').click()
    await expect(page.getByText('Chapter Diff')).toBeVisible()
    // The modal labels the active chapter as the base (distinct from the row behind it).
    await expect(page.getByText('Base: Ch. 1 — Alpha')).toBeVisible()

    // Choose the chapter to compare against.
    const compareSelect = page.locator('select', { has: page.locator('option', { hasText: 'Compare with' }) })
    await compareSelect.selectOption({ label: 'Ch. 2 — Beta' })

    // The diff runs against the chosen chapter; with two empty chapters it
    // reports no differences (proving the comparison executed).
    await expect(page.getByText('No recorded differences between these chapters.')).toBeVisible()
  })
})
