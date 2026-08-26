import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * The Factions roster and the search palette must agree about which factions a
 * reader has met.
 *
 * They did not: search gated factions by membership, the roster did not gate at
 * all, so the same faction could be hidden in search and listed on the Factions
 * page at the same cursor — descriptions included. A faction name is among the
 * sharpest things a world holds; "Voldemort and His Servants" on the roster in
 * chapter one is the whole book.
 */
test.describe('Faction reveal', () => {
  test.describe.configure({ timeout: 180_000 })

  const UNMET = ['Voldemort and His Servants', 'Slytherin House']
  const MET = 'The Dursley Household'

  test('the roster hides factions the reader has met nobody in', async ({ page }) => {
    await resetDB(page)
    await downloadLibraryBook(page, DEFAULT_BOOK)
    await settle(page)
    const worldId = new URL(page.url()).hash.split('/')[2]

    // Step onto the opening moment, where nearly the whole book is unread.
    await page.getByRole('button', { name: 'Next moment' }).click()
    await settle(page)

    await page.goto(`/#/worlds/${worldId}/factions`)
    await settle(page)

    // Present: the reader has met all four Dursleys by now.
    await expect(page.getByText(MET).first(), `"${MET}" should be listed`).toBeVisible()

    // Absent: nobody in either has appeared yet. Paired with the above, so this
    // cannot pass because the roster simply failed to render.
    for (const name of UNMET) {
      await expect(page.getByText(name), `"${name}" should not be listed at chapter one`).toHaveCount(0)
    }

    // Search must give the same answer at the same cursor.
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(500)
    await page.getByRole('textbox').first().fill('house')
    await page.waitForTimeout(900)
    const results = (await page.locator('[role="dialog"], .fixed').first().innerText().catch(() => '')) || ''
    expect(results, 'search and the roster disagree about Slytherin House')
      .not.toContain('Slytherin House')
  })

  test("a faction's territories wait for the reader to reach them", async ({ page }) => {
    // The Territories list queried mapRegions and locationMarkers by factionId
    // and rendered them straight out, so a faction the reader had met could name
    // a place they had not. No shipped book has a faction territory, so nothing
    // exercised this path — the leak that first pointed at it turned out to be a
    // faction description instead.
    await resetDB(page)
    await downloadLibraryBook(page, DEFAULT_BOOK)
    await settle(page)
    const worldId = new URL(page.url()).hash.split('/')[2]

    await page.getByRole('button', { name: 'Next moment' }).click()
    await settle(page)

    // Give a faction the reader *has* met a territory they have *not*: a marker
    // tied to no event at all, which the gate treats as unreached.
    const attached = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        factions: { toArray: () => Promise<{ id: string; name: string }[]> }
        mapLayers: { toArray: () => Promise<{ id: string; worldId: string }[]> }
        locationMarkers: { add: (v: Record<string, unknown>) => Promise<unknown> }
      }
      const factions = await db.factions.toArray()
      const dursleys = factions.find((f) => f.name === 'The Dursley Household')
      const layer = (await db.mapLayers.toArray())[0]
      if (!dursleys || !layer) return null
      await db.locationMarkers.add({
        id: 'terr-unmet-test', worldId: layer.worldId, mapLayerId: layer.id,
        name: 'Hollow of Testing', description: '', type: 'landmark',
        x: 100, y: 100, factionId: dursleys.id, linkedMapLayerId: null,
        iconType: 'landmark', color: null, createdAt: Date.now(), updatedAt: Date.now(),
      })
      return dursleys.name
    })
    expect(attached, 'the seeding seam should be present in an e2e build').toBe('The Dursley Household')

    await page.goto(`/#/worlds/${worldId}/factions`)
    await page.getByText('The Dursley Household').first().click()
    await expect(page.getByText('Territories')).toBeVisible()
    await expect(page.getByText('Hollow of Testing'),
      'a territory the reader has not reached should not be listed').toHaveCount(0)

    // The other half: with reading mode off the gate is inactive and nothing is
    // withheld, so this cannot pass because the territory simply failed to save.
    await page.goto(`/#/worlds/${worldId}/settings`)
    await page.getByRole('button', { name: 'Turn off reading mode' }).click()
    await settle(page)
    await page.goto(`/#/worlds/${worldId}/factions`)
    await page.getByText('The Dursley Household').first().click()
    await expect(page.getByText('Hollow of Testing'),
      'with the whole book revealed the same territory should be listed').toBeVisible({ timeout: 15_000 })
  })
})
