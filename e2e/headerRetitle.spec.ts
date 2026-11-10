import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A header line being typed survives the page catching up with a chapter
 * retitled a moment before (round-trip-plan-2.md, T7.3; writer run
 * 2026-11-10, N1). The writer retitled a chapter, typed a name into a scene's
 * Characters line, and about a second later — as the title saved — the line
 * went back to the records' and the name was gone, three times in three.
 *
 * The header's picker and note on the Page, as writer run 4 found them:
 *
 * - W-4: the Characters line offered a new *item* and a new *place*, and a
 *   second "Tobias" under the person already called Tobias.
 * - W-5: after "Create … as a place" the note went on saying nothing was
 *   called that.
 * - W-7: of three people a header made, only the last was asked for their
 *   other names.
 * - W-8: a click at the end of a name already written opened the picker, so
 *   the Enter meant for a new line completed the name instead.
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
    // Scene 2 has a cast, so a header block with a Characters line.
    await (db.events as unknown as { update: (k: string, v: unknown) => Promise<unknown> }).update('e2', { involvedCharacterIds: ['teo'] })
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

const cast = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ involvedCharacterIds: string[] }> } }
  return (await db.events.get('e2')).involvedCharacterIds.slice().sort()
})
const chapterTitle = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { get: (id: string) => Promise<{ title: string }> } }
  return (await db.chapters.get('c1')).title
})

test('a name typed into a header line just after a chapter is retitled is still there once the title has saved, and is applied', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)
  const characters = page.locator('.cm-line', { hasText: 'Characters:' }).first()
  await expect(characters).toContainText('@@Teodora Vance')

  // The chapter retitled on the page…
  await page.locator('.cm-line', { hasText: 'Low Water' }).first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' at Quell')
  // …and at once, before it has saved, a name typed on the scene's Characters line.
  await characters.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' @@The Foundling')
  await page.keyboard.press('Escape')
  // The title saves, and the page catches up with it.
  await expect.poll(() => chapterTitle(page), { timeout: 10_000 }).toBe('Low Water at Quell')
  await page.waitForTimeout(1500)
  await expect(characters).toContainText('@@The Foundling')
  // Left, it is applied.
  await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
  await expect.poll(() => cast(page), { timeout: 10_000 }).toEqual(['fnd', 'teo'])
})

test('the control: the same typing with no retitle before it stays, and is applied', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)
  const characters = page.locator('.cm-line', { hasText: 'Characters:' }).first()
  await expect(characters).toContainText('@@Teodora Vance')
  await characters.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' @@The Foundling')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(2500)
  await expect(characters).toContainText('@@The Foundling')
  await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
  await expect.poll(() => cast(page), { timeout: 10_000 }).toEqual(['fnd', 'teo'])
})
