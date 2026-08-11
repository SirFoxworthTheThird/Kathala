import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Drives the structure board's assign flow. The beat→event mapping and gap/order
// detection is unit-tested in src/lib/__tests__/structureBoard.test.ts.

test.describe('Structure board', () => {
  test('assigns a scene to a beat and switches templates', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Structured World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // Timeline → chapter → an event.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('The gate opens')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Structure board.
    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Structure' })).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('0 / 7 beats placed')).toBeVisible()

    // Assign the event to the Hook beat.
    // ST-3: both of this screen's pickers are the app's own Select now, so
    // they are opened and chosen from rather than `selectOption`ed.
    await page.getByRole('button', { name: 'Assign a scene to Hook' }).click()
    await page.getByRole('option', { name: 'Ch. 1 · The gate opens' }).click()
    await expect(page.getByText('1 / 7 beats placed')).toBeVisible()
    // Scoped to the board: the chapter bar is on this screen now (W-1) and its
    // ticks carry the same scene titles.
    await expect(page.getByRole('main').getByRole('button', { name: /The gate opens/ })).toBeVisible()

    // Switch template — Save the Cat has 15 beats, none placed (the event is
    // tagged with a three-act beat).
    await page.getByRole('button', { name: 'Structure template' }).click()
    await page.getByRole('option', { name: 'Save the Cat' }).click()
    await expect(page.getByText('0 / 15 beats placed')).toBeVisible()
  })
})
