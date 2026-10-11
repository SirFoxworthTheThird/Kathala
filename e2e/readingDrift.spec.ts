import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A scroll that skips chapters says so, and offers the way back.
 *
 * The Read view advances your place as you read, which is the feature. What a
 * blind reader run found is that a *jump* — a dragged scrollbar, or a fling long
 * enough that the scenes between never intersect — moved it from chapter 7 to
 * chapter 11 in one step, silently, and scrolling back did not restore it,
 * because the cursor is a high-water mark by design. The same move on the
 * Timeline raises a confirm.
 *
 * It cannot be a confirm here: reading on must never be interrupted. So a skip
 * is announced instead, with an Undo that puts the reader back.
 */

const chapterPill = (page: Page) => page.getByRole('banner').getByTitle(/^Ch\./)
const drift = (page: Page) => page.getByText(/^Moved on to chapter \d+$/)

const chapterNow = async (page: Page) => {
  const t = await chapterPill(page).first().getAttribute('title')
  return Number(/Ch\.\s*(\d+)/.exec(t ?? '')?.[1] ?? NaN)
}

async function openBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a scroll that skips chapters is announced, and can be undone', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'The Count of Monte Cristo')
  await settle(page)
  await openBook(page, worldId)

  const scroller = page.locator('[data-book-scroller]')
  await expect.poll(() => chapterNow(page), { timeout: 30_000 }).toBe(1)
  const started = await chapterNow(page)

  /*
    The toast is held from the moment it is rendered, as it is for anyone whose
    focus is in it. Its seven seconds start when it mounts, and the jump sets
    *Monte Cristo* laying out for seconds at a time: with four workers a trace
    showed it pushed at 15.1s, first seen by the test at 21.3s, its text read at
    25.8s — and gone before the Undo could be reached, ten runs in twelve. Every
    step from here waits on that busy page, so the hold cannot be one of them:
    it is armed before the jump, in the page, and runs in the same task that
    inserts the toast, ahead of any timer.
  */
  await page.evaluate(() => {
    const hold = new MutationObserver(() => {
      const message = Array.from(document.querySelectorAll('[role="status"] span'))
        .find((s) => /^Moved on to chapter \d+$/.test(s.textContent ?? ''))
      const undo = Array.from(message?.parentElement?.querySelectorAll('button') ?? [])
        .find((b) => b.textContent === 'Undo')
      if (!undo) return
      undo.focus({ preventScroll: true })
      hold.disconnect()
    })
    hold.observe(document.body, { childList: true, subtree: true })
  })

  // One jump, the way a dragged scrollbar moves: no frames in between.
  await scroller.evaluate((el) => { el.scrollTop = 60_000 })

  // Undo is dispatched rather than clicked: a click first waits for the button to hold still across two frames.
  const toast = drift(page)
  await expect(toast, 'the skip is announced').toBeVisible({ timeout: 20_000 })
  await expect(toast.locator('..'), 'and held while the test reads it').toHaveAttribute('data-held', 'true')
  const jumped = await chapterNow(page)
  const said = Number(/(\d+)$/.exec(await toast.innerText())?.[1] ?? NaN)
  await toast.locator('..').getByRole('button', { name: 'Undo' }).dispatchEvent('click')

  expect(jumped, `the cursor went from ${started} to ${jumped}`).toBeGreaterThan(started + 1)
  expect(said, `and the toast named a chapter past it: ${said}`).toBeGreaterThan(started + 1)
  await expect.poll(() => chapterNow(page), { timeout: 20_000 }).toBe(started)

  /*
    And it stays undone. Restoring the cursor without scrolling back would leave
    the reader looking at chapter 11, where the observer advances again at once
    — the undo undone a frame later.
  */
  await page.waitForTimeout(1500)
  expect(await chapterNow(page), 'still back where they were').toBe(started)
})

test('reading on is never interrupted by it', async ({ page }) => {
  /*
    The other half, and the one that decides whether this was worth doing: a
    reader moving through the book a scene at a time must see nothing. Without
    it, "announce a skip" could be satisfied by announcing everything, which
    would be worse than the fault it fixes.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  const scroller = page.locator('[data-book-scroller]')
  const scenes = page.locator('[data-scene-event-id]')
  const count = Math.min(await scenes.count(), 12)
  expect(count, 'there are scenes to read through').toBeGreaterThan(4)

  for (let i = 0; i < count; i++) {
    await scenes.nth(i).scrollIntoViewIfNeeded()
    await page.waitForTimeout(220)
    expect(await drift(page).count(), `nothing shown at scene ${i + 1}`).toBe(0)
  }
  await expect(scroller).toBeVisible()
})
