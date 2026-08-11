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

  test('RD-4: a tile with no number shows where it goes, not an unknown value', async ({ page }) => {
    const worldId = await dashboard(page)

    // Reading mode is where RD-4 was seen: the Character Arc tile drops its
    // percentage there, because a scorecard of the draft is not the reader's.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<unknown> }
      }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })

    const main = page.getByRole('main')
    await expect(main.getByText('Character Arc')).toBeVisible({ timeout: 30_000 })

    /** The number slot of a tile: what it says, and how many glyphs sit in it. */
    const slot = (name: string) => main.evaluate((el, name) => {
      const tile = Array.from(el.querySelectorAll('button'))
        .find((b) => (b.textContent ?? '').includes(name))
      if (!tile) return null
      const row = tile.firstElementChild as HTMLElement
      return { text: (row.textContent ?? '').trim(), glyphs: row.querySelectorAll('svg').length }
    }, name)

    // Absence: no number, and nothing standing in for one. An em-dash in that
    // slot read as "unknown", which is a different claim from "this tile is an
    // action" — the chevron is the icon plus one.
    const arc = await slot('Character Arc')
    expect(arc, 'the Character Arc tile should be on the reading dashboard').not.toBeNull()
    expect(arc!.text, 'no character stands in for the missing count').toBe('')
    expect(arc!.glyphs, 'its own icon, plus a chevron saying it goes somewhere').toBe(2)

    // Presence, in the same test on the same screen: a tile that does count
    // something shows the number and carries no chevron. Vacuity cannot satisfy
    // both halves.
    const chars = await slot('Characters')
    expect(chars!.text, `the Characters tile counts, and showed "${chars!.text}"`).toMatch(/^\d+$/)
    expect(chars!.glyphs, 'a counted tile needs no chevron').toBe(1)
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
