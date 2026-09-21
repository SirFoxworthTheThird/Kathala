import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The Timeline's chapter rows ask before revealing, like everything else does.
 *
 * A blind reader run reading *The Count of Monte Cristo* found two ways to be
 * shown the whole book from this screen, neither of which asked:
 *
 * - **Reading here**, on the chapter the reader is on — the control titled
 *   "This is where you have read up to". One click cleared the cursor to *all
 *   chapters* and the roster went from 6 characters met to all 41, printing
 *   Haydée, Benedetto and Abbé Faria straight onto the page.
 * - **Read to here**, on a chapter far ahead. One click moved a reader from
 *   chapter 3 to chapter 38, while the identical action on the chapter bar
 *   thirty rows below asked first.
 *
 * This is the screen the dashboard's *Set where you have read to* points at, so
 * it is where a reader is most likely to be clicking.
 */

const rowButton = (page: Page, name: RegExp | string) =>
  page.getByRole('main').getByRole('button', { name })

const cursor = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('kathala-ui')
  return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
})

async function openTimeline(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('pressing your own bookmark asks before showing the whole book', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openTimeline(page, worldId)

  const before = await cursor(page)
  expect(before, 'a downloaded book opens somewhere').not.toBeNull()

  await rowButton(page, 'Reading here').click()

  // The dialog, not the reveal.
  await expect(page.getByText('Show the whole book?')).toBeVisible()
  expect(await cursor(page), 'nothing revealed while the question is open').toBe(before)

  // Declining leaves the reader exactly where they were.
  await page.getByRole('button', { name: /^Cancel$/i }).click()
  expect(await cursor(page)).toBe(before)

  // And accepting still works, because this is a confirm rather than a block.
  await rowButton(page, 'Reading here').click()
  await page.getByRole('button', { name: 'Show everything' }).click()
  await expect.poll(() => cursor(page), { timeout: 10_000 }).toBeNull()
})

test('reading far ahead from a chapter row asks first', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openTimeline(page, worldId)

  const before = await cursor(page)
  // Chapter 9 from chapter 1 — well past the next chapter, which is the line
  // `asksBeforeJumping` draws.
  await rowButton(page, /^Read to here$/).nth(8).click()

  await expect(page.getByText(/Read ahead to chapter \d+\?/)).toBeVisible()
  expect(await cursor(page), 'the jump waits for an answer').toBe(before)

  await page.getByRole('button', { name: 'Read ahead' }).click()
  await expect.poll(() => cursor(page), { timeout: 10_000 }).not.toBe(before)
})

test('the next chapter is ordinary reading and is never interrupted', async ({ page }) => {
  /*
    The absence beside the presences. If the guard simply asked on every move,
    a reader stepping through their book one chapter at a time would be asked
    at every step — and the two tests above would pass while the screen became
    unusable. `asksBeforeJumping` exists to draw that line.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openTimeline(page, worldId)

  const before = await cursor(page)
  await rowButton(page, /^Read to here$/).first().click()

  await expect(page.getByText(/Read ahead to chapter/)).toHaveCount(0)
  await expect(page.getByText('Show the whole book?')).toHaveCount(0)
  await expect.poll(() => cursor(page), { timeout: 10_000 }).not.toBe(before)
})

test('a writer moving the same cursor is asked nothing at all', async ({ page }) => {
  /*
    The other absence, and it has to be the same screen with the same rows: the
    guard is about reading. A writer's cursor is a viewfinder — it reveals
    nothing, because there is nothing being withheld — so a confirm there would
    be a dialog in the way of ordinary work.
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

  await rowButton(page, /^View from here$/).nth(8).click()
  await expect(page.getByText(/Read ahead to chapter/)).toHaveCount(0)

  await rowButton(page, 'Viewing').click()
  await expect(page.getByText('Show the whole book?')).toHaveCount(0)
  await expect.poll(() => cursor(page), { timeout: 10_000 }).toBeNull()
})
