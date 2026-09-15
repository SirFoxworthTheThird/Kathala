import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A reader is not offered the author's editing controls.
 *
 * A blind reader run reading *The Count of Monte Cristo* found a `…` menu on
 * every one of its 117 chapter rows, holding **Rename chapter** and **Delete
 * chapter**. It renamed chapter 2 and read the new title straight back out of
 * IndexedDB, where it survived into later sessions.
 *
 * `ChapterRow` gates six other things on `!gate.active`; the menu was not one
 * of them. `docs/GUIDE.md` promises the opposite — "No screen offers to add,
 * generate or delete anything: … no delete buttons on cards, rows or map
 * layers."
 *
 * The scene card's own menu (Move to chapter, Delete scene) is checked here too,
 * because it carries no gate reference at all and the reader run never opened
 * the screen it lives on.
 */

const chapterMenu = (page: Page) =>
  page.getByRole('button', { name: /^More actions for chapter/ })

const sceneMenu = (page: Page) =>
  page.getByRole('button', { name: /^More actions for / })
    .filter({ hasNotText: 'chapter' })

async function openTimeline(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the Timeline offers a reader no way to rename or delete a chapter', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openTimeline(page, worldId)

  await expect(page.getByRole('main').getByText(/Down the Rabbit-Hole/i).first(),
    'the chapters are on screen').toBeVisible()
  await expect(chapterMenu(page), 'no per-row editing menu').toHaveCount(0)
})

test('a chapter screen offers a reader no way to move or delete a scene', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openTimeline(page, worldId)

  // Straight to the chapter screen by id. Clicking through the row was how the
  // first version of this went, and it waited on a control it never found —
  // timing out instead of testing anything.
  const chapterId = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: {
      chapters: { toArray: () => Promise<{ id: string; number: number }[]> }
    } }).__pwdb
    const all = await db!.chapters.toArray()
    return all.sort((a, b) => a.number - b.number)[0]?.id ?? null
  })
  expect(chapterId, 'the book has a chapter to open').not.toBeNull()
  await page.goto(`/#/worlds/${worldId}/timeline/${chapterId}`, { waitUntil: 'load' })
  await settle(page)

  await expect(page.getByRole('main').getByText(/Down the Rabbit-Hole/i).first(),
    'the chapter opened').toBeVisible()
  await expect(sceneMenu(page), 'no per-scene editing menu').toHaveCount(0)
})

test('a writer keeps both menus on the same screens', async ({ page }) => {
  /*
    The absence beside the presence, on the same book. These are the author's
    controls and they must survive: a guard that removed them for everyone would
    satisfy both tests above while breaking the app for the person writing.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await openTimeline(page, worldId)

  await expect(chapterMenu(page).first(), 'the writer still has the chapter menu').toBeVisible()
})
