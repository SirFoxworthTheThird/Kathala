import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The Timeline is one page.
 *
 * It was two screens — a list of chapters and scenes, and a chapter's own page
 * with a second list of the same chapters down its side — then one frame around
 * those two, and now one page: the book, open at a chapter or not. Opening a
 * chapter opens its row in place and puts the chapter's panel beside the list,
 * or under the row where there is no room beside it. What only a browser can
 * say is that it really is one page — nothing remounts, the chapter before
 * folds away — and that the panel lands where it is meant to at each width.
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
const panel = (page: Page, n: number) => page.getByRole('region', { name: `Chapter ${n}` })
/** A chapter's row in the list, by the id the page gives it to scroll to. */
const row = (page: Page, id: string) => page.locator(`#chapter-row-${id}`)
/** The row's own disclosure — named after the chapter, so it is the row's. */
const rowToggle = (page: Page, id: string, n: number) =>
  row(page, id).getByRole('button', { name: new RegExp(`^Ch\\. ${n} —`) })

test.describe('the Timeline is one page', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a chapter opens in the book, with its panel beside it, and closes again', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await expect(tree(page)).toBeVisible({ timeout: 20_000 })
    await expect(wholeBook(page)).toHaveAttribute('aria-current', 'page')
    await expect(panel(page, 2)).toHaveCount(0)

    await tree(page).getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(page).toHaveURL(/\/manuscript\/a2$/)
    // The same list, still there — chapter 1's row is on the page — with
    // chapter 2 open in it and its panel beside it.
    await expect(row(page, 'a1')).toBeVisible()
    await expect(row(page, 'a2')).toHaveAttribute('aria-current', 'page')
    await expect(rowToggle(page, 'a2', 2)).toHaveAttribute('aria-expanded', 'true')
    await expect(panel(page, 2).getByRole('textbox', { name: 'Chapter title' })).toHaveValue('The Stair')
    await expect(wholeBook(page)).not.toHaveAttribute('aria-current', 'page')

    // The panel's ✕ closes it: no panel, and the row folds back.
    await panel(page, 2).getByRole('button', { name: 'Close the chapter' }).click()
    await expect(page).toHaveURL(/\/manuscript$/)
    await expect(panel(page, 2)).toHaveCount(0)
    await expect(rowToggle(page, 'a2', 2)).toHaveAttribute('aria-expanded', 'false')
    await expect(wholeBook(page)).toHaveAttribute('aria-current', 'page')
  })

  test('opening another chapter folds the one before', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/a1`, { waitUntil: 'load' })
    await settle(page)
    await expect(rowToggle(page, 'a1', 1)).toHaveAttribute('aria-expanded', 'true', { timeout: 20_000 })

    await tree(page).getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(rowToggle(page, 'a2', 2)).toHaveAttribute('aria-expanded', 'true')
    await expect(rowToggle(page, 'a1', 1)).toHaveAttribute('aria-expanded', 'false')
    await expect(panel(page, 1)).toHaveCount(0)
    await expect(panel(page, 2)).toBeVisible()
  })

  test('it is one page: opening a chapter keeps the order you chose', async ({ page }) => {
    /*
      While a chapter was a page of its own, going to one and back remounted the
      whole book, and everything chosen on it — the order, a filter — went back
      to its default. Chronological is the one to test with because it is not
      by chapter, and the open chapter's panel still has to find a place in it.
    */
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    const chronological = page.getByRole('group', { name: 'Timeline order' }).getByRole('button', { name: /Chronological/ })
    await chronological.click()
    await expect(chronological).toHaveAttribute('aria-pressed', 'true')

    await tree(page).getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(page).toHaveURL(/\/manuscript\/a2$/)
    await expect(panel(page, 2)).toBeVisible()
    await expect(chronological).toHaveAttribute('aria-pressed', 'true')

    await wholeBook(page).click()
    await expect(panel(page, 2)).toHaveCount(0)
    await expect(chronological).toHaveAttribute('aria-pressed', 'true')
  })

  test('the timeline you were in is still selected when you come back', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)

    // The first timeline by default: the absence of the second in the binder.
    await expect(tree(page).getByRole('treeitem', { name: /Low Water/ })).toBeVisible({ timeout: 20_000 })
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toHaveCount(0)

    await page.getByRole('tab', { name: /The Harbour/ }).click()
    // The binder follows the tab, and says which timeline it is listing.
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Binder' }).getByText('The Harbour')).toBeVisible()

    await tree(page).getByRole('treeitem', { name: /The Pilot Boat/ }).click()
    await expect(page).toHaveURL(/\/manuscript\/b1$/)
    await wholeBook(page).click()
    await expect(page.getByRole('tab', { name: /The Harbour/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('arriving at another timeline’s chapter makes it the timeline you are in', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/b1`, { waitUntil: 'load' })
    await settle(page)
    await expect(tree(page).getByRole('treeitem', { name: /The Pilot Boat/ })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('tab', { name: /The Harbour/ })).toHaveAttribute('aria-selected', 'true')

    await wholeBook(page).click()
    await expect(page.getByRole('tab', { name: /The Harbour/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: /The Assize/ })).toHaveAttribute('aria-selected', 'false')
  })

  test('opening a chapter far down a long book brings it to the top', async ({ page }) => {
    const worldId = await twoTimelines(page)
    // Thirty chapters, so the list scrolls.
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      for (let n = 3; n <= 30; n++) {
        await db.chapters.add({ id: `a${n}`, worldId: id, timelineId: 'tA', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      }
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await expect(row(page, 'a30')).toHaveCount(1, { timeout: 20_000 })
    await expect(row(page, 'a30')).not.toBeInViewport()
    await expect(row(page, 'a1')).toBeInViewport()

    await tree(page).getByRole('treeitem', { name: /^Ch\. 28/ }).click()
    await expect(row(page, 'a28')).toBeInViewport()
    await expect(row(page, 'a1')).not.toBeInViewport()
  })
})

test.describe('the one page while reading', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a chapter the reader has not reached opens to say so, and shows nothing of itself', async ({ page }) => {
    const worldId = await twoTimelines(page)
    // As the writer, arriving at chapter 1 puts the cursor there; reading mode
    // then takes it as the reader's place.
    await page.goto(`/#/worlds/${worldId}/manuscript/a1`, { waitUntil: 'load' })
    await settle(page)
    await expect.poll(() => page.evaluate(() =>
      JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null,
    ), { timeout: 15_000 }).toBe('e1')
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await expect(page.getByRole('button', { name: 'Turn off reading mode' })).toBeVisible()

    // Presence: a reached chapter's panel, in full, as reading rather than fields.
    await page.goto(`/#/worlds/${worldId}/manuscript/a1`, { waitUntil: 'load' })
    await settle(page)
    await expect(panel(page, 1).getByText('Character States')).toBeVisible({ timeout: 20_000 })
    await expect(panel(page, 1).getByRole('textbox', { name: 'Chapter title' })).toHaveCount(0)

    // Absence: one the reader has not got to says so, and nothing more.
    await page.goto(`/#/worlds/${worldId}/manuscript/a2`, { waitUntil: 'load' })
    await settle(page)
    await expect(panel(page, 2).getByText('You have not reached this chapter yet')).toBeVisible({ timeout: 20_000 })
    await expect(panel(page, 2).getByText('Character States')).toHaveCount(0)
    await expect(page.getByRole('main').getByText('What the stair kept')).toHaveCount(0)
  })
})

test.describe('the one page on a phone', () => {
  test.describe.configure({ timeout: 240_000 })
  test.use({ viewport: { width: 390, height: 800 } })

  test('the panel sits under the open chapter’s row, and there is no binder', async ({ page }) => {
    const worldId = await twoTimelines(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/a1`, { waitUntil: 'load' })
    await settle(page)

    await expect(panel(page, 1)).toBeVisible({ timeout: 20_000 })
    // Under the row, and above the next chapter's.
    const [r1, p1, r2] = await Promise.all([
      row(page, 'a1').boundingBox(), panel(page, 1).boundingBox(), row(page, 'a2').boundingBox(),
    ])
    expect(p1!.y).toBeGreaterThan(r1!.y + r1!.height - 1)
    expect(r2!.y).toBeGreaterThan(p1!.y + p1!.height - 1)
    // One copy of it in the page, not a second one hidden for the wide layout.
    // Counted in the DOM: a role lookup skips a display:none copy, and would
    // pass with one there — which is exactly the copy a text lookup trips on.
    await expect(page.locator('section[aria-label="Chapter 1"]')).toHaveCount(1)

    // No column and no drawer: the list is the way round.
    await expect(tree(page)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Binder' })).toHaveCount(0)
  })
})
