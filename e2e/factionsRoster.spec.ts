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

  test('FAC-3: a long name wraps like the description under it, rather than being cut', async ({ page }) => {
    const worldId = await factions(page)

    // "The Fellowship of the R…" was cut at one line directly above two full
    // lines of body text. Rename one faction to something that long, and give
    // it a description, so both are on the card at once — which is the whole
    // of the finding.
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        factions: {
          toArray: () => Promise<{ id: string; name: string }[]>
          update: (id: string, changes: Record<string, unknown>) => Promise<unknown>
        }
      }
      void worldId
      const all = await db.factions.toArray()
      const salt = all.find((f) => f.name === 'The Salt Guild')!
      const watch = all.find((f) => f.name === 'The Harbour Watch')!
      await db.factions.update(salt.id, {
        name: 'The Grand and Ancient Fellowship of the Salt Guild',
        description: 'A chartered company of tide-readers, bell-keepers and people who know exactly which harbour master to bribe.',
      })
      // A short name on the same screen, for the paired read below.
      await db.factions.update(watch.id, { name: 'Watch' })
    }, worldId)

    await expect(page.getByText('The Grand and Ancient Fellowship of the Salt Guild')).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(500)

    const measured = await page.evaluate(() => {
      const names = Array.from(document.querySelectorAll('[data-faction-name]')) as HTMLElement[]
      const of = (text: string) => {
        const el = names.find((n) => (n.textContent ?? '').trim() === text)!
        return {
          height: Math.round(el.getBoundingClientRect().height),
          // A single-line `truncate` reports content wider than its box; a
          // wrapped element does not.
          overflowing: el.scrollWidth > el.clientWidth + 1,
          shown: (el.textContent ?? '').trim(),
        }
      }
      return { long: of('The Grand and Ancient Fellowship of the Salt Guild'), short: of('Watch') }
    })

    // The long name is on two lines and nothing is clipped off the side.
    expect(measured.long.overflowing, 'the name should wrap, not run past its box').toBe(false)
    expect(
      measured.long.height,
      `long ${measured.long.height}px vs short ${measured.short.height}px`,
    ).toBeGreaterThan(measured.short.height)

    // Paired: a name that fits still takes one line, so the fix is "wrap when
    // you must", not "every card is now taller".
    expect(measured.short.height).toBeLessThan(measured.long.height)
    expect(measured.short.overflowing).toBe(false)
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
