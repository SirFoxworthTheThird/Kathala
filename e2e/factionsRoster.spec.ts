import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * FAC-1 and FAC-2 — what the Factions roster shows and what it lets you find.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }, { name: 'Bram' }],
  factions: [
    { name: 'The Salt Guild', members: ['Kestrel'] },
    { name: 'The Ashfall Order', members: ['Bram'] },
    { name: 'The Harbour Watch', members: [] },
  ],
  chapters: [{ title: 'Landfall', events: [{ id: 'e1', title: 'The wreck' }] }],
})

async function factions(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/factions`, { waitUntil: 'load' })
  await expect(page.getByText('The Salt Guild').first()).toBeVisible({ timeout: 30_000 })
  return worldId
}

test.describe('The Factions roster', () => {
  test.describe.configure({ timeout: 150_000 })

  test('FAC-2: it can be searched, like every other roster', async ({ page }) => {
    await factions(page)
    const box = page.getByPlaceholder('Search factions…')
    await expect(box).toBeVisible()

    await box.fill('Ashfall')
    await expect(page.getByText('The Ashfall Order')).toBeVisible()
    await expect(page.getByText('The Salt Guild')).toHaveCount(0)

    // A search with no hits says so rather than showing an empty grid.
    await box.fill('nothing here')
    await expect(page.getByText('No matches')).toBeVisible()

    // And clearing it brings everything back, so the filter is a filter.
    await box.fill('')
    await expect(page.getByText('The Salt Guild')).toBeVisible()
    await expect(page.getByText('The Harbour Watch')).toBeVisible()
  })

  test('FAC-1: a card says who it is allied with and who it is against', async ({ page }) => {
    const worldId = await factions(page)

    // Absence first: with no stances recorded, no card claims any.
    await expect(page.getByText(/\d+ hostile/)).toHaveCount(0)
    await expect(page.getByText(/\d+ allied/)).toHaveCount(0)

    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        factions: { toArray: () => Promise<{ id: string; name: string }[]> }
        factionRelationships: { add: (v: unknown) => Promise<unknown> }
      }
      const all = await db.factions.toArray()
      const salt = all.find((f) => f.name === 'The Salt Guild')!
      const ash = all.find((f) => f.name === 'The Ashfall Order')!
      const watch = all.find((f) => f.name === 'The Harbour Watch')!
      const now = Date.now()
      await db.factionRelationships.add({
        id: 'fr-1', worldId, factionAId: salt.id, factionBId: ash.id,
        stance: 'hostile', notes: '', createdAt: now, updatedAt: now,
      })
      await db.factionRelationships.add({
        id: 'fr-2', worldId, factionAId: salt.id, factionBId: watch.id,
        stance: 'allied', notes: '', createdAt: now, updatedAt: now,
      })
    }, worldId)

    // Presence: the stance is counted on both sides of the one record, so the
    // Salt Guild shows one of each and the Watch shows only its ally.
    await expect(page.getByText('1 hostile').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('1 allied').first()).toBeVisible()
    expect(await page.getByText('1 hostile').count(), 'both sides of a stance should show it').toBe(2)
    expect(await page.getByText('1 allied').count()).toBe(2)
  })
})
