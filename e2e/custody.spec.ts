import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Item custody as statements (next-plan.md, Part B1): a hand-off is one
 * statement at its scene, and a later record that only copied the one before
 * it says nothing — through the Current State panel, not only the header.
 *
 * Writer run 11's W-3, by the panel's route: the ledger Ovin's from chapter
 * one, his chapter-three record a copy of it, and Rell given it in chapter
 * two. The copy used to outvote the hand-off, and the ledger was back in
 * Ovin's hands from chapter three on — on his panel, and on the item's page
 * as a step back to him that nobody wrote.
 */

const LEDGER = "Ovin's Tide-Ledger"

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Custody')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, ledger]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'ovin', worldId: id, name: 'Master Ovin', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'rell', worldId: id, name: 'Rell Vashti', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'ledger', worldId: id, name: ledger, description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'quay', worldId: id, mapLayerId: null, name: 'The Quay', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['ovin', 'rell'], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    const titles = ['The ninth bell', 'Mother Sable counts', 'Low water']
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({ ...base, id: `ev${n}`, chapterId: `ch${n}`, title: titles[n - 1], sortOrder: 0 })
    }
    const record = (eventId: string, sortKey: number) => ({
      id: `s-ovin-${eventId}`, worldId: id, characterId: 'ovin', eventId, isAlive: true, currentLocationMarkerId: 'quay', currentMapLayerId: null,
      inventoryItemIds: ['ledger'], inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey, createdAt: now, updatedAt: now,
    })
    // Ovin has it in chapter one, at the quay — recorded, as some of the Library's books record every carried thing, as placed where he is; his chapter-three record copies that.
    await db.characterSnapshots.add(record('ev1', 1))
    await db.characterSnapshots.add(record('ev3', 3))
    await db.itemPlacements.add({ id: 'p-ledger-ev1', worldId: id, itemId: 'ledger', eventId: 'ev1', locationMarkerId: 'quay', notes: '', sortKey: 1, createdAt: now, updatedAt: now })
  }, [worldId, LEDGER])
  return worldId
}

/** The cursor moved forward `n` moments from the first, as a writer steps through the book. */
async function stepTo(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.getByRole('button', { name: 'Next moment' }).click()
    await page.waitForTimeout(700)
  }
}

const holds = (page: Page) => page.getByRole('button', { name: `Take ${LEDGER} out of the inventory` })

test.describe('a hand-off holds past a later record that copied the one before it', () => {
  test.describe.configure({ timeout: 240_000 })

  test('on the panel of who had it, on the panel of who has it, and on the item’s page', async ({ page }) => {
    const worldId = await book(page)

    // Rell takes it at chapter two, on her Current State panel.
    await page.goto(`/#/worlds/${worldId}/characters/rell?tab=state`, { waitUntil: 'load' })
    await settle(page)
    await stepTo(page, 2)
    await page.getByRole('button', { name: 'Add existing item...' }).click()
    await page.getByRole('option', { name: new RegExp(LEDGER) }).click()
    await page.getByRole('button', { name: 'Save State' }).click()
    await expect(holds(page)).toBeVisible({ timeout: 15_000 })

    // Chapter three: still Rell's…
    await stepTo(page, 1)
    await expect(page.getByText('Low water').first()).toBeVisible()
    await expect(holds(page)).toBeVisible({ timeout: 15_000 })

    // …and not back in Ovin's hands, though his record there lists it. Paired: in chapter one it is his.
    await page.goto(`/#/worlds/${worldId}/characters/ovin?tab=state`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByText('Low water').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Current State' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText(/Inventory/i).first()).toBeVisible()
    await expect(holds(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Previous moment' }).click()
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Previous moment' }).click()
    await expect(holds(page)).toBeVisible({ timeout: 15_000 })

    /*
      The item's page: Ovin, then Rell — and no step back to Ovin at chapter
      three. Ovin's first step is his, at the quay: the placement says where he
      had it, not that he put it down (`deriveCustody`, rule 5).
    */
    await page.goto(`/#/worlds/${worldId}/items/ledger`, { waitUntil: 'load' })
    await settle(page)
    const rows = page.getByRole('main').locator('ol > li')
    await expect(rows.filter({ hasText: 'carried by Rell Vashti' })).toHaveCount(1, { timeout: 15_000 })
    await expect(rows.filter({ hasText: 'carried by Master Ovin · The Quay' })).toHaveCount(1)
    await expect(rows.filter({ hasText: 'left at The Quay' })).toHaveCount(0)
    await expect(rows.filter({ hasText: 'Low water' })).toHaveCount(0)

    // The Items roster, at chapter one where the cursor is: carried by Ovin at the quay, not lying there.
    await page.goto(`/#/worlds/${worldId}/items`, { waitUntil: 'load' })
    await settle(page)
    const card = page.getByRole('main').locator('a, li, article, div').filter({ hasText: LEDGER }).filter({ hasText: /carried by|The Quay/ }).last()
    await expect(card).toContainText('carried by Master Ovin · The Quay', { timeout: 15_000 })
  })
})
