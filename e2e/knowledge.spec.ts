import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Covers the knowledge feature (facts / dramatic irony), which had no e2e:
// creating a fact from the empty state and opening its detail (reader-clock).

test.describe('Knowledge', () => {
  test('creates a fact and opens its detail panel', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Knowledge World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: 'Knowledge' }).click()
    await expect(page.getByText('No facts yet')).toBeVisible()

    // Create a fact.
    await page.getByRole('button', { name: 'New Fact' }).click()
    await page.getByPlaceholder('What is the fact or secret?').fill('The king is dead')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // It appears in the list and is auto-selected, opening the detail panel
    // with the reader-clock control (the heart of the dramatic-irony feature).
    await expect(page.getByText('The king is dead')).toBeVisible()
    await expect(page.getByText('No facts yet')).not.toBeVisible()
    await expect(page.getByText('Reader learns at')).toBeVisible()
  })
})
