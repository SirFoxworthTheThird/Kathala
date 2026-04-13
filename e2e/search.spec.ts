import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Search palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world with a character and item to search
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Search World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Add a character
    await page.getByTitle('Characters').click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Gandalf')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Gandalf')).toBeVisible()

    // Add an item
    await page.getByTitle('Items').click()
    await page.getByRole('button', { name: 'Add Item' }).first().click()
    await page.getByPlaceholder('Item name').fill('Staff of Power')
    await page.getByRole('button', { name: 'Add Item' }).last().click()
    // Item creation navigates to detail — wait for it then navigate back
    await expect(page).toHaveURL(/#\/worlds\/.+\/items\//)
    await page.getByTitle('Items').click()
    await expect(page.getByText('Staff of Power').first()).toBeVisible()
  })

  test('opens search palette via toolbar button', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await expect(page.getByPlaceholder('Search characters, locations, chapters…')).toBeVisible()
  })

  test('opens search palette via Ctrl+K keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByPlaceholder('Search characters, locations, chapters…')).toBeVisible()
  })

  test('closes palette with Escape key', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    const input = page.getByPlaceholder('Search characters, locations, chapters…')
    await expect(input).toBeVisible()
    // Press Escape directly on the focused input
    await input.press('Escape')
    await expect(input).not.toBeVisible()
  })

  test('shows empty results message before typing', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await expect(page.getByText('Start typing to search your world…')).toBeVisible()
  })

  test('finds a character by name', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, locations, chapters…').fill('Gandalf')
    await expect(page.getByRole('button', { name: 'Gandalf' })).toBeVisible()
  })

  test('finds an item by name', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, locations, chapters…').fill('Staff')
    // The result renders as a button with the item name
    await expect(page.getByRole('button', { name: 'Staff of Power' })).toBeVisible()
  })

  test('navigates to character from search result', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, locations, chapters…').fill('Gandalf')
    await page.getByRole('button', { name: 'Gandalf' }).click()

    // Palette closes and we navigate to character detail
    await expect(page.getByPlaceholder('Search characters, locations, chapters…')).not.toBeVisible()
    await expect(page).toHaveURL(/#\/worlds\/.+\/characters\//)
  })

  test('no results message when search has no matches', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, locations, chapters…').fill('xyzzy-no-match-12345')
    // With no results the list should be empty — the empty-state text is gone
    await expect(page.getByText('Start typing to search your world…')).not.toBeVisible()
    // And no result items visible
    await expect(page.getByText('Gandalf')).not.toBeVisible()
  })
})
