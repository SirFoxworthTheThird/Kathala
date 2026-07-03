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
    // Chapter names appear in both the chapter list and the timeline bar.
    await expect(page.getByText('The Shire').first()).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Rivendell')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('Rivendell').first()).toBeVisible()

    // The arc renders rows only once at least one snapshot exists. Add an event
    // in Ch. 1 and save a state for Frodo so the grid has data.
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Departure')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByTitle('Departure', { exact: true }).click()

    await page.getByTitle('Characters').click()
    await page.getByText('Frodo').click()
    await page.getByRole('tab', { name: /current state/i }).click()
    // Alive/Deceased only mark the form dirty; "Save State" persists the snapshot.
    await page.getByRole('button', { name: 'Deceased' }).click()
    await page.getByRole('button', { name: 'Save State' }).click()
  })

  test('navigates to character arc view', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)
  })

  test('arc view shows chapter columns', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    // Chapter columns are headed "Ch. N — Title"
    await expect(page.getByText(/Ch\. 1/)).toBeVisible()
    await expect(page.getByText(/Ch\. 2/)).toBeVisible()
  })

  test('arc view shows character rows', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()
  })

  test('filter input narrows visible characters', async ({ page }) => {
    await page.getByRole('link', { name: 'Arc' }).click()
    await expect(page).toHaveURL(/#\/worlds\/.+\/arc/)

    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).toBeVisible()

    await page.getByPlaceholder('Filter characters…').fill('Frodo')
    await expect(page.getByText('Frodo')).toBeVisible()
    await expect(page.getByText('Sam')).not.toBeVisible()
  })
})
