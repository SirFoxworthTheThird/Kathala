import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Covers the knowledge feature (facts / dramatic irony), which had no e2e:
// creating a fact from the empty state and opening its detail (reader-clock).

test.describe('Knowledge', () => {
  test('creates a fact and opens its detail panel', async ({ page }) => {
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

  /**
   * Serial entry. The composer closed after every fact, so a writer with seven
   * secrets paid seven round trips through **New Fact** — where Characters and
   * Items both offer *Add another*.
   */
  test('keeps the composer open so several facts are one pass', async ({ page }) => {
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Serial Facts')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.getByRole('link', { name: 'Knowledge' }).click()

    const field = page.getByPlaceholder('What is the fact or secret?')
    await page.getByRole('button', { name: 'New Fact' }).click()

    await field.fill('The king is dead')
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Still open, empty and focused — the second fact needs no further clicks.
    await expect(field).toBeVisible()
    await expect(field).toHaveValue('')
    await expect(field).toBeFocused()

    await field.fill('The heir is illegitimate')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('main').getByText('The heir is illegitimate')).toBeVisible()

    /*
      And it still closes when asked — the pair. Without this, a composer that
      could never be dismissed would satisfy everything above.
    */
    await page.keyboard.press('Escape')
    await expect(field).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New Fact' })).toBeVisible()
  })
})
