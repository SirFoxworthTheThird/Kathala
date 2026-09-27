import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Timeline is one screen.
 *
 * It was two: a list of chapters and scenes, and a chapter's own page, which
 * had grown a second list of the same chapters down its side. Now the binder is
 * the frame, and the right-hand side is the whole book or one chapter. What only
 * a browser can say is that the frame really stays put while the right side
 * changes — and that a phone, with no room for a column, still has a way round.
 */
async function twoTimelines(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tA', worldId: id, name: 'The Assize', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tB', worldId: id, name: 'The Harbour', description: '', color: '#34d399', dayOffset: 0, createdAt: now + 1, updatedAt: now + 1 })
    const chapters = [['a1', 'tA', 1, 'Low Water'], ['a2', 'tA', 2, 'The Stair'], ['b1', 'tB', 1, 'The Pilot Boat']] as const
    for (const [cid, tl, n, t] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number: n, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [['e1', 'a1', 'tA', 'The assize rises'], ['e2', 'a2', 'tA', 'What the stair kept'], ['e3', 'b1', 'tB', 'Fog on the bar']] as const
    let i = 0
    for (const [eid, cid, tl, title] of scenes) {
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: tl, title, description: '', sortOrder: ++i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, worldId)
  return worldId
}

const tree = (page: Page) => page.getByRole('tree', { name: 'Chapters and scenes' })
const wholeBook = (page: Page) => page.getByRole('button', { name: 'Whole book' })

test.describe('the Timeline is one screen', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the binder frames the whole book and a chapter alike, and goes between them', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)

    // The whole book, with the binder beside it saying so.
    await expect(tree(page)).toBeVisible({ timeout: 20_000 })
    await expect(wholeBook(page)).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('main').getByRole('button', { name: 'Add Chapter' }).first()).toBeVisible()

    // Into a chapter from the binder: the right side changes, the binder does not.
    await tree(page).getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(page).toHaveURL(/\/timeline\/a2$/)
    await expect(tree(page)).toBeVisible()
    await expect(wholeBook(page)).not.toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first()).toBeVisible()

    // And back.
    await wholeBook(page).click()
    await expect(page).toHaveURL(/\/timeline$/)
    await expect(wholeBook(page)).toHaveAttribute('aria-current', 'page')
  })

  test('the timeline you were in is still selected when you come back', async ({ page }) => {
    /*
      The whole book's timeline tab lives in the frame, which outlives both
      pages. Were it the whole-book page's own, visiting a chapter and coming
      back would reset it to the first timeline.
    */
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)

    // The first timeline by default: the absence of the second in the binder.
    await expect(tree(page).getByRole('treeitem', { name: /Low Water/ })).toBeVisible({ timeout: 20_000 })
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toHaveCount(0)

    await page.getByRole('tab', { name: /The Harbour/ }).click()
    // The binder follows the tab, and says which timeline it is listing.
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Binder' }).getByText('The Harbour')).toBeVisible()

    await tree(page).getByRole('treeitem', { name: /The Pilot Boat/ }).click()
    await expect(page).toHaveURL(/\/timeline\/b1$/)
    await wholeBook(page).click()
    await expect(page.getByRole('tab', { name: /The Harbour/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('arriving at another timeline’s chapter makes it the timeline you come back to', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/timeline/b1`, { waitUntil: 'load' })
    await settle(page)
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toBeVisible({ timeout: 20_000 })

    await wholeBook(page).click()
    await expect(page.getByRole('tab', { name: /The Harbour/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /The Assize/ })).toHaveAttribute('aria-selected', 'false')
  })
})

test.describe('the one screen on a phone', () => {
  test.describe.configure({ timeout: 240_000 })
  test.use({ viewport: { width: 390, height: 800 } })

  test('a chapter opens the binder as a drawer, which goes and closes', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/timeline/a1`, { waitUntil: 'load' })
    await settle(page)

    // No room for a column: the tree is not on the page until asked for.
    await expect(page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(tree(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Binder' }).click()
    const drawer = page.getByRole('dialog', { name: 'Chapters and scenes' })
    await expect(drawer.getByRole('tree', { name: 'Chapters and scenes' })).toBeVisible()

    await drawer.getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(page).toHaveURL(/\/timeline\/a2$/)
    await expect(drawer).toHaveCount(0)
  })

  test('the whole book needs no drawer — it is the way round', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('main').getByRole('button', { name: 'Add Chapter' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Binder' })).toHaveCount(0)
  })
})
