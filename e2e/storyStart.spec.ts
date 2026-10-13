import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Where a one-timeline book's clock starts (writer run 8). The writer pinned
 * the first scene to 1 November 2011 and every later scene still counted from
 * 1 January; and the setting that moves a timeline's start was shown only to
 * books with several timelines, as a day number.
 */

const MONTHS = [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]] as const

type Scene = { id: string; title: string; travelDays?: number; inWorldTime?: number; isFlashback?: boolean }

async function book(page: Page, scenes: Scene[]): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, scenes, months }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.worlds.update(id, { calendar: { startYear: 2011, yearSuffix: '', months: months.map(([name, days]) => ({ name, days })) } })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    let i = 0
    for (const s of scenes) {
      await db.events.add({
        id: s.id, worldId: id, chapterId: 'c1', timelineId: 'tl', title: s.title, description: '', sortOrder: i++,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: s.travelDays ?? null, inWorldTime: s.inWorldTime ?? null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: s.isFlashback ?? false, createdAt: now, updatedAt: now,
      })
    }
  }, { id: worldId, scenes, months: MONTHS })
  return worldId
}

async function cards(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
  await settle(page)
  return page.getByRole('main')
}

test.describe('when the story begins', () => {
  test.describe.configure({ timeout: 150_000 })

  test('a one-timeline book is given a start date in settings, and its scenes count on from it', async ({ page }) => {
    const worldId = await book(page, [{ id: 'e1', title: 'Arrival' }, { id: 'e2', title: 'The archive', travelDays: 2 }])

    // Before: two days after 1 January.
    let main = await cards(page, worldId)
    await expect(main.getByText('3 January, 2011', { exact: true })).toBeVisible({ timeout: 20_000 })

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('heading', { name: 'When the story begins' })).toBeVisible({ timeout: 20_000 })
    const main1 = page.getByRole('group', { name: 'Main', exact: true })
    await main1.getByLabel('Month').selectOption({ label: 'November' })
    await main1.getByLabel('Day', { exact: true }).fill('1')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { timelines: { get: (id: string) => Promise<{ dayOffset: number }> } }
      return (await db.timelines.get('tl')).dayOffset
    })).toBe(304)

    main = await cards(page, worldId)
    await expect(main.getByText('3 November, 2011', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('3 January, 2011', { exact: true })).toHaveCount(0)
  })

  test('a scene pinned to a date sets the clock for the scenes after it; a flashback’s pin does not', async ({ page }) => {
    const worldId = await book(page, [
      { id: 'e1', title: 'Arrival', inWorldTime: 304 },
      { id: 'e2', title: 'The archive', travelDays: 2 },
      { id: 'e3', title: 'The summer of 1985', isFlashback: true, inWorldTime: 10 },
      { id: 'e4', title: 'The tide clock', travelDays: 1 },
    ])
    const main = await cards(page, worldId)
    await expect(main.getByText('1 November, 2011', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('3 November, 2011', { exact: true })).toBeVisible()
    await expect(main.getByText('4 November, 2011', { exact: true })).toBeVisible()
    // The derived clock from 1 January, as it was before.
    await expect(main.getByText('3 January, 2011', { exact: true })).toHaveCount(0)
  })
})
