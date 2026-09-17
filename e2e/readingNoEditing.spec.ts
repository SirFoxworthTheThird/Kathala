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

test('a chapter offers a reader no empty section addressed to somebody else', async ({ page }) => {
  /*
    Two blind reader runs met the chapter screen ending in "Writer's Notes — No
    notes on this chapter" and "Relationship States — No relationship states
    recorded": two empty sections addressed to somebody who is not here, on a
    book the reader cannot write in. Same rule as the map sidebar's Routes and
    Regions — an empty section is an answer to a writer and a dead end to a
    reader — and the same shape as the notes box itself, which was made
    read-only rather than removed, because notes that exist are worth reading.

    Alice rather than Dracula: every Dracula chapter carries notes, so the empty
    state is unreachable there and an earlier version of this passed without
    testing anything. 1038 of the library's 1634 chapters have none.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)

  const chapterId = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: {
      chapters: { toArray: () => Promise<{ id: string; number: number; notes?: string }[]> }
    } }).__pwdb
    const all = await db!.chapters.toArray()
    const empty = all.filter((c) => !(c.notes ?? '').trim()).sort((a, b) => a.number - b.number)
    if (!empty.length) throw new Error('every chapter in this book has notes')
    return empty[0].id
  })

  const openChapter = async () => {
    await page.goto(`/#/worlds/${worldId}/timeline/${chapterId}`, { waitUntil: 'load' })
    await settle(page)
  }

  await openChapter()
  await expect(page.getByText("Writer's Notes"), 'no empty notes panel while reading').toHaveCount(0)
  await expect(page.getByText('Relationship States'), 'no empty relationship section').toHaveCount(0)

  // The presence half, on the same chapter of the same book: both come back for
  // the person they are addressed to.
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await expect(page.getByRole('button', { name: 'Turn on reading mode' })).toBeVisible()
  await settle(page)

  await openChapter()
  await expect(page.getByText("Writer's Notes").first(), 'a writer keeps the notes box').toBeVisible()
  await expect(page.getByText('Relationship States').first(), 'and the relationship section').toBeVisible()
})

test('settings says what turning reading mode off will show', async ({ page }) => {
  /*
    A reader run called this "the app guards the small doors and leaves the big
    one unlatched": stepping the cursor two chapters forward raises a confirm,
    and turning the whole mode off is one unguarded click. A confirm is still
    the wrong answer — this is the deliberate escape hatch, on a settings
    screen, under a button that says exactly what it does — but the paragraph
    beside it talked about editing and re-downloading and never about the
    reveal, which is the thing that cannot be undone.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  await settle(page)

  await expect(page.getByText(/shows the whole world at once/),
    'it says what comes back').toBeVisible()
  await expect(page.getByText(/including the ones you have not read yet/),
    'and that it includes what has not been read').toBeVisible()
  await expect(page.getByText(/place in the book is\s+kept/),
    'and that the place is not lost, so the warning is not a scare').toBeVisible()
})

