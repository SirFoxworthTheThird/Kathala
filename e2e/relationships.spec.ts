import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Helper to select a character in the "With Character" Select field.
 * The custom Select trigger is a plain button (not role=combobox);
 * we click it by its placeholder text then pick the option.
 */
async function selectCharacterInDialog(page: import('@playwright/test').Page, name: string) {
  await page.getByText('Select character...').click()
  await page.getByRole('option', { name }).click()
  // Wait for the listbox to close before continuing
  await page.waitForSelector('[role="listbox"]', { state: 'detached' })
}

/**
 * Fills and submits the Add Relationship dialog.
 * Submits via the label input (Enter key) to avoid dialog backdrop interception.
 */
async function fillRelationshipDialog(
  page: import('@playwright/test').Page,
  characterName: string,
  label: string
) {
  await expect(page.getByRole('heading', { name: 'Add Relationship' })).toBeVisible()
  await selectCharacterInDialog(page, characterName)
  const labelInput = page.getByPlaceholder('e.g. mentor, rival, sibling')
  await labelInput.fill(label)
  // Submit via Enter (avoids the dialog backdrop click-interception issue)
  await labelInput.press('Enter')
  await expect(page.getByRole('heading', { name: 'Add Relationship' })).not.toBeVisible()
}

/**
 * Helper: creates a world, two characters, and lands on the characters roster.
 */
async function setupTwoCharacters(page: import('@playwright/test').Page) {
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Rel World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByTitle('Characters').click()
  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Alice')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Alice')).toBeVisible()

  await page.getByRole('button', { name: 'Add Character' }).first().click()
  await page.getByPlaceholder('Character name').fill('Bob')
  await page.getByRole('button', { name: 'Add Character' }).last().click()
  await expect(page.getByText('Bob')).toBeVisible()
}

test.describe('Relationship graph', () => {
  test('shows empty graph when no relationships exist (but characters do)', async ({ page }) => {
    await setupTwoCharacters(page)
    await page.getByTitle('Relationships').click()
    await expect(page.getByText('No characters yet')).not.toBeVisible()
  })

  test('redirects to characters when no characters exist', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Empty World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByTitle('Relationships').click()
    await expect(page.getByText('No characters yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go to Characters' })).toBeVisible()
  })

  test('creates a relationship via character detail tab', async ({ page }) => {
    await setupTwoCharacters(page)

    await page.getByText('Alice').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/characters\//)

    await page.getByRole('tab', { name: /relationships/i }).click()
    await page.getByRole('button', { name: 'Add Relationship' }).click()
    await fillRelationshipDialog(page, 'Bob', 'Friends')

    await expect(page.getByText('Friends')).toBeVisible()
  })

  test('relationship graph shows edge after relationship created', async ({ page }) => {
    await setupTwoCharacters(page)

    await page.getByText('Alice').click()
    await page.getByRole('tab', { name: /relationships/i }).click()
    await page.getByRole('button', { name: 'Add Relationship' }).click()
    await fillRelationshipDialog(page, 'Bob', 'Rivals')

    // Navigate to graph — edge label renders as a button
    await page.getByTitle('Relationships').click()
    await expect(page.getByRole('button', { name: 'Rivals' })).toBeVisible()
  })

  test('clicking edge label opens relationship sidebar', async ({ page }) => {
    await setupTwoCharacters(page)

    await page.getByText('Alice').click()
    await page.getByRole('tab', { name: /relationships/i }).click()
    await page.getByRole('button', { name: 'Add Relationship' }).click()
    await fillRelationshipDialog(page, 'Bob', 'Allies')

    await page.getByTitle('Relationships').click()
    // ReactFlow edge interaction path (stroke-opacity:0) sits on top of the
    // EdgeLabelRenderer button in Playwright's hit-test.
    // Use dispatchEvent to fire the React click handler directly.
    await page.getByRole('button', { name: 'Allies' }).dispatchEvent('click')

    // Sidebar shows "Relationship" heading and both character names
    await expect(page.getByText('Relationship').first()).toBeVisible()
    // Characters appear both as graph nodes and in the sidebar; first() is fine
    await expect(page.getByText('Alice').first()).toBeVisible()
    await expect(page.getByText('Bob').first()).toBeVisible()
  })
})
