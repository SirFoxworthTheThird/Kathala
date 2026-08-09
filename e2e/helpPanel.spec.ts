import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Help should describe the app the reader is actually looking at.
 *
 * Reading mode removes the Manuscript, Corkboard and Structure screens from the
 * nav and the writing tools from the top bar, but the Help panel still listed
 * "Corkboard & manuscript", "Map AI tools" and the rest — instructions for
 * things with no way in, which reads as a broken feature rather than an absent
 * one.
 */
test.describe('Help panel', () => {
  test.describe.configure({ timeout: 180_000 })

  const WRITER_ONLY = ['Corkboard & manuscript', 'Map AI tools', 'Continuity checker', "Writer's Brief"]
  const ALWAYS = ['Getting started', 'Core concept: the time cursor', 'Maps']

  async function downloadBook(page: Page) {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'Library', exact: true }).click()
    await page.getByRole('button', { name: /^Download \(/ }).first().click()
    await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
    await page.waitForTimeout(2000)
    return new URL(page.url()).hash.split('/')[2]
  }

  test('hides writer-only topics for a reader, and keeps them for a writer', async ({ page }) => {
    const id = await downloadBook(page)

    // A library world arrives in reading mode.
    await page.getByRole('button', { name: 'Help' }).click()
    for (const t of WRITER_ONLY) {
      await expect(page.getByRole('button', { name: t }), `"${t}" should be hidden from a reader`).toHaveCount(0)
    }
    // Paired with topics that must survive, so "hidden" cannot mean "the panel
    // failed to render".
    for (const t of ALWAYS) {
      await expect(page.getByRole('button', { name: t }).first(), `"${t}" should still be offered`).toBeVisible()
    }
    await page.keyboard.press('Escape')

    // Turn reading mode off; the same topics come back.
    await page.goto(`/#/worlds/${id}/settings`)
    await page.getByRole('button', { name: 'Turn off reading mode' }).click()
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: 'Help' }).click()
    for (const t of [...WRITER_ONLY, ...ALWAYS]) {
      await expect(page.getByRole('button', { name: t }).first(), `"${t}" should be offered to a writer`).toBeVisible()
    }
  })
})
