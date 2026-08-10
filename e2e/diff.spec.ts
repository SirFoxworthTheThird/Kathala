import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

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
    await settleNav(page)
    await page.getByTitle('Scene One', { exact: true }).click()

    // Open the diff modal.
    await page.getByTitle('Compare chapters').click()
    await expect(page.getByText('Chapter Diff')).toBeVisible()
    // The base seeds from the cursor's chapter — it is a control now rather than
    // a readout, so it is asserted as a value (DF-2).
    const panel = page.getByRole('dialog', { name: 'Chapter Diff' })
    await expect(panel.getByLabel('Base chapter')).toBeVisible()
    expect(await panel.getByLabel('Base chapter')
      .evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent))
      .toContain('Ch. 1 — Alpha')

    // Choose the chapter to compare against.
    await panel.getByLabel('Chapter to compare against').selectOption({ label: 'Ch. 2 — Beta' })

    // The diff runs against the chosen chapter. Two chapters with nothing
    // recorded say exactly that now, rather than claiming they match (DF-3).
    await expect(panel.getByText(/Neither chapter has any state recorded/)).toBeVisible()
  })
})
