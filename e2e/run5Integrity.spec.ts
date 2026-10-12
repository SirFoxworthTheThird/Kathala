import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Writer run 5's data losses on the Page:
 *
 * - W5-1: "Create … as a place" redrew the line from the records, keeping only
 *   unknown people — so the items and facts still waiting for their own
 *   buttons were dropped, tokens and all, with nothing said.
 * - W5-4: making the place while the line was applied wrote the cast twice —
 *   two states for one person at one scene.
 * - W5-3: a name picked with "@" over prose already written was followed by a
 *   space before the comma: "Ann Bell , aged".
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, c: object) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The assize rises', 'The court sat.'], ['e2', 'Teodora at the table', 'She counted.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    // The foundling the book comes to call Tobias.
    await db.events.update('e2', { involvedCharacterIds: ['teo'] })
    await db.characterSnapshots.add({ id: 's-teo', worldId: id, characterId: 'teo', eventId: 'e2', sortKey: 1.000002, isAlive: true, currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'teo', worldId: id, name: 'Teodora Vance', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'fnd', worldId: id, name: 'The Foundling', description: '', aliases: ['Tobias'], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}


const store = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  const [people, states, items, places, texts, events] = await Promise.all(['characters', 'characterSnapshots', 'items', 'locationMarkers', 'sceneTexts', 'events'].map((t) => db[t].toArray()))
  const name = (id: unknown) => people.find((p) => p.id === id)?.name
  return {
    statesAtE2: states.filter((s) => s.eventId === 'e2').map((s) => name(s.characterId)).sort(),
    items: items.map((i) => i.name).sort(),
    places: places.map((p) => p.name).sort(),
    e2place: places.find((p) => p.id === events.find((e) => e.id === 'e2')?.locationMarkerId)?.name ?? null,
    e1text: texts.find((t) => t.eventId === 'e1')?.text,
  }
})

test.describe('writer run 5: what the Page lost', () => {
  test.describe.configure({ timeout: 120_000 })

  test('W5-1: making the place keeps the line, and what else it names that the world has not got', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'The court sat.' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[#The Quay ^Brass Lamp ^Iron Key]')
    await page.keyboard.press('Enter')

    const place = page.getByRole('button', { name: 'Create “The Quay” as a place', exact: true })
    const lamp = page.getByRole('button', { name: 'Create “Brass Lamp” as an item', exact: true })
    await expect(place).toBeVisible()
    await expect(lamp).toBeVisible()
    await place.click()
    await expect.poll(async () => (await store(page)).places).toEqual(['The Quay'])

    // The items are still on the line and still offered; nothing was made that was not asked for.
    await expect(lamp).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create “Iron Key” as an item', exact: true })).toBeVisible()
    await expect(page.locator('.cm-line', { hasText: '^Brass Lamp' })).toHaveCount(1)
    expect((await store(page)).items).toEqual([])

    // And made, they join the scene: the line is clean, and drawn back as the block.
    await lamp.click()
    await page.getByRole('button', { name: 'Create “Iron Key” as an item', exact: true }).click()
    await expect.poll(async () => (await store(page)).items).toEqual(['Brass Lamp', 'Iron Key'])
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
  })

  test('W5-1 on a scene card: the same', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The assize rises', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('The court sat.', { timeout: 20_000 })
    await draft.click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('[#The Quay ^Brass Lamp]\n')
    await draft.blur()

    await page.getByRole('button', { name: 'Create “The Quay” as a place', exact: true }).click()
    await expect.poll(async () => (await store(page)).places).toEqual(['The Quay'])
    await expect(page.getByRole('button', { name: 'Create “Brass Lamp” as an item', exact: true })).toBeVisible()
    // Still on the line, not only offered: the line was not redrawn from the records without it.
    await expect(draft).toHaveValue(/\^Brass Lamp/)
    expect((await store(page)).items).toEqual([])
    // Made, it joins the scene.
    await page.getByRole('button', { name: 'Create “Brass Lamp” as an item', exact: true }).click()
    await expect.poll(async () => (await store(page)).items).toEqual(['Brass Lamp'])
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ involvedItemIds: string[] }> } }
      return (await db.events.get('e1')).involvedItemIds.length
    })).toBe(1)
  })

  test('W5-4: a person made in the header, then the place it named made — one state each', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // The block drawn for Teodora: a Place line added to it, and left.
    const open = page.locator('.cm-line').filter({ hasText: /^\[$/ }).first()
    await expect(open).toBeVisible()
    await open.click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('  Place: #The Quay', { delay: 20 })
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('button', { name: 'Create “The Quay” as a place', exact: true })).toBeVisible()
    // Somebody new on the Characters line, made with Tab, then the place.
    await page.locator('.cm-line', { hasText: 'Characters:' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Ann Bell', { delay: 30 })
    await expect(page.getByRole('button', { name: 'Ann Bell new character', exact: true })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByText('Ann Bell is new.')).toBeVisible()
    await page.getByRole('button', { name: 'Create “The Quay” as a place', exact: true }).click()

    await expect.poll(async () => (await store(page)).e2place).toBe('The Quay')
    await expect.poll(async () => (await store(page)).statesAtE2, { timeout: 10_000 }).toEqual(['Ann Bell', 'Teodora Vance'])
    await page.waitForTimeout(1500)
    expect((await store(page)).statesAtE2).toEqual(['Ann Bell', 'Teodora Vance'])
  })

  test('W5-3: a name picked over prose already written takes no space before the comma', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    // "The court sat." — pick a name in place of "court", the full stop after it untouched.
    const line = page.locator('.cm-line', { hasText: 'The court sat.' }).first()
    await line.click()
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowLeft')
    for (let i = 0; i < 'sat'.length; i++) await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.type('@Teo')
    await expect(page.getByRole('button', { name: 'Teodora Vance character', exact: true })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await store(page)).e1text, { timeout: 15_000 }).toBe('The court Teodora Vance.')
    // And at the end of a line, where nothing follows, the space to go on typing is still there.
    await page.keyboard.press('End')
    await page.keyboard.type(' @Teo')
    await page.keyboard.press('Enter')
    await page.keyboard.type('nods.')
    await expect.poll(async () => (await store(page)).e1text, { timeout: 15_000 }).toBe('The court Teodora Vance. Teodora Vance nods.')
  })
})
