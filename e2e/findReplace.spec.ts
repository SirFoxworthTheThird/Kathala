import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

// Drives the manuscript-wide find & replace, including the character-rename
// offer. The match/replace maths is unit-tested in
// src/lib/__tests__/findReplace.test.ts.

const MANUSCRIPT = [
  '# The Long Road',
  '',
  '## Chapter 1: Departure',
  '',
  'Mira left before dawn. The road belonged to Mira now, and Mira did not look back.',
].join('\n')

test.describe('Manuscript find & replace', () => {
  test('replaces across scenes and renames the matching character', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    // Import a manuscript whose prose repeats a name.
    await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
    await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
    await page.getByRole('button', { name: /^Import/ }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // A character named after that word.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Mira')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Mira').first()).toBeVisible()

    // Manuscript → Find & replace.
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Find & replace' }).click()
    await expect(page.getByRole('heading', { name: /Find & replace/ })).toBeVisible({ timeout: 30000 })

    await page.getByPlaceholder('Find…').fill('Mira')
    await page.getByPlaceholder('Replace with…').fill('Nyra')
    // 3 occurrences in 1 scene.
    await expect(page.getByText(/3 matches in 1 scene/)).toBeVisible()
    // The character-rename offer appears.
    await expect(page.getByText(/Also rename "Mira"/)).toBeVisible()

    await page.getByRole('button', { name: 'Replace all' }).click()
    await expect(page.getByText(/Replaced 3 occurrences in 1 scene and renamed 1 character/)).toBeVisible()

    // Close the dialog — the manuscript prose now reads "Nyra".
    await page.keyboard.press('Escape')
    await expect(page.getByText(/Nyra left before dawn/)).toBeVisible()
    await expect(page.getByText('Mira left before dawn.')).toHaveCount(0)

    // The character was renamed too.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await expect(page.getByText('Nyra').first()).toBeVisible()
    await expect(page.getByText('Mira', { exact: true })).toHaveCount(0)
  })
})
