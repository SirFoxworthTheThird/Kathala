import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The smaller things writer run 7 found, where they are on screen:
 *
 * - W7-2: an epithet, "the Snow Girl", was not found from the word typed.
 * - W7-8: the guide said to mark where a thread ends on its row, and the row
 *   had no way to.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Black Lamb')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await db.chapters.add({ id: `c${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e${n}`, worldId: id, chapterId: `c${n}`, timelineId: 'tl', title: `Scene ${n}`, description: '', sortOrder: 1,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: n <= 2 ? ['brother'] : [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${n}`, worldId: id, eventId: `e${n}`, text: `Snow fell ${n}.`, wordCount: 3, updatedAt: now })
    }
    await db.plotThreads.add({ id: 'brother', worldId: id, name: 'The Lost Brother', color: '#ef4444', description: '', createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'bethan', worldId: id, name: 'Bethan Reddick', description: '', aliases: ['the Snow Girl'], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

test.describe('the smaller findings of writer run 7', () => {
  test.describe.configure({ timeout: 150_000 })

  test('W7-8: a thread is marked resolved at its last scene from its own row, and reopened from there', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    const section = page.getByRole('heading', { name: 'Plot Threads', exact: true }).locator('xpath=../..')
    // Its last beat is Ch. 2 of 6: dangling, and offered its landing.
    await expect(section.getByText(/dangling/)).toBeVisible({ timeout: 20_000 })
    await section.getByRole('button', { name: 'Mark The Lost Brother resolved at Ch. 2, “Scene 2”', exact: true }).click()
    await expect(section.getByText('resolves Ch. 2')).toBeVisible()
    await expect(section.getByText(/dangling/)).toHaveCount(0)
    expect(await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { plotThreads: { get: (id: string) => Promise<{ resolvedEventId?: string | null }> } }
      return (await db.plotThreads.get('brother')).resolvedEventId
    })).toBe('e2')
    await section.getByRole('button', { name: 'reopen' }).click()
    await expect(section.getByText(/dangling/)).toBeVisible()
  })

  test('W7-2: @Snow on the Page finds the Snow Girl, and puts in what was not already written', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'Snow fell 1.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' They found the @Snow')
    await page.getByRole('button', { name: 'Bethan Reddick character', exact: true }).click()
    await expect(page.locator('.cm-line', { hasText: 'Snow fell 1.' }).first()).toContainText('They found the Snow Girl')
    // And nobody new by that name was offered or made.
    expect(await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { characters: { count: () => Promise<number> } }
      return db.characters.count()
    })).toBe(1)
  })
})
