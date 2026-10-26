import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { heldAt } from './helpers/custody'

/**
 * An item the header's Items line names and the world has not got: the note
 * offers to make it, as it does a place or a fact, and the line then puts it
 * in the scene. The header had no other way to make one — writer run 4 made
 * every item by "@"-naming it in the prose first.
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
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
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

/** The caret at the start of scene "Teodora at the table"'s prose, where its header goes. */
async function firstLine(page: Page) {
  await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
  await page.keyboard.press('Home')
}

/** The scene's items, by name, and every item in the world. */
const items = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ involvedItemIds: string[] }> }
    items: { toArray: () => Promise<Array<{ id: string; name: string }>> }
  }
  const all = await db.items.toArray()
  return {
    scene: (await db.events.get('e2')).involvedItemIds.map((id) => all.find((i) => i.id === id)?.name).sort(),
    world: all.map((i) => i.name).sort(),
  }
})

test.describe('an item made from the header note', () => {
  test.describe.configure({ timeout: 120_000 })

  test('on the Page: offered, made, put in the scene, and the note goes', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await firstLine(page)
    await page.keyboard.type('[^Brass Bell:@Teodora Vance]')
    await page.keyboard.press('Enter')

    const create = page.getByRole('button', { name: 'Create “Brass Bell” as an item', exact: true })
    await expect(page.getByRole('status').filter({ hasText: 'Nothing in this world is called “Brass Bell”' })).toBeVisible()
    await expect(create).toBeVisible()
    expect((await items(page)).world).toEqual([])

    await create.click()
    await expect.poll(() => items(page)).toEqual({ scene: ['Brass Bell'], world: ['Brass Bell'] })
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
    await expect(create).toHaveCount(0)
    // And what the line said of it is written: Teodora has it from this scene.
    await expect.poll(async () => (await heldAt(page, 'e2')).teo?.length ?? 0).toBe(1)
  })

  test('on a scene card: the same', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('She counted.', { timeout: 20_000 })
    await draft.click()
    await page.keyboard.press('Control+Home')
    await page.keyboard.type('[^Brass Bell]\n')
    await draft.blur()

    const create = page.getByRole('button', { name: 'Create “Brass Bell” as an item', exact: true })
    await expect(create).toBeVisible()
    expect((await items(page)).world).toEqual([])
    await create.click()
    await expect.poll(() => items(page)).toEqual({ scene: ['Brass Bell'], world: ['Brass Bell'] })
    await expect(create).toHaveCount(0)
    await expect(page.getByText(/Nothing in this world is called/)).toHaveCount(0)
  })
})
