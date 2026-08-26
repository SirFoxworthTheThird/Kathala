import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * A roster card is a way to that entity's page, so it should be a link.
 *
 * The character, item and lore rosters used `<div onClick>`: no keyboard, no
 * focus, nothing announced, and no middle-click to a new tab. Measured across
 * the app there were 88 such cards on those three screens — and separately, grid
 * cells, chart points and graph nodes, which are different problems with
 * different answers and are not covered here.
 */
test.describe('Roster cards', () => {
  test.describe.configure({ timeout: 180_000 })

  async function seeded(page: Page) {
    await resetDB(page)
    await page.getByRole('button', { name: 'Library', exact: true }).click()
    await page.getByRole('button', { name: /^Download \(/ }).first().click()
    await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
    await page.waitForTimeout(2000)
    const id = new URL(page.url()).hash.split('/')[2]
    await page.goto(`/#/worlds/${id}/settings`)
    await page.getByRole('button', { name: 'Turn off reading mode' }).click().catch(() => {})
    await page.waitForTimeout(1200)
    return id
  }

  /** Elements carrying a click handler that are not controls. */
  const clickableNonControls = (page: Page) => page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const out: string[] = []
    const walk = (el: Element) => {
      const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))
      if (k) {
        const props = (el as unknown as Record<string, { onClick?: unknown }>)[k]
        const tag = el.tagName.toLowerCase()
        const role = el.getAttribute('role')
        const isControl = ['button', 'a', 'input', 'select', 'textarea', 'label'].includes(tag) ||
          ['button', 'link', 'checkbox', 'tab'].includes(role ?? '')
        if (props?.onClick && !isControl) out.push(`${tag} "${(el.textContent || '').trim().slice(0, 28)}"`)
      }
      for (const c of Array.from(el.children)) walk(c)
    }
    walk(main)
    return out
  })

  for (const screen of ['characters', 'items', 'lore']) {
    test(`the ${screen} roster is made of links`, async ({ page }) => {
      const id = await seeded(page)
      await page.goto(`/#/worlds/${id}/${screen}`)
      await settle(page)

      // Presence: the roster rendered and its entries are reachable links.
      const links = page.getByRole('main').getByRole('link')
      expect(await links.count(), `${screen} should offer its entries as links`).toBeGreaterThan(3)

      // Absence: nothing on the screen is a clickable non-control. Paired with
      // the above, so an empty roster cannot satisfy both.
      const bad = await clickableNonControls(page)
      expect(bad, `clickable non-controls on ${screen}:\n${bad.join('\n')}`).toEqual([])

      // And the first card is genuinely operable from the keyboard.
      await links.first().focus()
      await expect(links.first()).toBeFocused()
    })
  }
})
