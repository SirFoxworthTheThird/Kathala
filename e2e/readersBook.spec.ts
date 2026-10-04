import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'
import { settle } from './helpers/settle'

/**
 * Reported from use: *the separation by timeline in reading mode doesn't make
 * sense.*
 *
 * *The Odyssey* keeps two timelines — the homecoming, and the wanderings
 * Odysseus recounts at the Phaeacian court, which are Books 9 to 12. A reader
 * was given the first timeline's book: Read ran Books 1 to 8 and then 13, the
 * wanderings behind a second tab, whose own progress line read "Chapter 9 of 4"
 * — the book's number, out of that timeline's count.
 *
 * In reading mode the book is one book: every timeline's chapters in number
 * order, each saying which timeline it is in — in Read, in Cards and in the
 * binder. A writer keeps the tabs, which is the other half of each test.
 */

test.describe.configure({ timeout: 300_000 })

async function odyssey(page: Page) {
  await resetDB(page)
  const worldId = await downloadLibraryBook(page, 'The Odyssey')
  await settle(page)
  const reading = await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { worlds: { get: (id: string) => Promise<{ readingMode?: boolean } | undefined> } }
    return (await db.worlds.get(id))?.readingMode === true
  }, worldId)
  expect(reading, 'a library world arrives in reading mode').toBe(true)
  return worldId
}

async function setReadingMode(page: Page, worldId: string, on: boolean) {
  await page.evaluate(async ({ id, on }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
    await db.worlds.update(id, { readingMode: on })
  }, { id: worldId, on })
}

/** The first scene of a chapter, by its number. */
async function firstSceneOf(page: Page, worldId: string, number: number) {
  return page.evaluate(async ({ id, number }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      chapters: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; number: number }>> } } }
      events: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; sortOrder: number }>> } } }
    }
    const ch = (await db.chapters.where('worldId').equals(id).toArray()).find((c) => c.number === number)!
    const evs = await db.events.where('chapterId').equals(ch.id).toArray()
    return evs.sort((a, b) => a.sortOrder - b.sortOrder)[0].id
  }, { id: worldId, number })
}

/** Park the cursor on a scene, as a reader who has read this far would have it. */
async function readAt(page: Page, eventId: string) {
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, eventId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  const landed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)
  expect(landed, 'the cursor was actually parked').toBe(eventId)
}

const chapterHeadings = (page: Page) =>
  page.getByRole('main').locator('[data-book-scroller]').getByRole('heading', { level: 2 })

test('a reader reads every timeline as one book, and a writer has the tabs', async ({ page }) => {
  const worldId = await odyssey(page)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')

  // Read, all twenty-four books in order, the wanderings in their place.
  await expect(chapterHeadings(page)).toHaveCount(24, { timeout: 60_000 })
  await expect(chapterHeadings(page).nth(7)).toHaveText('Ch. 8 — The Phaeacian Games')
  await expect(chapterHeadings(page).nth(8)).toHaveText('Ch. 9 — The Cyclops')
  await expect(chapterHeadings(page).nth(12)).toHaveText('Ch. 13 — Return to Ithaca')
  await expect(page.getByRole('tablist', { name: 'Timelines' })).toHaveCount(0)
  await expect(main.getByText('(24 chapters · 2 timelines)', { exact: true })).toBeVisible()

  // Each chapter says which timeline it is in.
  await expect(main.locator('[data-chapter-number="8"]')).toContainText('The Homecoming Present')
  await expect(main.locator('[data-chapter-number="9"]')).toContainText('The Wanderings Recounted')

  // Its place is counted in the whole book.
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[data-book-scroller]')!
    const c = document.querySelector<HTMLElement>('[data-chapter-number="9"]')!
    s.scrollTop = c.offsetTop + 50
  })
  await expect(main.getByText('Chapter 9 of 24', { exact: true })).toBeVisible()

  // A writer: one timeline at a time, with its tabs.
  await setReadingMode(page, worldId, false)
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await settle(page)
  const tabs = page.getByRole('tablist', { name: 'Timelines' })
  await expect(tabs).toBeVisible()
  await expect(chapterHeadings(page)).toHaveCount(20, { timeout: 60_000 })
  await expect(chapterHeadings(page).filter({ hasText: 'The Cyclops' })).toHaveCount(0)
  await expect(main.locator('[data-chapter-number="1"]')).not.toContainText('The Homecoming Present')

  await tabs.getByRole('button', { name: 'The Wanderings Recounted', exact: true }).click()
  await expect(chapterHeadings(page)).toHaveCount(4)
  await expect(chapterHeadings(page).first()).toHaveText('Ch. 9 — The Cyclops')
})

test('the binder and Cards run across timelines for a reader, and stop where they have read to', async ({ page }) => {
  const worldId = await odyssey(page)
  await readAt(page, await firstSceneOf(page, worldId, 10))
  await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  const tree = page.getByRole('tree', { name: 'Chapters and scenes' })

  // The binder: both timelines, in number order, as far as the reader has got.
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 8 · The Phaeacian Games\s*, The Homecoming Present/ })).toBeVisible({ timeout: 60_000 })
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 9 · The Cyclops\s*, The Wanderings Recounted/ })).toBeVisible()
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 10 · / })).toBeVisible()
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 11 · / })).toHaveCount(0)
  await expect(tree.getByRole('treeitem', { level: 1 })).toHaveCount(10)

  // Cards: the same order, each chapter row saying its timeline.
  const rows = main.getByRole('button', { name: /^Ch\. \d+ — / })
  await expect(rows).toHaveCount(24)
  await expect(rows.nth(7)).toHaveAccessibleName(/^Ch\. 8 — /)
  await expect(rows.nth(8)).toHaveAccessibleName(/^Ch\. 9 — /)
  await expect(rows.nth(12)).toHaveAccessibleName(/^Ch\. 13 — /)
  await expect(main.getByRole('button', { name: /^Ch\. 9 — The Cyclops The Wanderings Recounted/i })).toBeVisible()
  await expect(main.getByRole('button', { name: /^Ch\. 8 — The Phaeacian Games The Homecoming Present/i })).toBeVisible()

  // A writer's binder is the one timeline's, its chapters unmarked.
  await setReadingMode(page, worldId, false)
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 9 · / })).toHaveCount(0)
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 13 · Return to Ithaca/ })).toBeVisible()
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 8 · The Phaeacian Games/ })).not.toHaveAccessibleName(/Homecoming/)
})

test('a writer reads All timelines as the same one book, its binder listing every chapter and restructuring nothing', async ({ page }) => {
  const worldId = await odyssey(page)
  await setReadingMode(page, worldId, false)
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  const tree = page.getByRole('tree', { name: 'Chapters and scenes' })
  const layouts = main.getByRole('group', { name: 'Layout', exact: true })
  const tabs = page.getByRole('tablist', { name: 'Timelines' })

  // One timeline's tab: Page is offered, and the binder can add a chapter.
  await expect(layouts.getByRole('button', { name: 'Page', exact: true })).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('button', { name: 'New chapter', exact: true })).toBeVisible()
  await expect(tree.getByRole('treeitem', { level: 1 })).toHaveCount(20)

  // All timelines, in chapter order: Cards and Read, and no Page to type a chapter into.
  await tabs.getByRole('tab', { name: /All timelines/ }).click()
  await expect(layouts.getByRole('button', { name: 'Read', exact: true })).toBeVisible()
  await expect(layouts.getByRole('button', { name: 'Page', exact: true })).toHaveCount(0)
  await layouts.getByRole('button', { name: 'Read', exact: true }).click()
  await expect(chapterHeadings(page)).toHaveCount(24, { timeout: 60_000 })
  await expect(chapterHeadings(page).nth(8)).toHaveText('Ch. 9 — The Cyclops')
  await expect(main.locator('[data-chapter-number="9"]')).toContainText('The Wanderings Recounted')
  await expect(main.locator('[data-chapter-number="8"]')).toContainText('The Homecoming Present')

  // Its binder: every chapter, in order and marked — and nothing added or moved from it.
  await expect(tree.getByRole('treeitem', { level: 1 })).toHaveCount(24)
  await expect(tree.getByRole('treeitem', { name: /^Ch\. 9 · The Cyclops\s*, The Wanderings Recounted/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New chapter', exact: true })).toHaveCount(0)
  await expect(page.getByText(/add or move chapters and scenes on its tab/)).toBeVisible()

  // In-world order is not the book's: no Read there, the merged list instead.
  await main.getByRole('group', { name: 'Combined order' }).getByRole('button', { name: /Chronological/ }).click()
  await expect(layouts).toHaveCount(0)
  await expect(chapterHeadings(page)).toHaveCount(0)
})
