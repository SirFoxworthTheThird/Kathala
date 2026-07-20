import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// The scene-history dialog drives the real DB revision capture + restore flow.
// (The capture/coalesce/prune/restore logic is unit-tested separately in
// src/db/hooks/__tests__/sceneRevisions.test.ts.)

test.describe('Scene revision history', () => {
  test('captures a prior draft and restores it', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Draft World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    // Timeline → one chapter → one event.
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene A')
    await page.getByRole('button', { name: 'Add Event' }).last().click()

    // Expand the event card and write the first draft.
    const main = page.getByRole('main')
    await main.getByText('Scene A', { exact: true }).click()
    const editor = main.getByPlaceholder(/Write or paste this scene/)
    await editor.fill('The quick brown fox.')
    await editor.blur()

    // Revise it — this captures the first draft as a version.
    await editor.fill('The quick red fox.')
    await editor.blur()

    // Open history and restore the earlier draft.
    await main.getByRole('button', { name: /History \(/ }).click()
    await expect(page.getByRole('heading', { name: 'Scene history' })).toBeVisible({ timeout: 30000 })
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await page.getByRole('button', { name: 'Restore' }).last().click() // confirm

    // The editor is back to the first draft.
    await expect(editor).toHaveValue('The quick brown fox.')
  })
})
