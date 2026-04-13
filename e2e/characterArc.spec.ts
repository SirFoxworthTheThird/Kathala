import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Character Arc view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    // Create a world
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Arc World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Create two characters
    await page.getByTitle('Characters').click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Frodo')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Frodo')).toBeVisible()

    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Sam')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Sam')).toBeVisible()

    // Create a timeline with two chapters
    await page.getByTitle('Timeline').click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Shire')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('The Shire')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Rivendell')).toBeVisible()
  })

  test('navigates to character arc view', async ({ page }) => {
    await page.getByTitle('Character Arc').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)
  })

  test('arc view shows chapter columns', async ({ page }) => {
    await page.getByTitle('Character Arc').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    // Chapter columns are headed "Ch. N — Title"
    await expect(page.getByText(/Ch\. 1/)).toBeVisible()
    await expect(page.getByText(/Ch\. 2/)).toBeVisible()
  })

  test('arc view shows character rows', async ({ page }) => {
    await page.getByTitle('Character Arc').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()
  })

  test('filter input narrows visible characters', async ({ page }) => {
    await page.getByTitle('Character Arc').click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()

    await page.getByPlaceholder('Filter characters…').fill('Frodo')
    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).not.toBeVisible()
  })
})
