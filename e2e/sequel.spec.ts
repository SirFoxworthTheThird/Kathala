import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Start a sequel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a source world with a character.
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Book One')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aria')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aria')).toBeVisible()

    // Back to the world list.
    await page.getByText('PlotWeave').first().click()
    await expect(page).toHaveURL('/#/')
  })

  test('forks a world into a sequel carrying the selected character', async ({ page }) => {
    const card = page.getByText('Book One').first()
    await card.hover()

    // Open the card's actions menu and start a sequel.
    await page.getByTitle('More export options').click()
    await page.getByRole('button', { name: /Start a sequel/ }).click()

    await expect(page.getByRole('heading', { name: 'Start a sequel' })).toBeVisible()
    // Name is prefilled and the character is offered as a carry-over.
    await expect(page.getByLabel('New book name')).toHaveValue('Book One — Book 2')
    await expect(page.getByText('Aria')).toBeVisible()

    await page.getByRole('button', { name: /Create sequel/ }).click()

    // Lands in the new world, which carries Aria.
    await expect(page).toHaveURL(/#\/worlds\//)
    await expect(page.getByText('Book One — Book 2').first()).toBeVisible()
    await page.getByRole('link', { name: /characters/i }).click()
    await expect(page.getByText('Aria')).toBeVisible()
  })
})
