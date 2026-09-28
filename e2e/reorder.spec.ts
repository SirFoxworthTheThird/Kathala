import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Moving chapters and scenes in the binder, and making a scene from the list.
 *
 * Driven in a browser because every claim here is about keys, focus and drag.
 * What a move writes — which numbers change, that snapshots follow, that one
 * undo reverses it — is `reorder.test.ts`; where a drop lands is `binder.test.ts`.
 */
async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, t] of [['c1', 1, 'Low Water'], ['c2', 2, 'The Stair'], ['c3', 4, 'The Verdict']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [['e1', 'c1', 'The assize rises'], ['e2', 'c1', 'Teodora at the table'], ['e3', 'c2', 'What the stair kept']] as const
    let i = 0
    for (const [eid, cid, title] of scenes) {
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: ++i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, worldId)
  return worldId
}

async function open(page: Page, worldId: string, chapterId = 'c1') {
  await page.goto(`/#/worlds/${worldId}/timeline/${chapterId}`, { waitUntil: 'load' })
  await settle(page)
  const tree = page.getByRole('tree', { name: 'Chapters and scenes' })
  await expect(tree).toBeVisible({ timeout: 20_000 })
  return tree
}

/** The book as stored: "1 Low Water: a, b | 2 The Stair: c". */
const stored = (page: Page) => page.evaluate(async () => {
  type Row = { id: string; title: string; number: number; chapterId: string; sortOrder: number }
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { chapters: { toArray: () => Promise<Row[]> }; events: { toArray: () => Promise<Row[]> } }
  const chapters = (await db.chapters.toArray()).sort((a, b) => a.number - b.number)
  const events = await db.events.toArray()
  return chapters.map((c) => {
    const own = events.filter((e) => e.chapterId === c.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((e) => e.title)
    return `${c.number} ${c.title}: ${own.join(', ')}`
  }).join(' | ')
})

test.describe('moving in the binder', () => {
  test.describe.configure({ timeout: 240_000 })

  test('Alt+↓ moves a chapter, and it keeps the focus for the next press', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)
    const chapter = tree.getByRole('treeitem', { name: /^Ch\. 1 · Low Water/ })
    await chapter.focus()

    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => stored(page)).toBe(
      '1 The Stair: What the stair kept | 2 Low Water: The assize rises, Teodora at the table | 4 The Verdict: ')
    // Still on it — the second press moves the same chapter again.
    await expect(tree.getByRole('treeitem', { name: /Low Water/ })).toBeFocused()
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => stored(page)).toBe(
      '1 The Stair: What the stair kept | 2 The Verdict:  | 4 Low Water: The assize rises, Teodora at the table')
  })

  test('Alt+↓ moves a scene, across into the next chapter at the edge', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)
    await tree.getByRole('treeitem', { name: 'The assize rises' }).focus()

    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => stored(page)).toContain('1 Low Water: Teodora at the table, The assize rises |')
    await expect(tree.getByRole('treeitem', { name: 'The assize rises' })).toBeFocused()

    // Into chapter 2, which is closed in the binder: it opens, and the row still has the focus…
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 2/ })).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => stored(page)).toContain('2 The Stair: The assize rises, What the stair kept')
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 2/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(tree.getByRole('treeitem', { name: 'The assize rises' })).toBeFocused()
    // …so the next press moves it on.
    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(() => stored(page)).toContain('2 The Stair: What the stair kept, The assize rises')
  })

  test('dragging a chapter puts it before the one it is dropped on', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)
    const verdict = tree.getByRole('treeitem', { name: /^Ch\. 4 · The Verdict/ })
    const low = tree.getByRole('treeitem', { name: /^Ch\. 1 · Low Water/ })
    // The top of the row: before it.
    await verdict.dragTo(low, { targetPosition: { x: 20, y: 3 } })
    await expect.poll(() => stored(page)).toBe(
      '1 The Verdict:  | 2 Low Water: The assize rises, Teodora at the table | 4 The Stair: What the stair kept')
  })

  test('dragging a scene onto another chapter moves it there, and between scenes places it', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)
    // Onto chapter 2's row: into it, at the end.
    await tree.getByRole('treeitem', { name: 'The assize rises' })
      .dragTo(tree.getByRole('treeitem', { name: /^Ch\. 2 · The Stair/ }))
    await expect.poll(() => stored(page)).toContain('2 The Stair: What the stair kept, The assize rises')

    // Its chapter opened to take it; into the lower half of the scene above it: after that one.
    const moved = tree.getByRole('treeitem', { name: 'The assize rises' })
    await expect(moved).toBeVisible()
    await tree.getByRole('treeitem', { name: 'Teodora at the table' })
      .dragTo(tree.getByRole('treeitem', { name: 'What the stair kept' }), { targetPosition: { x: 40, y: 24 } })
    await expect.poll(() => stored(page)).toContain('2 The Stair: What the stair kept, Teodora at the table, The assize rises')
  })
})

test.describe('moving while reading', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a reader can neither drag nor Alt-move a row', async ({ page }) => {
    const worldId = await book(page)
    // Presence first: a writer's rows can be dragged.
    let tree = await open(page, worldId)
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 1/ })).toHaveAttribute('draggable', 'true')
    const before = await stored(page)

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn on reading mode' }).click()
    await expect(page.getByRole('button', { name: 'Turn off reading mode' })).toBeVisible()

    tree = await open(page, worldId)
    const chapter = tree.getByRole('treeitem', { name: /^Ch\. 1/ })
    await expect(chapter).toHaveAttribute('draggable', 'false')
    await chapter.focus()
    await page.keyboard.press('Alt+ArrowDown')
    // Nothing to wait for but time: a move would have landed well inside it.
    await page.waitForTimeout(1_000)
    expect(await stored(page)).toBe(before)
  })
})

test.describe('adding a scene from the list', () => {
  test.describe.configure({ timeout: 240_000 })

  const main = (page: Page) => page.getByRole('main')
  const title = (page: Page) => page.getByRole('textbox', { name: 'Title for the new scene' })
  const focused = (page: Page) => page.evaluate(() => {
    const el = document.activeElement as HTMLTextAreaElement | null
    return el && 'value' in el ? { label: el.getAttribute('aria-label'), value: el.value } : null
  })

  test('Add Scene is a title line: Enter makes the scene at the end and puts you in its draft', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId)
    await main(page).getByRole('button', { name: 'Add Scene', exact: true }).click()
    // No dialog: a line in the list.
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(title(page)).toBeFocused()
    await title(page).fill('The clerk’s ledger')
    await page.keyboard.press('Enter')

    await expect.poll(() => stored(page)).toContain('1 Low Water: The assize rises, Teodora at the table, The clerk’s ledger |')
    await expect.poll(() => focused(page)).toEqual({ label: 'Scene prose', value: '' })
  })

  test('Escape makes nothing; its Add Scene button makes it from the keyboard too', async ({ page }) => {
    const worldId = await book(page)
    await open(page, worldId)
    const before = await stored(page)

    await main(page).getByRole('button', { name: 'Add Scene', exact: true }).click()
    await title(page).fill('Not this one')
    await page.keyboard.press('Escape')
    await expect(title(page)).toHaveCount(0)
    expect(await stored(page)).toBe(before)

    // Tab from the title to its own button must not make it on the way.
    await main(page).getByRole('button', { name: 'Add Scene', exact: true }).click()
    await title(page).fill('The tide-table')
    await page.keyboard.press('Tab')
    await expect(title(page)).toBeVisible()
    expect(await stored(page)).toBe(before)
    await page.keyboard.press('Enter')
    await expect.poll(() => stored(page)).toContain('Teodora at the table, The tide-table |')
  })
})
