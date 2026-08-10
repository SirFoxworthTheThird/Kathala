import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * LORE-2 — "Revealed at" is a headline lore feature and the card said nothing
 * about it, so a page held back to a later chapter looked exactly like one
 * visible from the first page.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  chapters: [
    { title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] },
    { title: 'Ashfall', events: [{ id: 'e2', title: 'The long road' }] },
  ],
  lore: [
    { title: 'The Salt Accord', body: 'A treaty nobody honours.' },
    { title: 'The Drowned King', body: 'Who he was.' },
  ],
})

async function loreRoster(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

test.describe('The Lore roster', () => {
  test.describe.configure({ timeout: 150_000 })

  test('LORE-2: a gated page says so, and an ungated one does not', async ({ page }) => {
    const worldId = await loreRoster(page)
    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
    await expect(page.getByText('The Salt Accord')).toBeVisible({ timeout: 30_000 })

    // Absence first: nothing is gated, so no card claims to be.
    await expect(page.getByText(/^From ch\./)).toHaveCount(0)

    // Gate one page to the second chapter's scene.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        lorePages: {
          toArray: () => Promise<{ id: string; title: string }[]>
          update: (k: string, v: unknown) => Promise<unknown>
        }
        events: { toArray: () => Promise<{ id: string; title: string }[]> }
      }
      // The spec's "e2" is a slug for cross-references, not the stored id.
      const events = await db.events.toArray()
      const target = events.find((e) => e.title === 'The long road')!
      const pages = await db.lorePages.toArray()
      const drowned = pages.find((p) => p.title === 'The Drowned King')!
      await db.lorePages.update(drowned.id, { visibleFromEventId: target.id })
    })

    // Presence: it names the chapter it opens at — and only that page does, so
    // the badge is about the gating rather than decoration on every card.
    await expect(page.getByText('From ch. 2')).toBeVisible({ timeout: 15_000 })
    expect(await page.getByText(/^From ch\./).count(), 'only the gated page should be badged').toBe(1)
  })
})
