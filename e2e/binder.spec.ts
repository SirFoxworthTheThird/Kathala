import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The binder: the book's chapters and scenes as a tree beside the writing.
 *
 * Driven in a browser because every claim here is about focus, keys, scrolling
 * or navigation — the rules themselves are unit-tested in `binder.test.ts`, and
 * the positioned insert in `createEventAt.test.ts`. What only a browser can say
 * is whether the keystroke reaches the rule and the result reaches the screen.
 *
 * Chapter numbers are 1, 2 and **4** on purpose: one past the count would hand
 * a new chapter the number 4, which is taken. See the "New chapter" test.
 */
const SCENES: Array<[string, string, string]> = [
  ['e1', 'c1', 'The assize rises'],
  ['e2', 'c1', 'Teodora at the table'],
  ['e3', 'c1', 'The tide-table'],
  ['e4', 'c2', 'What the stair kept'],
  ['e5', 'c2', 'Juno on the eleventh step'],
  ['e6', 'c3', 'The court takes the tide'],
]

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, scenes }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, t] of [['c1', 1, 'Low Water'], ['c2', 2, 'The Stair'], ['c3', 4, 'The Verdict Waits']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title: t, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    let i = 0
    for (const [eid, cid, title] of scenes) {
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: ++i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, { id: worldId, scenes: SCENES })
  return worldId
}

async function open(page: Page, worldId: string, chapter = 'c1') {
  await page.goto(`/#/worlds/${worldId}/manuscript/${chapter}?view=cards`, { waitUntil: 'load' })
  await settle(page)
  const tree = page.getByRole('tree', { name: 'Chapters and scenes' })
  await expect(tree).toBeVisible({ timeout: 20_000 })
  return tree
}

/** Scene titles of a chapter, in the order the book has them. */
const order = (page: Page, chapterId: string) => page.evaluate(async (cid: string) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; title: string; sortOrder: number }>> } } }
  }
  const rows = await db.events.where('chapterId').equals(cid).toArray()
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map((e) => e.title)
}, chapterId)

/** The stored time cursor — what every per-moment panel reads. */
const cursor = (page: Page) => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null } catch { return null }
})

const prose = (page: Page) => page.getByRole('textbox', { name: 'Scene prose' })

test.describe('the binder', () => {
  test.describe.configure({ timeout: 240_000 })

  test('going to a scene opens it and moves the cursor there', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    // Nothing open yet — the absence the click has to change.
    await expect(prose(page)).toHaveCount(0)

    await tree.getByRole('treeitem', { name: 'The tide-table' }).click()

    await expect.poll(() => cursor(page), { timeout: 15_000 }).toBe('e3')
    // One card open, and it is this one, and it is on screen.
    await expect(prose(page)).toHaveCount(1)
    const card = page.getByRole('main').getByRole('button', { name: 'The tide-table', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
    await expect(card.getByRole('textbox', { name: 'Scene prose' })).toBeInViewport()
    await expect(tree.getByRole('treeitem', { name: 'The tide-table' })).toHaveAttribute('aria-current', 'true')
  })

  test('a scene in another chapter is arrived at, not the chapter’s first', async ({ page }) => {
    /*
      Arriving at a chapter keeps a cursor already inside it and otherwise falls
      back to the first scene. So if going to a scene in another chapter did not
      move the cursor, this would land on "What the stair kept" — the target is
      the chapter's second scene because that is where the two disagree.

      (My first note here claimed the cursor had to be set *before* navigating.
      A mutant swapping the two calls survived: both land before the next
      render, so their order cannot matter. The claim was withdrawn.)
    */
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await tree.getByRole('treeitem', { name: 'The assize rises' }).click()
    await page.keyboard.press('End')        // Ch. 4
    await page.keyboard.press('ArrowUp')    // Ch. 2
    await page.keyboard.press('ArrowRight') // open it
    await page.keyboard.press('ArrowDown')  // What the stair kept
    await page.keyboard.press('ArrowDown')  // Juno on the eleventh step
    await expect(tree.getByRole('treeitem', { name: 'Juno on the eleventh step' })).toBeFocused()
    await page.keyboard.press(' ')

    await expect(page).toHaveURL(/\/manuscript\/c2/)
    await expect.poll(() => cursor(page), { timeout: 15_000 }).toBe('e5')
    await expect(prose(page)).toHaveCount(1, { timeout: 15_000 })
  })

  test('Enter makes a scene on the line below, titled where it will sit', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await tree.getByRole('treeitem', { name: 'The assize rises' }).click()
    await page.keyboard.press('Enter')
    const title = page.getByRole('textbox', { name: 'New scene title' })
    await expect(title).toBeFocused()
    await title.fill('The clerk’s ledger')
    await page.keyboard.press('Enter')

    await expect.poll(() => order(page, 'c1'), { timeout: 15_000 })
      .toEqual(['The assize rises', 'The clerk’s ledger', 'Teodora at the table', 'The tide-table'])
    // The new scene is where you are, in the list and in the book.
    await expect(tree.getByRole('treeitem', { name: 'The clerk’s ledger' })).toBeFocused()
    const created = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { filter: (f: (e: { title: string }) => boolean) => { first: () => Promise<{ id: string } | undefined> } } }
      return (await db.events.filter((e) => e.title === 'The clerk’s ledger').first())?.id
    })
    await expect.poll(() => cursor(page)).toBe(created)
  })

  test('Enter straight after clicking the scene you are on still opens the title', async ({ page }) => {
    /*
      Clicking a row asked for it to be focused once the binder next rendered.
      The mousedown has already focused it, and on the scene the cursor is
      already on nothing else changes either — so no render came, and the
      request waited. The next render was Enter's: the title box took focus,
      the stale request took it back, and the blur cancelled the empty title.
      It showed as the test above failing about one run in four, whenever the
      navigation happened not to render in between.

      So here the click and the Enter are separated only by microtasks — as
      between two real events, where React flushes its urgent work — and not
      by a task, which is where the navigation renders.
    */
    const worldId = await book(page)
    const tree = await open(page, worldId)
    const row = tree.getByRole('treeitem', { name: 'The assize rises' })
    await row.click()
    await expect.poll(() => cursor(page)).toBe('e1')
    await expect(row).toBeFocused()

    await row.evaluate(async (el: HTMLElement) => {
      el.click()
      for (let i = 0; i < 5; i++) await Promise.resolve()
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })

    const title = page.getByRole('textbox', { name: 'New scene title' })
    await expect(title).toBeFocused()
    await title.fill('The clerk’s ledger')
    await page.keyboard.press('Enter')
    await expect.poll(() => order(page, 'c1'), { timeout: 15_000 })
      .toEqual(['The assize rises', 'The clerk’s ledger', 'Teodora at the table', 'The tide-table'])
  })

  test('Escape throws the title away, and gives focus back', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await tree.getByRole('treeitem', { name: 'Teodora at the table' }).click()
    await page.keyboard.press('Enter')
    await page.getByRole('textbox', { name: 'New scene title' }).fill('Not this one')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('textbox', { name: 'New scene title' })).toHaveCount(0)
    await expect(tree.getByRole('treeitem', { name: 'Teodora at the table' })).toBeFocused()
    expect(await order(page, 'c1')).toEqual(['The assize rises', 'Teodora at the table', 'The tide-table'])
  })

  test('Enter on a chapter gives it a first scene', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await tree.getByRole('treeitem', { name: /^Ch\. 2/ }).click()
    await expect(page).toHaveURL(/\/manuscript\/c2/)
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 2/ })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('textbox', { name: 'New scene title' }).fill('Before the stair')
    await page.keyboard.press('Enter')

    await expect.poll(() => order(page, 'c2'), { timeout: 15_000 })
      .toEqual(['Before the stair', 'What the stair kept', 'Juno on the eleventh step'])
  })

  test('a title finished by clicking away is kept, and the click keeps its focus', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await tree.getByRole('treeitem', { name: 'The tide-table' }).click()
    await page.getByRole('button', { name: 'New scene', exact: true }).click()
    await page.getByRole('textbox', { name: 'New scene title' }).fill('After the tide')
    const notes = page.getByPlaceholder(/Freeform notes for this chapter/)
    await notes.click()

    await expect.poll(() => order(page, 'c1'), { timeout: 15_000 })
      .toEqual(['The assize rises', 'Teodora at the table', 'The tide-table', 'After the tide'])
    // Where the writer clicked is where they are — not back in the binder.
    await expect(notes).toBeFocused()
    await expect.poll(() => cursor(page)).toBe('e3')
  })

  test('Delete removes a scene, says which, and Undo brings it back', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    // A chapter is not deleted by a key: the absence half, first.
    await tree.getByRole('treeitem', { name: /^Ch\. 1/ }).click()
    await page.keyboard.press('Delete')
    expect(await order(page, 'c1')).toEqual(['The assize rises', 'Teodora at the table', 'The tide-table'])

    await tree.getByRole('treeitem', { name: 'Teodora at the table' }).click()
    await page.keyboard.press('Delete')

    await expect.poll(() => order(page, 'c1'), { timeout: 15_000 })
      .toEqual(['The assize rises', 'The tide-table'])
    // Focus went to the next scene, not to the top of the page.
    await expect(tree.getByRole('treeitem', { name: 'The tide-table' })).toBeFocused()

    const toast = page.getByRole('status').filter({ hasText: /Deleted scene/ })
    await expect(toast).toContainText('Deleted scene “Teodora at the table”')
    await toast.getByRole('button', { name: 'Undo' }).click()
    await expect.poll(() => order(page, 'c1'), { timeout: 15_000 })
      .toEqual(['The assize rises', 'Teodora at the table', 'The tide-table'])
  })

  test('the arrows open and close a chapter', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    const scene = tree.getByRole('treeitem', { name: 'The assize rises' })
    await expect(scene).toBeVisible()
    await tree.getByRole('treeitem', { name: /^Ch\. 1/ }).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(scene).toHaveCount(0)
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 1/ })).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('ArrowRight')
    await expect(scene).toBeVisible()
  })

  test('New chapter goes at the end, one past the highest number', async ({ page }) => {
    /*
      The chapters are numbered 1, 2 and 4. One past the *count* is 4, which is
      in use; one past the highest is 5.
    */
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await page.getByRole('button', { name: 'New chapter', exact: true }).click()
    await page.getByRole('textbox', { name: 'New chapter title' }).fill('Sentence')
    await page.keyboard.press('Enter')

    await expect(tree.getByRole('treeitem', { name: /^Ch\. 5 · Sentence/ })).toBeFocused({ timeout: 15_000 })
    const numbers = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { chapters: { toArray: () => Promise<Array<{ number: number }>> } }
      return (await db.chapters.toArray()).map((c) => c.number).sort((a, b) => a - b)
    })
    expect(numbers).toEqual([1, 2, 4, 5])
  })

  test('New chapter takes a number, and says what a taken one moves', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)

    await page.getByRole('button', { name: 'New chapter', exact: true }).click()
    const number = page.getByRole('textbox', { name: 'New chapter number' })
    await expect(number).toHaveValue('5')
    await number.fill('1')
    await expect(page.locator('#binder-chapter-note')).toHaveText('Chapters 1–2 become 2–3.')

    // Moving between the two fields is not finishing: nothing is made yet.
    const title = page.getByRole('textbox', { name: 'New chapter title' })
    await title.fill('Before the Tide')
    await number.focus()
    await expect(title).toBeVisible()
    const count = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { chapters: { count: () => Promise<number> } }
      return db.chapters.count()
    })
    expect(await count()).toBe(3)

    await page.keyboard.press('Enter')
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 1 · Before the Tide/ })).toBeFocused({ timeout: 15_000 })
    const numbers = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { chapters: { toArray: () => Promise<Array<{ number: number; title: string }>> } }
      return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => `${c.number}:${c.title}`)
    })
    expect(numbers).toEqual(['1:Before the Tide', '2:Low Water', '3:The Stair', '4:The Verdict Waits'])
  })

  test('folds away, and stays folded', async ({ page }) => {
    const worldId = await book(page)
    const tree = await open(page, worldId)
    const toggle = page.getByRole('button', { name: 'Binder', exact: true })

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await toggle.click()
    await expect(tree).toHaveCount(0)

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('button', { name: 'Binder', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('tree', { name: 'Chapters and scenes' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Binder', exact: true }).click()
    await expect(page.getByRole('tree', { name: 'Chapters and scenes' })).toBeVisible()
  })
})

test.describe('the binder, for a reader', () => {
  test.describe.configure({ timeout: 240_000 })

  test('shows what they have reached, and cannot add or remove', async ({ page }) => {
    const worldId = await book(page)
    let tree = await open(page, worldId)
    // Put the reader at the second scene, as a writer would leave the cursor.
    await tree.getByRole('treeitem', { name: 'Teodora at the table' }).click()
    await expect.poll(() => cursor(page)).toBe('e2')

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)
    tree = await open(page, worldId)

    // Presence and absence, in the same tree.
    await expect(tree.getByRole('treeitem', { name: 'The assize rises' })).toBeVisible()
    await expect(tree.getByRole('treeitem', { name: 'Teodora at the table' })).toBeVisible()
    await expect(tree.getByRole('treeitem', { name: 'The tide-table' })).toHaveCount(0)
    await expect(tree.getByRole('treeitem', { name: /^Ch\. 2/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New scene', exact: true })).toHaveCount(0)

    // Enter goes rather than adds, Delete does nothing, and neither moves the
    // reader's place.
    await tree.getByRole('treeitem', { name: 'The assize rises' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('textbox', { name: 'New scene title' })).toHaveCount(0)
    await page.keyboard.press('Delete')
    expect(await order(page, 'c1')).toEqual(['The assize rises', 'Teodora at the table', 'The tide-table'])
    expect(await cursor(page)).toBe('e2')
  })
})
