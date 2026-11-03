import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
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
    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
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

  /*
    Writer run 10: "*" → "_" over 518 matches in 36 scenes left 352, then 292,
    and two more presses to reach 0 — each scene its own awaited write, the
    count falling while it worked, and a second press running over a list half
    replaced. Now it is one write, and one undo.
  */
  test('replaces every match in the book in one act, which one undo takes back', async ({ page }) => {
    test.setTimeout(180_000)
    await resetDB(page)
    const fixture = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')
    await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(fixture)
    await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
    await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    const underscores = (p: Page) => p.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
      return (await db.sceneTexts.toArray()).reduce((n, s) => n + (s.text.match(/_/g) ?? []).length, 0)
    })

    await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Find & replace' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('Find…').fill('_')
    await dialog.getByPlaceholder('Replace with…').fill('*')
    await expect(dialog.getByText('560 matches in 39 scenes')).toBeVisible()
    // Hold the prose table for a moment, so the write has to wait its turn and
    // the dialog can be seen waiting with it rather than offering a second press.
    await page.evaluate(() => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        transaction: (mode: string, table: unknown, fn: () => Promise<void>) => Promise<void>
        sceneTexts: { count: () => Promise<number> }
      }
      const until = Date.now() + 2_000
      ;(window as { held?: Promise<void> }).held = db.transaction('rw', db.sceneTexts, async () => {
        while (Date.now() < until) await db.sceneTexts.count()
      })
    })
    await dialog.getByRole('button', { name: 'Replace all' }).click()
    await expect(dialog.getByRole('button', { name: 'Replacing…' })).toBeDisabled()
    await expect(dialog.getByText('Replaced 560 occurrences in 39 scenes.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Replace all' })).toBeVisible()
    // Said once it is done, and it is: nothing is left for a second press.
    expect(await underscores(page)).toBe(0)
    await expect(dialog.getByText('0 matches in 0 scenes')).toBeVisible()

    await page.keyboard.press('Escape')
    const undo = page.getByRole('button', { name: 'Undo', exact: true })
    await expect(undo).toHaveAttribute('title', /^Undo: Replaced “_” with “\*”/)
    await undo.click()
    // One undo, every scene.
    await expect.poll(() => underscores(page)).toBe(560)
  })
})
