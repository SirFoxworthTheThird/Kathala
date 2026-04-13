import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

test.describe('Continuity Checker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Continuity World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
  })

  test('opens continuity checker via toolbar button', async ({ page }) => {
    await page.getByTitle('Continuity Checker').click()
    await expect(page.getByText('Continuity Checker')).toBeVisible()
  })

  test('closes continuity checker by clicking inside then navigating away', async ({ page }) => {
    await page.getByTitle('Continuity Checker').click()
    await expect(page.getByText('Continuity Checker')).toBeVisible()
    // Close by clicking on the fixed backdrop overlay (outside the checker panel)
    await page.locator('.fixed.inset-0').first().click({ position: { x: 5, y: 5 } })
    await expect(page.getByText('Continuity Checker')).not.toBeVisible()
  })

  test('closes by clicking backdrop', async ({ page }) => {
    await page.getByTitle('Continuity Checker').click()
    await expect(page.getByText('Continuity Checker')).toBeVisible()
    // Click outside the checker panel (top-left corner of the backdrop overlay)
    await page.mouse.click(5, 5)
    await expect(page.getByText('Continuity Checker')).not.toBeVisible()
  })

  test('shows no issues when world is empty', async ({ page }) => {
    await page.getByTitle('Continuity Checker').click()
    await expect(page.getByText('Continuity Checker')).toBeVisible()
    await expect(page.getByText(/\d+ error/)).not.toBeVisible()
    await expect(page.getByText(/\d+ warning/)).not.toBeVisible()
  })

  test('marks character as deceased via current state tab', async ({ page }) => {
    // Create a character
    await page.getByTitle('Characters').click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Boromir')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Boromir')).toBeVisible()

    // Create a timeline with a chapter and an event
    await page.getByTitle('Timeline').click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await expect(page.getByText('Main Timeline')).toBeVisible()

    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('Chapter 1')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()

    await page.getByTitle('Open chapter detail').click()
    await page.getByRole('button', { name: 'Add Event' }).click()
    await page.getByPlaceholder('Event title').fill('Death Scene')
    await page.getByRole('button', { name: 'Add Event' }).last().click()
    await expect(page.getByText('Death Scene')).toBeVisible()

    // Set event as active via timeline bar
    await page.getByTitle('Timeline').click()
    await page.getByTitle('Death Scene').click()

    // Go to character, mark as deceased in current state tab
    await page.getByTitle('Characters').click()
    await page.getByText('Boromir').click()
    await page.getByRole('tab', { name: /current state/i }).click()
    // Current state uses Alive / Deceased buttons (not a switch)
    await page.getByRole('button', { name: 'Deceased' }).click()

    // Open checker — should open without errors in the UI flow
    await page.getByTitle('Continuity Checker').click()
    await expect(page.getByText('Continuity Checker')).toBeVisible()
  })
})
