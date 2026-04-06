import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Timeline and chapters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world and navigate to Timeline
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Timeline World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /timeline/i }).click()
  })

  test('shows empty timeline state', async ({ page }) => {
    await expect(page.getByText('No timeline yet').or(page.getByText('No chapters yet'))).toBeVisible()
  })

  test('creates the first timeline', async ({ page }) => {
    // "Create Timeline" creates a timeline immediately (no dialog — hardcoded name "Main Timeline")
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()
  })

  test('creates a chapter within a timeline', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    // AddChapterDialog: Label has no htmlFor — use placeholder
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await expect(page.getByRole('heading', { name: /Add Chapter/ })).toBeVisible()

    await page.getByPlaceholder('Chapter title').fill('The Beginning')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()

    await expect(page.getByRole('heading', { name: /Add Chapter/ })).not.toBeVisible()
    await expect(page.getByText('The Beginning')).toBeVisible()
  })

  test('requires a title to create a chapter', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await expect(page.getByRole('heading', { name: /Add Chapter/ })).toBeVisible()
    const saveBtn = page.getByRole('button', { name: 'Add Chapter' }).last()
    await expect(saveBtn).toBeDisabled()
  })

  test('navigates to chapter detail view', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Chapter One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Chapter One')).toBeVisible()

    // Navigate to chapter detail via the ExternalLink icon button in the chapter row
    await page.getByTitle('Open chapter detail').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/timeline\/.+/)
    await expect(page.getByText('Chapter One')).toBeVisible()
  })
})
