import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Verse in Read (writer run 8): a ballad's lines ran together, because a
 * single newline is a space in prose. Lines indented on every line are verse,
 * and keep their breaks; hard-wrapped prose beside them still flows.
 */
test('Read keeps an indented paragraph’s lines, and flows the prose beside it', async ({ page }) => {
  test.setTimeout(120_000)
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
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Bell', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'The song', description: '', sortOrder: 1,
      tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    const text = [
      'The tide turned, and she sang it the way\nher grandmother had.',
      "  There's a bell on the Scaur that was never hung,\n  and it rings with no rope and it rings with no _tongue_;",
    ].join('\n\n')
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text, wordCount: 40, updatedAt: now })
  }, worldId)

  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Read', exact: true }).click()
  const main = page.getByRole('main')
  const verse = main.locator('p', { hasText: 'never hung' })
  const prose = main.locator('p', { hasText: 'The tide turned' })
  await expect(verse).toBeVisible({ timeout: 20_000 })

  // Two lines, as written, the emphasis kept; and the prose's single newline a space.
  expect(await verse.evaluate((el: HTMLElement) => el.innerText)).toBe("There's a bell on the Scaur that was never hung,\nand it rings with no rope and it rings with no tongue;")
  await expect(verse.locator('em')).toHaveText('tongue')
  expect(await prose.evaluate((el: HTMLElement) => el.innerText)).toBe('The tide turned, and she sang it the way her grandmother had.')
})
