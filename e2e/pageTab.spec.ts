import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Tab on the Page (writer run 11, W-4). Pressed to indent a paragraph, it left
 * the page for the chapter panel's title, selected, and the next sentence
 * became the chapter's name. It stays in the page now, and Escape, then Tab,
 * is the way out.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Arrival', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text: 'The road ran out at the shore.', wordCount: 7, updatedAt: now })
  }, worldId)
  return worldId
}

const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, unknown>>> }>
  return { chapter: (await db.chapters.toArray())[0]?.title, text: (await db.sceneTexts.toArray())[0]?.text }
})

const inPage = (page: Page) => page.evaluate(() => !!document.activeElement?.closest('.cm-content'))

test.describe('Tab on the Page', () => {
  test.describe.configure({ timeout: 120_000 })

  test('stays in the page, with the chapter panel beside it, and Escape then Tab leaves it', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    // The panel the Tab used to land in is there, with its title.
    const title = page.getByRole('region', { name: 'Chapter 1' }).getByRole('textbox', { name: 'Chapter title' })
    await expect(title).toHaveValue('The Causeway')

    await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    expect(await inPage(page)).toBe(true)
    await expect(page.getByText(/Tab stays in the page/)).toBeVisible()
    await page.keyboard.press('Shift+Tab')
    expect(await inPage(page)).toBe(true)
    await page.keyboard.type('It was a dark night.')

    await expect.poll(() => stored(page), { timeout: 10_000 }).toEqual({ chapter: 'The Causeway', text: 'The road ran out at the shore.\n\nIt was a dark night.' })
    await expect(title).toHaveValue('The Causeway')
    // Typing on says nothing more about it.
    await expect(page.getByText(/Tab stays in the page/)).toHaveCount(0)

    // The way out, as said: Escape, then Tab.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Tab')
    expect(await inPage(page)).toBe(false)
  })
})
