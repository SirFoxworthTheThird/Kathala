import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * SET-1: World Settings offered to override a setting the app gave no way to
 * set. The Theme section read *"Override the global app theme for this world"*
 * and its first card was **Inherit global theme** — but `ThemePicker`, the only
 * control for that value, was exported and never rendered anywhere. So the
 * default option inherited from a number nobody could change.
 *
 * The app theme is real and load-bearing: it is what the world list uses and
 * what every inheriting world resolves to. It has a control now, beside the
 * sentence that describes it.
 */

async function openSettings(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Themed')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await page.getByRole('link', { name: /settings/i }).first().click()
  await expect(page.getByLabel('App theme')).toBeVisible({ timeout: 30_000 })
}

const rootClass = (page: Page) =>
  page.evaluate(() => document.documentElement.className)

test.describe('The app theme has a control', () => {
  test.describe.configure({ timeout: 120_000 })

  test('setting it changes what an inheriting world looks like — and only then', async ({ page }) => {
    await openSettings(page)

    // A new world inherits, so the app theme is what is applied.
    await expect(page.getByRole('button', { name: /Inherit app theme/ })).toBeVisible()
    expect(await rootClass(page), 'the default app theme adds no class').not.toContain('theme-')

    // Presence: choosing an app theme applies it, through the inherit path.
    await page.getByLabel('App theme').selectOption('horror')
    await expect.poll(() => rootClass(page),
      { message: 'the chosen app theme should reach the document' }).toContain('theme-horror')

    // Absence: a world with a theme of its own is not touched by the app theme.
    // Without this half the assertion above could pass on a global that
    // overrides everything, which is not what "inherit" means.
    await page.getByRole('button', { name: /Cyberpunk/ }).click()
    await expect.poll(() => rootClass(page)).toContain('theme-cyberpunk')
    await page.getByLabel('App theme').selectOption('western')
    await page.waitForTimeout(600)
    expect(await rootClass(page),
      "a world's own theme should outrank the app theme").toContain('theme-cyberpunk')
    expect(await rootClass(page)).not.toContain('theme-western')

    // And handing the world back to inherit picks the app theme up again, so
    // the "only then" above is a rule rather than a dead branch.
    await page.getByRole('button', { name: /Inherit app theme/ }).click()
    await expect.poll(() => rootClass(page)).toContain('theme-western')
  })

  test('the choice outlives a reload, which is what makes it a setting', async ({ page }) => {
    await openSettings(page)
    await page.getByLabel('App theme').selectOption('noir')
    await expect.poll(() => rootClass(page)).toContain('theme-noir')

    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(1500)
    expect(await rootClass(page)).toContain('theme-noir')
    await expect(page.getByLabel('App theme')).toHaveValue('noir')
  })
})
