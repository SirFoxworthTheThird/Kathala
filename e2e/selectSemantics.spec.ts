import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Every select in the app rendered a bare `<button>`: no `aria-haspopup`, no
 * `aria-expanded`, nothing to say that pressing it opens a list or whether it is
 * open. In the New Relationship dialog two adjacent selects were both announced
 * as "Select…, button" — indistinguishable, with no way to tell which half of
 * the relationship you were filling in.
 */

test.describe('a select says what it is', () => {
  test.describe.configure({ timeout: 180_000 })

  test('announces that it opens a list, and whether it is open', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Semantics')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      for (const [cid, name] of [['a', 'Mira Vasse'], ['b', 'Corvin Ashe']]) {
        await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      }
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /New Relationship/ }).first().click()

    const dialog = page.getByRole('dialog')
    // The two selects are told apart now, which they were not.
    const a = dialog.getByRole('button', { name: 'Character A' })
    const b = dialog.getByRole('button', { name: 'Character B' })
    await expect(a).toBeVisible()
    await expect(b).toBeVisible()

    // Closed: it says it has a list, and that the list is shut.
    await expect(a).toHaveAttribute('aria-haspopup', 'listbox')
    await expect(a).toHaveAttribute('aria-expanded', 'false')

    // Open: the state changes, and it points at the list it opened.
    await a.click()
    await expect(a).toHaveAttribute('aria-expanded', 'true')
    const controls = await a.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(page.locator(`#${controls}`)).toHaveAttribute('role', 'listbox')

    // …and the other one is still shut, so "expanded" means this one.
    await expect(b).toHaveAttribute('aria-expanded', 'false')
  })
})
