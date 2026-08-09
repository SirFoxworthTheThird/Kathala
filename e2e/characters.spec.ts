import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Character management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world to work in
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Test World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Navigate to Characters
    await page.getByRole('link', { name: /characters/i }).click()
  })

  test('shows empty state on characters page', async ({ page }) => {
    // Two "Add Character" buttons exist (header + empty state); just assert at least one is visible
    await expect(page.getByRole('button', { name: 'Add Character' }).first()).toBeVisible()
  })

  test('creates a new character', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    // Custom Dialog has no role="dialog" — check the heading
    await expect(page.getByRole('heading', { name: 'Add Character' })).toBeVisible()

    // Label has no htmlFor — use placeholder to locate the inputs
    await page.getByPlaceholder('Character name').fill('Aragorn')
    await page.getByPlaceholder('Brief description...').fill('Heir of Isildur')
    await page.getByRole('button', { name: 'Add Character' }).last().click()

    await expect(page.getByRole('heading', { name: 'Add Character' })).not.toBeVisible()
    await expect(page.getByText('Aragorn')).toBeVisible()
  })

  test('requires a name to create a character', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add Character' })).toBeVisible()
    // Save button inside the dialog is last; it should be disabled with empty name
    const saveBtn = page.getByRole('button', { name: 'Add Character' }).last()
    await expect(saveBtn).toBeDisabled()
  })

  test('cancels character creation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Cancelled')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Add Character' })).not.toBeVisible()
    await expect(page.getByText('Cancelled')).not.toBeVisible()
  })

  test('navigates to character detail view', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Legolas')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Legolas').first()).toBeVisible()

    await page.getByText('Legolas').first().click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/characters\//)
    // The name appears in three places on this screen — the page heading, the
    // Overview tab heading, and the roster behind it — so an unqualified
    // getByText raced them and failed on strict mode. The page heading is the
    // one that means "the detail view for Legolas is open".
    await expect(page.getByRole('heading', { name: 'Legolas', level: 2 })).toBeVisible()
  })
})
