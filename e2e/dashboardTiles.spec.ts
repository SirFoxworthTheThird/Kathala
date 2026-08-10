import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * DASH-2 and DASH-3 — two tiles that named one thing and showed another.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [
    { title: 'Landfall', events: [{ id: 'e1', title: 'The wreck', characters: ['Kestrel'] }] },
    { title: 'Ashfall', events: [{ id: 'e2', title: 'The long road', characters: ['Kestrel'] }] },
  ],
})

async function dashboard(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  return worldId
}

test.describe('The world dashboard', () => {
  test.describe.configure({ timeout: 120_000 })

  test('DASH-2: the tile is named for the number it shows', async ({ page }) => {
    await dashboard(page)
    const main = page.getByRole('main')

    // The percentage is snapshot coverage, so that is what the tile is called.
    await expect(main.getByText('Snapshot coverage')).toBeVisible({ timeout: 30_000 })
    // And where it goes is said rather than implied by a title that named it.
    await expect(main.getByText('opens the Character Arc grid')).toBeVisible()

    // It still goes there — the rename did not detach the tile from its screen.
    await main.getByText('Snapshot coverage').click()
    await expect(page).toHaveURL(/\/arc$/, { timeout: 15_000 })
  })

  test('DASH-3: the list says what recent means, and each row says how long ago', async ({ page }) => {
    await dashboard(page)
    const main = page.getByRole('main')

    // "Recent Events" defined nothing; the heading names the ordering.
    await expect(main.getByText('Recently edited')).toBeVisible({ timeout: 30_000 })
    await expect(main.getByText('Recent Events')).toHaveCount(0)

    // Every row carries its own age, so the order reads from the rows rather
    // than from which column they land in.
    const ages = await main.evaluate((el) => {
      const heading = Array.from(el.querySelectorAll('*'))
        .find((n) => n.textContent?.trim() === 'Recently edited')!
      const section = heading.closest('div')!.parentElement!
      return Array.from(section.querySelectorAll('button'))
        .map((b) => (b.textContent ?? '').trim())
        .filter((t) => /(just now|\d+[mhd] ago|\d{1,4}[/.-]\d{1,2})/.test(t)).length
    })
    expect(ages, 'every recent row should carry its age').toBeGreaterThanOrEqual(2)
  })
})
