import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Presses the shortcut until the palette actually opens.
 *
 * The handler binds in an effect on mount, and waiting for the toolbar button
 * to appear does not prove the listener is attached — on a loaded machine there
 * is still a window where the press lands on nothing. The handler calls
 * `setSearchOpen(true)` rather than toggling, so pressing again is harmless.
 */
async function openPaletteWithShortcut(page: import('@playwright/test').Page) {
  const palette = page.getByPlaceholder('Search characters, factions, locations, lore…')
  await expect(page.getByTitle('Search (Ctrl+K)')).toBeVisible()
  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(palette).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 25_000 })
  return palette
}

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
    // Creating an item stays on the roster (HB-7a) — it used to navigate to the
    // detail page, and this setup had to walk back from there.
    await expect(page.getByText('Staff of Power').first()).toBeVisible()
  })

  test('opens search palette via toolbar button', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await expect(page.getByPlaceholder('Search characters, factions, locations, lore…')).toBeVisible()
  })

  test('opens search palette via Ctrl+K keyboard shortcut', async ({ page }) => {
    await expect(await openPaletteWithShortcut(page)).toBeVisible()
  })

  test('closes palette with Escape key', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    const input = page.getByPlaceholder('Search characters, factions, locations, lore…')
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
    await page.getByPlaceholder('Search characters, factions, locations, lore…').fill('Gandalf')
    await expect(page.getByRole('button', { name: 'Gandalf' })).toBeVisible()
  })

  test('finds an item by name', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, factions, locations, lore…').fill('Staff')
    // The result renders as a button with the item name
    await expect(page.getByRole('button', { name: 'Staff of Power' })).toBeVisible()
  })

  test('navigates to character from search result', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, factions, locations, lore…').fill('Gandalf')
    await page.getByRole('button', { name: 'Gandalf' }).click()

    // Palette closes and we navigate to character detail
    await expect(page.getByPlaceholder('Search characters, factions, locations, lore…')).not.toBeVisible()
    await expect(page).toHaveURL(/#\/worlds\/.+\/characters\//)
  })

  /**
   * Escape belongs to the topmost layer.
   *
   * Dialogs listen for Escape on `document`, so before the palette consumed the
   * key one press reached both: you looked a name up from a half-filled form,
   * pressed Escape to get back to it, and the form was gone with your typing.
   */
  test('Escape closes the palette without closing the dialog underneath', async ({ page }) => {
    // beforeEach leaves us on the Items list, so open a dialog from here.
    await page.getByRole('button', { name: 'Add Item' }).first().click()

    const nameField = page.getByPlaceholder('Item name')
    await nameField.fill('Palantir')
    await expect(nameField).toBeVisible()

    const palette = page.getByPlaceholder('Search characters, factions, locations, lore…')
    await page.keyboard.press('Control+k')
    await expect(palette).toBeVisible()
    // Wait for focus to actually land before pressing: if the keypress goes to
    // the dialog instead, this test measures nothing about the palette.
    await expect(palette).toBeFocused()

    // One press takes the palette and nothing else — the half-typed name survives.
    await page.keyboard.press('Escape')
    await expect(palette).not.toBeVisible()
    await expect(nameField).toBeVisible()
    await expect(nameField).toHaveValue('Palantir')

    // Paired with the opposite: with no palette open, Escape does reach the
    // dialog, so this cannot pass by Escape having been swallowed everywhere.
    await page.keyboard.press('Escape')
    await expect(nameField).not.toBeVisible()
  })

  /**
   * A modal belongs to the screen it was opened on.
   *
   * Choosing a result always closed the palette, but arriving somewhere by any
   * other route did not — the palette sat over a screen it had nothing to do
   * with, swallowing every click until Escape. It derailed three runs of the
   * UX review before it was recognised as a fault rather than a fluke.
   */
  test('the palette closes when you navigate away', async ({ page }) => {
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Presence: it opens, and stays open while you are on this screen.
    const palette = await openPaletteWithShortcut(page)
    await expect(palette).toBeFocused()
    await expect(palette).toBeVisible()

    // Absence: changing route takes it with you.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await expect(palette).not.toBeVisible()

    // And the screen underneath is usable rather than click-blocked.
    await expect(page.getByRole('button', { name: 'Add Character' }).first()).toBeVisible()
  })

  test('no results message when search has no matches', async ({ page }) => {
    await page.getByTitle('Search (Ctrl+K)').click()
    await page.getByPlaceholder('Search characters, factions, locations, lore…').fill('xyzzy-no-match-12345')
    // With no results the list should be empty — the empty-state text is gone
    await expect(page.getByText('Start typing to search your world…')).not.toBeVisible()
    // And no result items visible
    await expect(page.getByText('Gandalf')).not.toBeVisible()
  })
})
