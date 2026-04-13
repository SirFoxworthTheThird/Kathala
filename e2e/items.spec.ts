import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Item management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world and navigate to Items
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Item World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByTitle('Items').click()
  })

  test('shows empty state on items page', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add Item' }).first()).toBeVisible()
  })

  test('creates a new item', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Item' })).toBeVisible()

    await page.getByPlaceholder('Item name').fill('Excalibur')
    await page.getByPlaceholder('Brief description...').fill('A legendary sword')
    await page.getByRole('button', { name: 'Add Item' }).last().click()

    await expect(page.getByRole('heading', { name: 'Add Item' })).not.toBeVisible()
    // Two elements render the name (list card + detail); first is the card
    await expect(page.getByText('Excalibur').first()).toBeVisible()
  })

  test('requires a name to create an item', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Item' })).toBeVisible()
    const saveBtn = page.getByRole('button', { name: 'Add Item' }).last()
    await expect(saveBtn).toBeDisabled()
  })

  test('cancels item creation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Ghost Item')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Add Item' })).not.toBeVisible()
    await expect(page.getByText('Ghost Item')).not.toBeVisible()
  })

  test('navigates to item detail view', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('The Ring')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    // CreateItemDialog navigates to item detail automatically after creation
    await expect(page).toHaveURL(/#\/worlds\/.+\/items\//)
    await expect(page.getByText('The Ring').first()).toBeVisible()
  })

  test('filters items by search input', async ({ page }) => {
    // Create first item — navigates to detail automatically
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Mjolnir')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/items\//)

    // Go back to items list for second item
    await page.getByTitle('Items').click()
    await expect(page.getByText('Mjolnir').first()).toBeVisible()

    // Create second item
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Shield of Aegis')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/items\//)

    // Go back to items list and filter
    await page.getByTitle('Items').click()
    await expect(page.getByText('Shield of Aegis').first()).toBeVisible()

    // Filter by search
    await page.getByPlaceholder('Search items...').fill('Mjolnir')
    await expect(page.getByText('Mjolnir').first()).toBeVisible()
    await expect(page.getByText('Shield of Aegis')).not.toBeVisible()
  })
})
