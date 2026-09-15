import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The cursor keeps up with a reader who is actually reading.
 *
 * `readingFollows.spec.ts` proves the rule on Dracula, by setting `scrollTop`
 * twice. That passes on every shipped book — measured — and still misses what a
 * reader reported: Alice's Adventures in Wonderland and The Turn of the Screw
 * stop moving the chapter part-way through.
 *
 * The difference is the scrolling. A jump leaves the observer a clear moment to
 * settle; a reader turns pages continuously, and the cursor advance itself is
 * in the observer effect's dependency list, so each advance tears the observer
 * down and builds a new one. The shorter a book's scenes, the more often that
 * happens per screen of reading — Alice's median scene is 497 words against
 * Dracula's 1,933.
 *
 * So this drives the wheel, the way a reader does.
 */

const scroller = (page: Page) => page.locator('div.flex-1.overflow-auto').first()

async function cursorChapter(page: Page): Promise<number | null> {
  const id = await page.evaluate(() => {
    const raw = localStorage.getItem('plotweave-ui')
    return raw ? (JSON.parse(raw) as { state: { activeEventId: string | null } }).state.activeEventId : null
  })
  if (!id) return null
  return page.evaluate(async (eventId) => {
    const db = (window as unknown as { __pwdb?: {
      events: { get: (id: string) => Promise<{ chapterId: string } | undefined> }
      chapters: { get: (id: string) => Promise<{ number: number } | undefined> }
    } }).__pwdb
    if (!db) throw new Error('__pwdb seam missing')
    const ev = await db.events.get(eventId)
    if (!ev) return null
    const ch = await db.chapters.get(ev.chapterId)
    return ch ? ch.number : null
  }, id)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

// Dracula is the presence beside the absence: if the harness itself were
// broken every book would stall, and the result would say nothing about Alice.
for (const title of ['Dracula', 'Alice’s Adventures in Wonderland', 'The Turn of the Screw']) {
  test(`the chapter keeps up while reading ${title}`, async ({ page }) => {
    await downloadLibraryBook(page, title)
    await settle(page)
    await page.getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Read', exact: true }).click()
    await settle(page)

    const opened = await cursorChapter(page)
    expect(opened, 'the book opens inside a chapter').not.toBeNull()

    const total = await page.evaluate(async () => {
      const db = (window as unknown as { __pwdb?: { chapters: { count: () => Promise<number> } } }).__pwdb
      return db ? db.chapters.count() : 0
    })

    // Read continuously, as a reader does, rather than teleporting.
    await scroller(page).hover()
    const box = await scroller(page).boundingBox()
    expect(box).not.toBeNull()
    for (let i = 0; i < 120; i += 1) {
      await page.mouse.wheel(0, 600)
      await page.waitForTimeout(25)
    }
    await page.waitForTimeout(1200)

    const reached = await cursorChapter(page)
    const scrolled = await scroller(page).evaluate((el) => el.scrollTop / (el.scrollHeight - el.clientHeight))
    console.log(`[${title}] chapters ${opened} -> ${reached} of ${total}, scrolled ${(scrolled * 100).toFixed(0)}%`)

    // The cursor should be roughly as far through the book as the reader is.
    const expected = Math.max(1, Math.floor(total * scrolled * 0.6))
    expect(reached, `cursor kept up (scrolled ${(scrolled * 100).toFixed(0)}% of the book)`)
      .toBeGreaterThanOrEqual(expected)
  })
}
