import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('World management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
  })

  test('shows empty state with "Create World" prompt', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'PlotWeave' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create World' })).toBeVisible()
  })

  test('creates a new world and navigates to its dashboard', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    // The custom Dialog has no role="dialog" — check the heading instead
    await expect(page.getByRole('heading', { name: 'Create New World' })).toBeVisible()

    // World dialog has htmlFor/id so getByLabel works here
    await page.getByLabel('Name').fill('Middle Earth')
    await page.getByLabel('Description').fill('A high-fantasy setting.')
    await page.getByRole('button', { name: 'Create World' }).last().click()

    await expect(page).toHaveURL(/#\/worlds\//)
    await expect(page.getByText('Middle Earth')).toBeVisible()
  })

  test('shows the created world on the selector page', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Westeros')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByText('PlotWeave').click()
    await expect(page).toHaveURL('/#/')
    await expect(page.getByText('Westeros')).toBeVisible()
  })

  test('requires a name to create a world', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await expect(page.getByRole('heading', { name: 'Create New World' })).toBeVisible()
    const createBtn = page.getByRole('button', { name: 'Create World' }).last()
    await expect(createBtn).toBeDisabled()
  })

  test('cancels world creation without creating anything', async ({ page }) => {
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Cancelled World')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create New World' })).not.toBeVisible()
    await expect(page.getByText('Cancelled World')).not.toBeVisible()
  })
})
