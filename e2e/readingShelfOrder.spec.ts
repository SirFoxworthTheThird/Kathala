import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * **R11.** A reader closed the browser and came back the next evening on a
 * 390px phone. The whole first viewport was the author's chrome — *"A story
 * bible for fiction writers"*, New World, Generate World from AI, Library,
 * Import World, Import Manuscript, then the demo worlds — and the **Reading**
 * shelf, with the book they were seven chapters into, began at **y=916** on an
 * 844px viewport. They scrolled past everything they were not doing to reach
 * the one thing they were.
 *
 * Drafts still lead by default, because this is a writing tool. What changed is
 * that a book with somebody's place kept in it says a reader opened this, and
 * the shelf order follows — so both halves are driven here, in the same file
 * and at the same viewport, because "reading leads" is only correct as long as
 * it does not always happen.
 */

test.describe('Which shelf a phone shows first', () => {
  test.describe.configure({ timeout: 180_000 })
  test.use({ viewport: { width: 390, height: 844 } })

  /** The shelf headings, in the order the document holds them. */
  const shelves = (page: Page) => page.evaluate(() =>
    Array.from(document.querySelectorAll('main h2'))
      .map((h) => (h.textContent ?? '').trim())
      .filter((t) => t === 'Reading' || t === 'Your worlds'))

  test('a book in progress leads, and is on the first screen', async ({ page }) => {
    await resetDB(page)
    await downloadLibraryBook(page, DEFAULT_BOOK)

    // A place in the book, which is the whole signal. Without this the world is
    // one that was downloaded and never opened.
    await page.getByRole('button', { name: 'Next moment' }).click()
    await settle(page)

    await page.goto('/#/', { waitUntil: 'load' })
    await settle(page)
    await expect.poll(() => shelves(page), { timeout: 30_000 })
      .toEqual(['Reading', 'Your worlds'])

    /*
      The finding was not about DOM order, it was about 916 pixels. Asserted on
      the heading rather than the card, because the card's height depends on how
      much the book has in it.
    */
    const box = await page.getByRole('heading', { name: 'Reading', exact: true }).boundingBox()
    expect(box, 'the Reading heading should be laid out').not.toBeNull()
    expect(box!.y, 'the reading shelf should be on the first screen of a phone')
      .toBeLessThan(844)
  })

  test('a book that was never opened does not demote a writer’s drafts', async ({ page }) => {
    await resetDB(page)
    /*
      Installed without opening it: `downloadLibraryBook` navigates into the
      world, and this test is precisely about a reading world that has no place
      kept in it.
    */
    await page.evaluate(async (name: string) => {
      const seam = (window as unknown as {
        __pwlibrary?: { install: (t: string) => Promise<string> }
      }).__pwlibrary
      if (!seam) throw new Error('__pwlibrary seam missing — build with VITE_E2E=1')
      await seam.install(name)
    }, DEFAULT_BOOK)

    await page.goto('/#/', { waitUntil: 'load' })
    await settle(page)
    await expect.poll(() => shelves(page), { timeout: 30_000 })
      .toEqual(['Your worlds', 'Reading'])
  })
})
