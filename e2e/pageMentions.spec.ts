import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * "@" on the Page, as in a scene card's draft: the same rows, keys and records.
 *
 * Which rows are offered, what each key does, and what is written are
 * unit-tested (`mentionPicker`, `draftEditor`, `db/hooks/__tests__/mentions`).
 * Here is the real page: the list at the caret, the name put into the prose,
 * and the record written against the scene the name was typed in — not another.
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

/** What each scene records, and every character's and item's name. */
const records = (page: Page) => page.evaluate(async () => {
  type Ev = { id: string; involvedCharacterIds: string[]; mentionedCharacterIds?: string[]; involvedItemIds: string[] }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Ev[]> }
    characters: { toArray: () => Promise<Array<{ id: string; name: string }>> }
    items: { toArray: () => Promise<Array<{ id: string; name: string }>> }
  }
  const events = Object.fromEntries((await db.events.toArray()).map((e) => [e.id, {
    present: e.involvedCharacterIds, mentioned: e.mentionedCharacterIds ?? [], items: e.involvedItemIds,
  }]))
  return {
    events,
    characters: (await db.characters.toArray()).map((c) => c.name).sort(),
    items: Object.fromEntries((await db.items.toArray()).map((i) => [i.name, i.id])),
  }
})

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'The book, as one page' })
  await expect(editor).toBeVisible({ timeout: 20_000 })
  return editor
}
/** The caret at the end of the line holding `text`. */
async function caretAfter(page: Page, text: string) {
  await page.locator('.cm-line', { hasText: text }).first().click()
  await page.keyboard.press('End')
}
/** A row of the picker, by the name it offers and what kind of row it is. */
const row = (page: Page, name: string, kind: string) =>
  page.getByRole('button', { name: `${name} ${kind}`, exact: true })

test.describe('"@" on the Page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('@ names a character: the name goes into the prose, and the scene it was typed in records the mention', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await caretAfter(page, 'She counted.')
    await page.keyboard.type(' @Teo')
    await expect(row(page, 'Teodora Vance', 'character')).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(row(page, 'Teodora Vance', 'character')).toHaveCount(0)
    await expect(editor).toContainText('She counted. Teodora Vance')
    await expect(editor).not.toContainText('@Teo')
    await expect.poll(async () => (await records(page)).events).toEqual({
      e1: { present: [], mentioned: [], items: [] },
      e2: { present: [], mentioned: ['teo'], items: [] },
    })
  })

  test('@@ says they are in the room', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await caretAfter(page, 'The court sat.')
    await page.keyboard.type(' @@Teo')
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await records(page)).events.e1).toEqual({ present: ['teo'], mentioned: [], items: [] })
  })

  test('Enter on a name nobody has is a paragraph break, and Tab on a row is what makes the record', async ({ page }) => {
    const worldId = await book(page)
    const editor = await openPage(page, worldId)
    await caretAfter(page, 'She counted.')
    await page.keyboard.type(' @Wenmere')
    await expect(row(page, 'Wenmere', 'new character')).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('Then.')
    await expect(page.locator('.cm-line', { hasText: /^Then\.$/ })).toHaveCount(1)
    await expect(editor).toContainText('@Wenmere')

    await page.keyboard.type(' @Ledger')
    await expect(row(page, 'Ledger', 'new item')).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Tab')
    await expect.poll(async () => {
      const r = await records(page)
      return { characters: r.characters, ledger: r.events.e2.items.includes(r.items.Ledger) }
    }).toEqual({ characters: ['Teodora Vance'], ledger: true })
    await expect(editor).toContainText('Then. Ledger')
  })

  test('@@ on someone this world has not got says so, and a click on a row picks it', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await caretAfter(page, 'The court sat.')
    await page.keyboard.type(' @@Zed')
    await expect(page.getByRole('status').filter({ hasText: 'Nobody called “Zed” yet' })).toBeVisible()

    await page.keyboard.type(' @bread')
    await expect(page.getByRole('status').filter({ hasText: 'Nobody called' })).toHaveCount(0)
    await row(page, 'The bread knife', 'item').click()
    await expect.poll(async () => (await records(page)).events.e1.items).toEqual(['knife'])
  })

  test('the picker is for prose: an @ in a scene’s title opens nothing', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await caretAfter(page, 'Teodora at the table')
    await page.keyboard.type(' @Teo')
    await expect(row(page, 'Teodora Vance', 'character')).toHaveCount(0)
    // The same letters a line below, in the prose, do.
    await caretAfter(page, 'She counted.')
    await page.keyboard.type(' @Teo')
    await expect(row(page, 'Teodora Vance', 'character')).toBeVisible()
  })
})
