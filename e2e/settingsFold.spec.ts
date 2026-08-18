import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * HB-9's last standing part: eleven settings sections in one scroll, none of
 * them collapsible. The jump index (**SET-2**) helps you reach one; it does
 * nothing once you are there.
 *
 * Sections stay **expanded by default** on purpose, and that is worth stating
 * because the opposite is the tempting choice. Several reading-mode tests check
 * that a section is *gone*; a section merely shut would satisfy them, and those
 * assertions would quietly stop meaning anything. *Collapse all* is the one
 * press to the menu view instead.
 */

const theme = (page: Page) => page.getByRole('button', { name: 'Theme', exact: true })

/**
 * The Theme section's own control, standing for "its body is on screen".
 *
 * This was `getByRole('button', { name: 'Dark' })`, which matched nothing it
 * was named for: `getByRole` matches an accessible name by **substring**, and
 * the only card containing "dark" was *Noir — silver gelatin and darkroom red*.
 * It passed for two years' worth of runs by accident, and broke the moment a
 * theme described as *the wine-dark sea* gave it a second match.
 *
 * The labelled select is unique and is actually part of this section, so it
 * says what the test means.
 */
const themeBody = (page: Page) => page.getByLabel('App theme')

async function settings(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Folded')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  await expect(theme(page)).toBeVisible()
  return worldId
}

test.describe('World settings sections fold', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a heading folds its own section, and the state outlives a reload', async ({ page }) => {
    await settings(page)

    // Open to begin with — the default, and the presence half of everything
    // below.
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(themeBody(page)).toBeVisible()

    await theme(page).click()
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(themeBody(page)).toHaveCount(0)

    /*
      `page.reload()`, not `page.goto` to the same URL. On a hash router that
      goto is a hash change in the same document, so React state survives it and
      the assertion below passed with persistence deliberately removed — a
      vacuous test, caught by mutating the code it was supposed to guard.
    */
    await page.reload({ waitUntil: 'load' })
    await expect(theme(page)).toBeVisible()
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(themeBody(page)).toHaveCount(0)

    // And it opens again.
    await theme(page).click()
    await expect(themeBody(page)).toBeVisible()
  })

  test('Collapse all turns the page into a menu, and Expand all puts it back', async ({ page }) => {
    await settings(page)
    const collapseAll = page.getByRole('button', { name: 'Collapse all' })
    await expect(collapseAll).toBeVisible()

    await collapseAll.click()

    // Every section header is still there — that is what makes it a menu
    // rather than a shorter page — and every body is gone.
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('button', { name: 'Continuity', exact: true }))
      .toHaveAttribute('aria-expanded', 'false')
    await expect(themeBody(page)).toHaveCount(0)
    await expect(page.getByLabel('Stale snapshot threshold')).toHaveCount(0)

    // The index chips are unchanged: they are read from the sections, so
    // folding one away by removing it would shorten the index as you tidied.
    await expect(page.getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: 'Theme' })).toBeVisible()

    // And back.
    await page.getByRole('button', { name: 'Expand all' }).click()
    await expect(themeBody(page)).toBeVisible()
    await expect(page.getByLabel('Stale snapshot threshold')).toBeVisible()
  })

  test('an index chip opens the section it jumps to', async ({ page }) => {
    await settings(page)
    await page.getByRole('button', { name: 'Collapse all' }).click()
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'false')

    await page.getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: 'Theme' }).click()

    // Scrolling to a shut heading would look broken, so the chip opens it.
    await expect(theme(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(themeBody(page)).toBeVisible()
  })
})
