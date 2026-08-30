import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

const MANUSCRIPT = [
  '# My Imported Novel',
  '',
  '## Chapter 1: Beginnings',
  '',
  'It was a dark and stormy night.',
  '',
  '* * *',
  '',
  'Then the sun rose.',
  '',
  '## Chapter 2: The Journey',
  '',
  'They set out at dawn.',
].join('\n')

test.describe('Import Manuscript', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('imports a pasted manuscript into a new world with chapters and prose', async ({ page }) => {
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await expect(page.getByRole('heading', { name: 'Import a Manuscript' })).toBeVisible()

    // Paste the draft — the live preview should parse it.
    await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
    await expect(page.getByText(/3 scenes ·/)).toBeVisible()

    // The book title is detected and prefilled as the world name.
    await expect(page.getByLabel('World name')).toHaveValue('My Imported Novel')

    // Preview lists the parsed chapters (exact text scopes to the list spans,
    // not the textarea whose value also contains these words).
    await expect(page.getByText('Beginnings', { exact: true })).toBeVisible()
    await expect(page.getByText('The Journey', { exact: true })).toBeVisible()

    // Import → lands in the new world.
    await page.getByRole('button', { name: /^Import/ }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // The manuscript view shows the imported prose stitched back together.
    await page.getByRole('link', { name: /manuscript/i }).click()
    await expect(page.getByText('It was a dark and stormy night.')).toBeVisible()
    await expect(page.getByText('Then the sun rose.')).toBeVisible()
    await expect(page.getByText('They set out at dawn.')).toBeVisible()
  })

  test('disables import until a parseable draft is entered', async ({ page }) => {
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await expect(page.getByRole('heading', { name: 'Import a Manuscript' })).toBeVisible()

    // Nothing pasted yet → the import button is disabled.
    const importBtn = page.getByRole('button', { name: /^Import/ }).last()
    await expect(importBtn).toBeDisabled()

    await page.getByLabel('Manuscript text').fill('## Chapter 1\n\nSome prose.')
    await expect(importBtn).toBeEnabled()
  })
})
