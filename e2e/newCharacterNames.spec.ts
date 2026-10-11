import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Somebody made by the "@" picker is asked, under the writing, for the other
 * names they go by — on the Page and on a scene card — and the names given are
 * theirs at once: the picker finds them by one.
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
    await db.characters.add({ id: 'teo', worldId: id, name: 'Teodora Vance', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'knife', worldId: id, name: 'The bread knife', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

/** Each character's name and aliases. */
const people = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { toArray: () => Promise<Array<{ name: string; aliases: string[] }>> } }
  return Object.fromEntries((await db.characters.toArray()).map((c) => [c.name, c.aliases]))
})
const row = (page: Page, name: string, kind: string) => page.getByRole('button', { name: `${name} ${kind}`, exact: true })

test.describe('the other names of somebody just made', () => {
  test.describe.configure({ timeout: 120_000 })

  test('on the Page: asked once they are made, and the names given are theirs — the picker finds them by one', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
    await page.keyboard.press('End')

    // Nobody answers to Aragorn yet: only offers to make him.
    await page.keyboard.type(' @Arag')
    await expect(row(page, 'Arag', 'new character')).toBeVisible()
    await expect(row(page, 'Strider', 'character')).toHaveCount(0)
    for (let i = 0; i < '@Arag'.length; i++) await page.keyboard.press('Backspace')

    const names = page.getByLabel(/Other names they go by/)
    await expect(names).toHaveCount(0)
    await page.keyboard.type('@Strider')
    await row(page, 'Strider', 'new character').click()
    await expect(names).toBeVisible()
    await expect(page.getByText('Strider is new.')).toBeVisible()
    // Asked, not taken: the caret is still in the prose.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()

    await names.fill('Aragorn, Elessar, strider')
    await page.getByRole('button', { name: 'Add names', exact: true }).click()
    await expect.poll(() => people(page)).toEqual({ 'Teodora Vance': [], Strider: ['Aragorn', 'Elessar'] })
    await expect(names).toHaveCount(0)

    await page.locator('.cm-line', { hasText: 'The court sat.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @Arag')
    await expect(row(page, 'Strider', 'character')).toBeVisible()
  })

  test('on a scene card: asked the same, and closing it gives nobody a name', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('She counted.', { timeout: 20_000 })
    const names = page.getByLabel(/Other names they go by/)
    await expect(names).toHaveCount(0)

    await draft.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @Pell Okonjo')
    await row(page, 'Pell Okonjo', 'new character').click()
    await expect(names).toBeVisible()
    await expect(page.getByText('Pell Okonjo is new.')).toBeVisible()

    await page.getByRole('button', { name: 'Not now: no other names for Pell Okonjo', exact: true }).click()
    await expect(names).toHaveCount(0)
    expect(await people(page)).toEqual({ 'Teodora Vance': [], 'Pell Okonjo': [] })
  })
})
