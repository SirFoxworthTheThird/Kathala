import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The Manuscript's Read layout, and the book's tools: export, find & replace,
 * and word goals.
 *
 * What the reading page does while being read — restoring the reader's spot,
 * the drift undo, the X-ray — has specs of its own. Here is that the screen
 * offers it to the right people, wires it to the reader's place, and carries
 * the author's tools.
 */

async function book(page: Page, opts: { readingMode?: boolean; prose?: boolean } = {}): Promise<string> {
  const { readingMode = false, prose = true } = opts
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, reading, withProse]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; update: (k: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'High Water']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'The assize rises', 'The court sat and the water fell.'],
      ['e2', 'c1', 'Teodora at the table', 'She counted the tide-tables twice.'],
      ['e3', 'c2', 'The tide-table', 'And the heron flew east at dawn.'],
    ] as const
    let i = 0
    for (const [eid, cid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      if (withProse) await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: text.split(' ').length, updatedAt: now })
    }
    if (reading) await db.worlds.update(id, { readingMode: true })
  }, [worldId, readingMode, prose] as const)
  return worldId
}

const layout = (page: Page) => page.getByRole('group', { name: 'Layout', exact: true })
const choose = (page: Page, name: 'Cards' | 'Page' | 'Read') => layout(page).getByRole('button', { name, exact: true }).click()
const header = (page: Page) => page.getByRole('main')

async function openManuscript(page: Page, worldId: string, chapter = '') {
  // On Cards, asked for: a writer's Manuscript opens on the Page, and these start from Cards.
  await page.goto(`/#/worlds/${worldId}/manuscript${chapter ? `/${chapter}` : ''}?view=cards`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('main').getByRole('button', { name: /Low Water/ }).first()).toBeVisible({ timeout: 20_000 })
}

const cursor = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('kathala-ui')
  return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
})

test.describe('the Manuscript’s Read layout', () => {
  test.describe.configure({ timeout: 180_000 })

  test('shows the book set for reading, with the author’s tools that Cards does not carry', async ({ page }) => {
    const worldId = await book(page)
    await openManuscript(page, worldId)
    // Cards: the book's tools are not here.
    await expect(header(page).getByRole('button', { name: 'Export', exact: true })).toHaveCount(0)
    await expect(header(page).getByLabel('Word goal for the book')).toHaveCount(0)

    await choose(page, 'Read')
    const scroller = page.locator('[data-book-scroller]')
    await expect(scroller.getByRole('heading', { name: 'Ch. 1 — Low Water' })).toBeVisible()
    await expect(scroller.getByText('She counted the tide-tables twice.')).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Export', exact: true })).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Find & replace' })).toBeVisible()

    // And on Page, where the book is being written.
    await choose(page, 'Page')
    await expect(header(page).getByRole('button', { name: 'Export', exact: true })).toBeVisible()
  })

  test('exports from the Manuscript', async ({ page }) => {
    const worldId = await book(page)
    await openManuscript(page, worldId)
    await choose(page, 'Read')
    await header(page).getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('3')
  })

  test('the book’s word goal is the Manuscript’s, and shows how far there is to go', async ({ page }) => {
    const worldId = await book(page)
    await openManuscript(page, worldId)
    await choose(page, 'Read')
    const goal = header(page).getByLabel('Word goal for the book')
    await goal.fill('100')
    // 19 words of 100: seven, five and seven.
    await expect(header(page).getByText('19%')).toBeVisible()
    // Kept on the world: it is there after a reload.
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByLabel('Word goal for the book')).toHaveValue('100', { timeout: 20_000 })
  })

  test('the open chapter’s panel carries its word goal, and it is saved on the chapter', async ({ page }) => {
    const worldId = await book(page)
    await openManuscript(page, worldId, 'c1')
    const panel = page.getByRole('region', { name: 'Chapter 1' })
    const goal = panel.getByLabel('Word goal for this chapter')
    await goal.fill('500')
    await goal.press('Enter')
    await expect.poll(() => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { get: (k: string) => Promise<{ wordGoal: number | null }> } }
      return (await db.chapters.get('c1')).wordGoal
    }), { timeout: 10_000 }).toBe(500)
  })

  test('the binder takes the book to a scene', async ({ page }) => {
    const worldId = await book(page)
    await page.setViewportSize({ width: 1280, height: 420 })
    await openManuscript(page, worldId, 'c2')
    await choose(page, 'Read')
    const line = page.locator('[data-book-scroller]').getByText('And the heron flew east at dawn.')
    const top = async () => {
      const [l, s] = await Promise.all([line.boundingBox(), page.locator('[data-book-scroller]').boundingBox()])
      return l!.y - s!.y
    }
    await page.getByRole('tree', { name: 'Chapters and scenes' }).getByRole('treeitem', { name: 'The tide-table' }).click()
    await expect.poll(top, { timeout: 10_000 }).toBeLessThan(120)
  })

  test('a reader is offered Cards and Read, not Page or the author’s tools — and reading moves their place', async ({ page }) => {
    await resetDB(page)
    await downloadLibraryBook(page, 'Dracula')
    await settle(page)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await expect(layout(page).getByRole('button', { name: 'Read', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(layout(page).getByRole('button', { name: 'Page', exact: true })).toHaveCount(0)

    await choose(page, 'Read')
    const scroller = page.locator('[data-book-scroller]')
    await expect(scroller).toBeVisible()
    await expect(header(page).getByRole('button', { name: 'Export', exact: true })).toHaveCount(0)
    await expect(header(page).getByLabel('Word goal for the book')).toHaveCount(0)

    const opened = await cursor(page)
    expect(opened).toBeTruthy()
    await scroller.evaluate((el) => { el.scrollTop = 12000 })
    await expect.poll(() => cursor(page), { timeout: 15_000 }).not.toBe(opened)
  })

  test('a reader is not offered a book that has no prose', async ({ page }) => {
    const withProse = await book(page, { readingMode: true })
    // Opened to be read, as a reader who has not chosen a layout is.
    await page.goto(`/#/worlds/${withProse}/manuscript`, { waitUntil: 'load' })
    await expect(layout(page).getByRole('button', { name: 'Read', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-book-scroller]')).toBeVisible()

    const without = await book(page, { readingMode: true, prose: false })
    await openManuscript(page, without)
    await expect(layout(page)).toHaveCount(0)
  })
})
