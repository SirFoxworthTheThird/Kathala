import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { heldAt } from './helpers/custody'

/**
 * An item's condition on the Items line — `^Ash Ledger:damaged` — recorded as
 * its state at the scene, drawn where it changes and not after, and taken back.
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
    await db.items.add({ id: 'ledger', worldId: id, name: 'Ash Ledger', description: '', iconType: 'other', tags: [], imageId: null, createdAt: now, updatedAt: now })
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
        tags: [], locationMarkerId: null, involvedCharacterIds: ['pell', 'sab'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
    // Intact from the first scene, with a note on it.
    await db.itemSnapshots.add({ id: 'l1', worldId: id, itemId: 'ledger', eventId: 'e1', sortKey: 1.000001, condition: 'intact', notes: 'Bound in grey calf.', createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

/** The ledger's state at each scene that has one, and the items in the chapel scene. */
const records = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    itemSnapshots: { toArray: () => Promise<Array<{ eventId: string; condition: string; notes: string }>> }
    events: { get: (k: string) => Promise<{ involvedItemIds: string[] }> }
  }
  return {
    states: (await db.itemSnapshots.toArray()).map((s) => `${s.eventId}:${s.condition}:${s.notes}`).sort(),
    inScene: (await db.events.get('e2')).involvedItemIds,
  }
})

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

const CAST = '[\n  Characters: @@Pell Okonjo @@Sabine Varro\n]'
const withItems = (items: string) => `${CAST.slice(0, -2)}\n  Items: ${items}\n]`

test.describe('an item’s condition on the Items line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: recorded at the scene with the note it had, drawn there and not after, and taken back', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([withItems('^Ash Ledger:intact'), CAST, CAST])

    await page.locator('.cm-line', { hasText: 'Characters: @@Pell Okonjo @@Sabine Varro' }).nth(1).click()
    await page.keyboard.press('End')
    // The caret is at the end of a name, so the picker is open: Enter would complete the name, not start a line.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('  Items: ^Ash Ledger:damaged')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      states: ['e1:intact:Bound in grey calf.', 'e2:damaged:Bound in grey calf.'],
      inScene: ['ledger'],
    })

    // From the records, on a page opened afresh: damaged at the chapel, and not drawn again after it.
    await page.reload({ waitUntil: 'load' })
    await openPage(page, worldId)
    await expect.poll(() => headerTexts(page), { timeout: 20_000 }).toEqual([withItems('^Ash Ledger:intact'), withItems('^Ash Ledger:damaged'), CAST])

    // Taken off: the state at the chapel goes; the item stays in the scene.
    await line(page, 'Items: ^Ash Ledger:damaged').click()
    await page.keyboard.press('End')
    for (let i = 0; i < ':damaged'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => records(page), { timeout: 20_000 }).toEqual({
      states: ['e1:intact:Bound in grey calf.'],
      inScene: ['ledger'],
    })
    await expect.poll(() => headerTexts(page)).toEqual([withItems('^Ash Ledger:intact'), withItems('^Ash Ledger'), CAST])
  })

  test('on a scene card: a condition and a hand-off on one item, both recorded, drawn back as one token', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue(`${CAST}\n\nThe bell rang under the water.`, { timeout: 20_000 })

    // Written after the hand-off; drawn before it.
    await draft.fill(`${withItems('^Ash Ledger:@Sabine Varro:destroyed')}\n\nThe bell rang under the water.`)
    await draft.blur()
    await expect.poll(async () => (await records(page)).states, { timeout: 20_000 }).toEqual(['e1:intact:Bound in grey calf.', 'e2:destroyed:Bound in grey calf.'])
    // In her hands, destroyed there, by custody.
    expect(await heldAt(page, 'e2')).toEqual({ sab: ['ledger'] })
    await expect(draft).toHaveValue(`${withItems('^Ash Ledger:destroyed:@Sabine Varro')}\n\nThe bell rang under the water.`, { timeout: 20_000 })
  })
})
