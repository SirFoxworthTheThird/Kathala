import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { holdersByScene } from './helpers/custody'

/**
 * A correction at one scene reaches the scenes after it (writer run 11, W-3;
 * `docs/records/run-11-record-drift-plan.md`). A person's record holds their
 * whole inventory, copied from their last, so the Book given to Bruno at S1
 * instead of Anna was back with Anna at S2, where her copy still had it. Read
 * by custody (Part B1), a copy says nothing, and the correction holds.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Repro stale copy')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Quay', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e0', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Before', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't0', worldId: id, eventId: 'e0', text: 'The tide was out.', wordCount: 4, updatedAt: now })
    await db.locationMarkers.add({ id: 'quay', worldId: id, mapLayerId: null, name: 'The Quay', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    for (const [cid, name] of [['anna', 'Anna Ferro'], ['bruno', 'Bruno Zen']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.items.add({ id: 'book', worldId: id, name: 'The Book', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function paste(page: Page, text: string) {
  await page.locator('.cm-content').evaluate((el, t) => {
    const data = new DataTransfer()
    data.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

/** Who holds the Book at each scene, as the app reads item custody (Part B1). */
const holders = async (page: Page) => Object.entries(await holdersByScene(page, 'book'))

test('a hand-off corrected at an earlier scene reaches the later records that only copied it (run 11, W-3)', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await book(page)
  const open = async () => {
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
  }
  await open()
  await page.locator('.cm-line', { hasText: 'The tide was out.' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await paste(page, [
    '## S1', '[#The Quay @@Anna Ferro @@Bruno Zen ^The Book:@Anna Ferro]', '', 'She had the book.', '',
    '## S2', '[#The Quay @@Anna Ferro @@Bruno Zen]', '', 'They walked on.',
  ].join('\n'))
  // Both recorded at S2, and Anna's record there holding a copy of the Book: hers by the hand-off at S1.
  await expect.poll(() => holders(page), { timeout: 30_000 }).toEqual([['Before', []], ['S1', ['anna']], ['S2', ['anna']]])

  // The writer corrects S1: the Book was Bruno's.
  const items = page.locator('.cm-line', { hasText: 'Items: ^The Book:@Anna Ferro' })
  await expect(items).toHaveCount(1, { timeout: 20_000 })
  await items.click()
  await page.keyboard.press('End')
  for (let i = 0; i < 'Anna Ferro'.length; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('Bruno Zen')
  await page.keyboard.press('Escape')
  // Leave the line, as a writer does, so it is applied.
  await page.locator('.cm-line', { hasText: 'They walked on.' }).first().click()

  // Bruno's from S1 on — at S2 too, where Anna's copy used to win.
  await expect.poll(() => holders(page), { timeout: 30_000 }).toEqual([['Before', []], ['S1', ['bruno']], ['S2', ['bruno']]])
  await page.reload({ waitUntil: 'load' })
  await open()
  await expect.poll(() => holders(page)).toEqual([['Before', []], ['S1', ['bruno']], ['S2', ['bruno']]])
})
