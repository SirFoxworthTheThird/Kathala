import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * On the Timeline, the last scene in a chapter had "Move later" permanently
 * disabled, and the first had "Move earlier" the same way. The only route
 * across a chapter boundary was dragging a card on the Corkboard — which has no
 * keyboard equivalent, and which nothing on the Timeline mentions.
 *
 * The arrow now uses the Corkboard's own mover, so the two routes cannot
 * disagree about what a cross-chapter move does to the snapshot sort keys.
 */

async function twoChaptersTwoScenes(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Boundary')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch2', worldId: id, timelineId: 'tl', number: 2, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'Setting out', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch1', title: 'The reed house', sortOrder: 1 })
    await db.events.add({ ...base, id: 'ev3', chapterId: 'ch2', title: 'The seal breaks', sortOrder: 0 })
  }, worldId)
  return worldId
}

const chapterOf = (page: Page, eventId: string) => page.evaluate(async (id: string) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { events: { get: (id: string) => Promise<{ chapterId: string } | undefined> } }
  return (await db.events.get(id))?.chapterId ?? null
}, eventId)

test.describe('a scene can leave its chapter without a mouse', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the last scene moves into the next chapter, and back', async ({ page }) => {
    const worldId = await twoChaptersTwoScenes(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    const main = page.getByRole('main')
    // The button says where it goes, rather than moving a scene silently.
    // (EventCard wraps the scene name in curly quotes, hence the `.` either side.)
    const down = main.getByRole('button', { name: /Move to the start of the next chapter: .The reed house./ })
    await expect(down).toBeEnabled()
    await down.click()

    await expect.poll(() => chapterOf(page, 'ev2'), { timeout: 15_000 }).toBe('ch2')

    // And back the other way, from the chapter it landed in.
    await page.goto(`/#/worlds/${worldId}/timeline/ch2`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    const up = page.getByRole('main')
      .getByRole('button', { name: /Move to the end of the previous chapter: .The reed house./ })
    await expect(up).toBeEnabled()
    await up.click()
    await expect.poll(() => chapterOf(page, 'ev2'), { timeout: 15_000 }).toBe('ch1')
  })

  test('but the ends of the book still have nowhere to go', async ({ page }) => {
    // The pair: the arrows are not simply always enabled now.
    const worldId = await twoChaptersTwoScenes(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    const main = page.getByRole('main')
    await expect(main.getByRole('button', { name: /^Move .Setting out. earlier$/ })).toBeDisabled()

    await page.goto(`/#/worlds/${worldId}/timeline/ch2`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)
    await expect(page.getByRole('main').getByRole('button', { name: /^Move .The seal breaks. later$/ })).toBeDisabled()
  })
})
