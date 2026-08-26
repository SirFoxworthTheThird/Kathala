import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * SEL-2: the world selector explained the import file formats permanently, in
 * the header, for an action nobody had started — with two extensions a new user
 * has never seen.
 */
test.describe('The first ten minutes', () => {
  test.describe.configure({ timeout: 120_000 })

  test('SEL-2: the import formats are explained when you ask to import', async ({ page }) => {
    await resetDB(page)

    // Absent from the header, where it described an action nobody had started.
    const header = page.locator('header').first()
    await expect(header).not.toContainText('.pwb')
    await expect(header).not.toContainText('Select a')

    // Present at the moment it can be acted on — the ask that opens the picker.
    await page.getByRole('button', { name: 'Import World' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(dialog).toContainText('.pwk')
    await expect(dialog).toContainText('.pwb')
    await expect(dialog.getByRole('button', { name: 'Choose file…' })).toBeVisible()

    // Backing out leaves the shelf as it was.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('main')).toContainText('No worlds yet')
  })
})
