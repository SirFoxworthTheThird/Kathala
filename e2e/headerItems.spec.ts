import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { heldAt } from './helpers/custody'

/**
 * The Items line in a scene's header — `^Ash Ledger:@Sabine Varro`,
 * `^Warden's Pistol:#The Drowned Chapel` (docs/records/scene-header-block-plan.md,
 * part 3): the hand-off and the placement it records at the scene, the scene it
 * is drawn on, and taking it back.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ash Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    for (const [cid, name] of [['pell', 'Pell Okonjo'], ['sab', 'Sabine Varro']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    for (const [iid, name] of [['ledger', 'Ash Ledger'], ['pistol', "Warden's Pistol"]] as const) {
      await db.items.add({ id: iid, worldId: id, name, description: '', iconType: 'other', tags: [], imageId: null, createdAt: now, updatedAt: now })
    }
    await db.locationMarkers.add({
      id: 'chapel', worldId: id, mapLayerId: null, name: 'The Drowned Chapel', description: '',
      x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'The quay', 'The boats were in.'],
      ['e2', 'The chapel', 'The bell rang under the water.'],
      ['e3', 'After', 'Nobody spoke of it.'],
    ] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: 'chapel', involvedCharacterIds: ['pell', 'sab'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
    // Pell has the ledger from the first scene.
    await db.characterSnapshots.add({
      id: 'pell-e1', worldId: id, characterId: 'pell', eventId: 'e1', sortKey: 1.000001, isAlive: true,
      currentLocationMarkerId: 'chapel', currentMapLayerId: null, inventoryItemIds: ['ledger'], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

/** Who holds what at each scene, by custody (Part B1); the items each scene has; and where items are put down. */
const records = async (page: Page) => {
  const rest = await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      events: { toArray: () => Promise<Array<{ id: string; involvedItemIds: string[]; involvedCharacterIds: string[] }>> }
      itemPlacements: { toArray: () => Promise<Array<{ itemId: string; eventId: string; locationMarkerId: string }>> }
    }
    const inScene = Object.fromEntries((await db.events.toArray()).map((e) => [e.id, e.involvedItemIds]))
    const placed = (await db.itemPlacements.toArray()).map((p) => `${p.itemId}@${p.eventId}:${p.locationMarkerId}`)
    // The chapel scene's cast: an edit to its Items line must leave it as it was.
    const cast = (await db.events.toArray()).find((e) => e.id === 'e2')?.involvedCharacterIds
    return { cast, inScene, placed }
  })
  const held = { e1: await heldAt(page, 'e1'), e2: await heldAt(page, 'e2'), e3: await heldAt(page, 'e3') }
  return { cast: rest.cast, held, inScene: rest.inScene, placed: rest.placed }
}

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()
const headerTexts = (page: Page) => page.evaluate(() => {
  const blocks: string[][] = []
  for (const el of document.querySelectorAll('.cm-line.cm-draft-header')) {
    if (el.classList.contains('cm-draft-header-start')) blocks.push([])
    blocks[blocks.length - 1]?.push(el.textContent ?? '')
  }
  return blocks.map((b) => b.join('\n'))
})
async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const CAST = '[\n  Place: #The Drowned Chapel\n  Characters: @@Pell Okonjo @@Sabine Varro\n]'
const GIVEN = '[\n  Place: #The Drowned Chapel\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Items: ^Ash Ledger:@Sabine Varro\n]'
/** The first scene: Pell's first recorded state is the first to list the ledger, so it is his from there. */
const HIS = '[\n  Place: #The Drowned Chapel\n  Characters: @@Pell Okonjo @@Sabine Varro\n  Items: ^Ash Ledger:@Pell Okonjo\n]'

test.describe('the Items line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: a hand-off typed in the chapel scene is hers from there, drawn there and not after, and taken back is his again', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([HIS, CAST, CAST])

    // A line for items, added to the second scene's header.
    await page.locator('.cm-line', { hasText: 'Characters: @@Pell Okonjo @@Sabine Varro' }).nth(1).click()
    await page.keyboard.press('End')
    // The caret is at the end of a name, so the picker is open: Enter would complete the name, not start a line.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Items: ^Ash Ledger:@Sabine Varro')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()

    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      cast: ['pell', 'sab'],
      // Hers from the chapel on — the scene after it included, whatever its records copied.
      held: { e1: { pell: ['ledger'] }, e2: { sab: ['ledger'] }, e3: { sab: ['ledger'] } },
      inScene: { e1: [], e2: ['ledger'], e3: [] },
      placed: [],
    })
    // Drawn from the records on a page opened afresh: at the chapel, and not a scene later, where she still has it.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([HIS, GIVEN, CAST])

    // Taken back: the item stays in the scene, and goes back to Pell.
    await line(page, 'Items: ^Ash Ledger:@Sabine Varro').click()
    await page.keyboard.press('End')
    for (let i = 0; i < ':@Sabine Varro'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      cast: ['pell', 'sab'],
      held: { e1: { pell: ['ledger'] }, e2: { pell: ['ledger'] }, e3: { pell: ['ledger'] } },
      inScene: { e1: [], e2: ['ledger'], e3: [] },
      placed: [],
    })
    await expect.poll(() => headerTexts(page)).toEqual([HIS, `${CAST.slice(0, -2)}\n  Items: ^Ash Ledger\n]`, CAST])
  })

  test('on a scene card: an item put down at a place is placed there at that scene, and an item nothing answers is said', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${CAST}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    // A misspelt item: said, and nothing written.
    await draft.fill(`${CAST.slice(0, -2)}\n  Items: ^Wardens Pistol:#The Drowned Chapel\n]\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called “Wardens Pistol”/)).toBeVisible({ timeout: 20_000 })
    expect((await records(page)).placed).toEqual([])

    await draft.fill(`${CAST.slice(0, -2)}\n  Items: ^Warden's Pistol:#The Drowned Chapel\n]\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect.poll(async () => (await records(page)).placed, { timeout: 20_000 }).toEqual(['pistol@e2:chapel'])
    expect((await records(page)).cast).toEqual(['pell', 'sab'])
    expect((await records(page)).inScene.e2).toEqual(['pistol'])
    await expect(draft).toHaveValue(`${CAST.slice(0, -2)}\n  Items: ^Warden's Pistol:#The Drowned Chapel\n]\n\nThe bell rang under the water.`, { timeout: 20_000 })
  })
})
