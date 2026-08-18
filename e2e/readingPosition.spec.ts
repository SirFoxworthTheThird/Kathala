import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * F-3 from the reader run: *"One tap on the Calendar silently threw away my
 * place in the book."*
 *
 * Reproduced there at chapter 8 of *The Woman in White*: tapping an earlier
 * scene — to remind yourself what it was — moved the cursor **and** the stored
 * position back to chapter 3, with no undo, since reading mode removes it. The
 * shelf then reports "Chapter 3 of 62" a week later.
 *
 * For a writer the time cursor is a viewfinder and every screen moves it. For a
 * reader it is the one piece of state they own. So while reading it moves only
 * from the controls that say they move it, and every test here ends at what is
 * **stored**, not at what is on screen — the bookmark is what the reader loses.
 */

const storedCursor = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('plotweave-ui')
  return raw ? (JSON.parse(raw) as { state?: { activeEventId?: string | null } }).state?.activeEventId ?? null : null
})

const cursorLabel = (page: Page) =>
  page.locator('header button[title*="open timeline"]').first().getAttribute('title')

async function readerAtAMoment(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)

  // Read on a few moments, so there is a position worth losing.
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Next moment' }).click()
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(800)
  const worldId = new URL(page.url()).hash.split('/')[2]
  return { worldId, mark: await storedCursor(page), label: await cursorLabel(page) }
}

test.describe('A reader keeps their place in the book', () => {
  test.describe.configure({ timeout: 300_000 })

  test('looking at an earlier scene on the Calendar does not move it', async ({ page }) => {
    const { worldId, mark, label } = await readerAtAMoment(page)
    expect(mark, 'the reader should have a position to lose').not.toBeNull()

    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)

    // The first scene chip on the calendar — an earlier moment than the mark.
    const chip = page.getByRole('main').locator('[draggable], button').filter({ hasText: /\w/ }).first()
    await chip.click({ timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(1500)

    expect(await storedCursor(page), 'the stored bookmark must not move').toBe(mark)
    expect(await cursorLabel(page), 'and the pill still says where they are').toBe(label)
  })

  /**
   * The presence half, and it matters more than usual here: the fix is a
   * suppression, so "the cursor did not move" is exactly what a broken calendar
   * would also produce. With reading mode off the same tap must still move it,
   * because for a writer that is the whole idiom.
   */
  test('but for a writer the same tap still moves it', async ({ page }) => {
    const { worldId, mark } = await readerAtAMoment(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: {
          toArray: () => Promise<Array<{ id: string }>>
          update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
        }
      }
      const w = (await db.worlds.toArray())[0]
      await db.worlds.update(w.id, { readingMode: false })
    })
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)

    const chip = page.getByRole('main').locator('[draggable], button').filter({ hasText: /\w/ }).first()
    await chip.click({ timeout: 30_000 }).catch(() => {})
    await expect.poll(() => storedCursor(page), { timeout: 15_000 }).not.toBe(mark)
  })

  /**
   * And the controls that *say* they move it still do — otherwise the rule
   * above would be satisfied by a reading mode in which the reader can never
   * move at all, which is the feature switched off rather than fixed.
   */
  test('the controls that say they move it still do', async ({ page }) => {
    const { mark } = await readerAtAMoment(page)
    await page.getByRole('button', { name: 'Next moment' }).click()
    await expect.poll(() => storedCursor(page), { timeout: 15_000 }).not.toBe(mark)
  })
})
