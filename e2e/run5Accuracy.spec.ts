import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Writer run 5's wrong or missing answers:
 *
 * - W5-2: a destroyed item's Whereabouts ended in a "gap" row, and its page
 *   never said it had been damaged or destroyed.
 * - W5-6: "St Agnes", a drowned church, was offered as the character Agnes
 *   Thorne named in the text.
 * - W5-8: somebody named only on a Relationships line could not be made from
 *   the header, and held the whole line back.
 */

/** `ledger`: Teodora carries The Tide Ledger and it is destroyed in her hands at the second scene. */
async function book(page: Page, ledger = true): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Bells')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, withLedger]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The bell', 'The bell of St Agnes rang across the flats.'], ['e2', 'The door', 'Agnes waited at the door.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 8, updatedAt: now })
    }
    for (const [cid, name] of [['teo', 'Teodora Vance'], ['agnes', 'Agnes Thorne']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.locationMarkers.add({ id: 'church', worldId: id, mapLayerId: null, name: 'St Agnes-under-the-Water', description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    if (!withLedger) return
    await db.items.add({ id: 'ledger', worldId: id, name: 'The Tide Ledger', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    // Teodora carries the ledger from the first scene; at the second it is destroyed in her hands.
    const state = (eventId: string, sortKey: number, inventoryItemIds: string[]) => ({
      id: `teo-${eventId}`, worldId: id, characterId: 'teo', eventId, sortKey, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null,
      inventoryItemIds, inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
    await db.characterSnapshots.add(state('e1', 1.000001, ['ledger']))
    await db.characterSnapshots.add(state('e2', 1.000002, []))
    await db.itemSnapshots.add({ id: 'is-e2', worldId: id, itemId: 'ledger', eventId: 'e2', sortKey: 1.000002, condition: 'destroyed', notes: '', createdAt: now, updatedAt: now })
  }, [worldId, ledger] as const)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const people = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  return {
    names: (await db.characters.toArray()).map((c) => c.name).sort(),
    relationships: (await db.relationships.toArray()).map((r) => r.label),
  }
})

test.describe('writer run 5: what the app got wrong or left out', () => {
  test.describe.configure({ timeout: 120_000 })

  test('W5-2: a destroyed item’s Whereabouts says so, in whose hands, and shows no gap', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/items/ledger`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByText('carried by Teodora Vance', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText("destroyed in Teodora Vance's hands", { exact: true })).toBeVisible()
    await expect(main.getByText('gap', { exact: true })).toHaveCount(0)
  })

  test('W5-6: "St Agnes" is the church, not Agnes Thorne; "Agnes" alone is her', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const panel = page.getByRole('region', { name: 'This scene' })
    const chip = panel.getByRole('button', { name: 'Agnes Thorne', exact: true })

    await page.locator('.cm-line', { hasText: 'St Agnes rang' }).first().click()
    await expect(panel.getByRole('heading', { name: 'The bell' })).toBeVisible()
    await page.waitForTimeout(500)
    await expect(chip).toHaveCount(0)

    await page.locator('.cm-line', { hasText: 'Agnes waited' }).first().click()
    await expect(panel.getByRole('heading', { name: 'The door' })).toBeVisible()
    await expect(chip).toBeVisible()
  })

  test('W5-8: somebody named only on a Relationships line is offered to be made, and then the line is written', async ({ page }) => {
    const worldId = await book(page, false)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'St Agnes rang' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[~Teodora Vance/Lydia Marrick:Siblings]')
    await page.keyboard.press('Enter')

    const make = page.getByRole('button', { name: 'Create “Lydia Marrick” as a character', exact: true })
    await expect(make).toBeVisible()
    expect(await people(page)).toEqual({ names: ['Agnes Thorne', 'Teodora Vance'], relationships: [] })
    await make.click()
    await expect.poll(() => people(page)).toEqual({ names: ['Agnes Thorne', 'Lydia Marrick', 'Teodora Vance'], relationships: ['Siblings'] })
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
  })

  test('W5-8 on a scene card: the same', async ({ page }) => {
    const worldId = await book(page, false)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The door', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('Agnes waited at the door.', { timeout: 20_000 })
    await draft.click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('[~Teodora Vance/Lydia Marrick:Siblings]\n')
    await draft.blur()
    await page.getByRole('button', { name: 'Create “Lydia Marrick” as a character', exact: true }).click()
    await expect.poll(() => people(page)).toEqual({ names: ['Agnes Thorne', 'Lydia Marrick', 'Teodora Vance'], relationships: ['Siblings'] })
  })
})
