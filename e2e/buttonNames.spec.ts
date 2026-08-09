import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Every visible control announces itself.
 *
 * An icon-only button with no text, `aria-label` or `title` is announced as
 * just "button". The chapter row's delete control was one — the only nameless
 * button on that whole screen, which is why a sweep is worth keeping: the app
 * is otherwise well labelled, so a new one stands out instead of drowning.
 */
test.describe('Button names', () => {
  test.describe.configure({ timeout: 180_000 })

  /** Visible controls carrying no accessible name at all. */
  async function nameless(page: Page): Promise<string[]> {
    return page.locator('button, [role="button"]').evaluateAll((els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return false
          return (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() === ''
        })
        .map((e) => {
          const r = e.getBoundingClientRect()
          return `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.x)},${Math.round(r.y)} — ${e.className.toString().slice(0, 60)}`
        }))
  }

  test('the timeline and its chapter rows', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Named')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Vanishing Glass')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('The Vanishing Glass').first()).toBeVisible()

    // The control that prompted this: destructive, and previously anonymous.
    await expect(page.getByRole('button', { name: /delete chapter/i })).toBeVisible()

    const bad = await nameless(page)
    expect(bad, `controls announcing only "button":\n${bad.join('\n')}`).toEqual([])
  })
})
