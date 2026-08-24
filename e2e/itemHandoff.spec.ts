import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Handing an item from one character to another used to **delete the previous
 * holder's earlier record of ever having held it**.
 *
 * `useBestSnapshots` resolves each character's last known state at or before the
 * cursor, so for someone untouched since chapter one it returns their chapter
 * one row. The hand-off spread that row — `eventId` and all — and
 * `upsertSnapshot` updated the record it named. The Whereabouts chain then
 * showed the shortened history and looked entirely reasonable.
 *
 * Driven through the UI, because that is where it happened and the option is
 * labelled for it: "(transfer from other character)".
 */

const LEDGER = "Ovin's Tide-Ledger"

async function twoCharactersAndAnItem(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Handoff')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, ledger]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'ovin', worldId: id, name: 'Master Ovin', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'rell', worldId: id, name: 'Rell Vashti', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'ledger', worldId: id, name: ledger, description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['ovin', 'rell'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    for (const n of [1, 2]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'The ninth bell', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch2', title: 'Mother Sable counts', sortOrder: 0 })

    // Ovin holds the ledger from chapter one, and is not touched again.
    await db.characterSnapshots.add({
      id: 's-ovin-1', worldId: id, characterId: 'ovin', eventId: 'ev1', isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: ['ledger'],
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 1,
      createdAt: now, updatedAt: now,
    })
  }, [worldId, LEDGER])
  return worldId
}

/** Every snapshot's inventory, keyed by "<character>@<scene>". */
const inventories = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; eventId: string; inventoryItemIds: string[] }>> } }
  const all = await db.characterSnapshots.toArray()
  return Object.fromEntries(all.map((s) => [`${s.characterId}@${s.eventId}`, s.inventoryItemIds]))
})

test.describe('handing an item over keeps the record of who had it', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the previous holder keeps their earlier scene', async ({ page }) => {
    const worldId = await twoCharactersAndAnItem(page)

    // Ovin has it in chapter one, before anything is handed over.
    expect((await inventories(page))['ovin@ev1']).toEqual(['ledger'])

    // Rell takes it at chapter two, by the app's own supported route.
    await page.goto(`/#/worlds/${worldId}/characters/rell?tab=state`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Next moment' }).click()   // Ch.1
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Next moment' }).click()   // Ch.2
    await page.waitForTimeout(900)

    await page.getByRole('button', { name: 'Add existing item...' }).click()
    await page.getByRole('option', { name: new RegExp(LEDGER) }).click()
    await page.getByRole('button', { name: 'Save State' }).click()

    // Rell has it here…
    await expect.poll(async () => (await inventories(page))['rell@ev2'], { timeout: 15_000 })
      .toEqual(['ledger'])

    /*
      …and the whole of the finding: Ovin's chapter-one record still says he had
      it. He is recorded without it at chapter two instead, which is the true
      statement — he lost it there, not in chapter one.
    */
    const after = await inventories(page)
    expect(after['ovin@ev1'], "Ovin's chapter-one record was rewritten").toEqual(['ledger'])
    expect(after['ovin@ev2']).toEqual([])
  })
})
