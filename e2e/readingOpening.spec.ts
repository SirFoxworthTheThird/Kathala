import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A long book says it is opening, instead of looking finished and empty.
 *
 * *The Count of Monte Cristo* is 459,375 words across 149 scenes, and reading
 * them out of IndexedDB takes about 1.6 seconds before a line can be drawn —
 * measured from clicking **Read** to the first paragraph appearing. The cost
 * scales with the length of the book, not the number of scenes: Alice (26k
 * words) took 165ms, Moby-Dick (208k) 1,218ms.
 *
 * For that second and a half the reader had an empty page and nothing to read
 * from it. It is not distinguishable from a screen that has finished loading
 * and has nothing to show, and it is worst on exactly the books someone has
 * most reason to wait for.
 */

const scroller = (page: Page) => page.locator('div.flex-1.overflow-auto').first()

async function openBook(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the longest book never claims to have no text while it is loading', async ({ page }) => {
  await downloadLibraryBook(page, 'The Count of Monte Cristo')
  await settle(page)

  /*
    Polling rather than a locator wait, because the states being checked are
    ones the app is trying to leave as fast as it can — `toBeVisible` would race
    them and pass on the prose without ever seeing what came before.

    What a reader must never see is the empty state: `hasProse` in the view is
    "is the manuscript compiled", which is false while the prose is still
    arriving, and wiring the empty state to it would tell someone their book has
    no text at the one moment it is longest.
  */
  await page.evaluate(() => {
    ;(window as unknown as { __seen: string[] }).__seen = []
    const t0 = performance.now()
    const tick = () => {
      const seen = (window as unknown as { __seen: string[] }).__seen
      const txt = document.querySelector('main')?.innerText ?? ''
      const state = document.querySelector('[data-scene-event-id]') ? 'prose'
        : txt.includes('No prose yet') ? 'no-prose-yet'
        : 'waiting'
      if (seen[seen.length - 1] !== state) seen.push(state)
      if (performance.now() - t0 < 15_000) requestAnimationFrame(tick)
    }
    tick()
  })

  await openBook(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 120_000 })

  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)
  expect(seen, `states seen: ${seen.join(' -> ')}`).not.toContain('no-prose-yet')
  expect(seen[seen.length - 1], 'it ends on the book').toBe('prose')
})

test('a short book goes straight to prose, and the whole book is there', async ({ page }) => {
  /*
    The presence beside the absence. The test above says a long book must never
    claim to be empty while it loads; this one says a short book simply is the
    book, at the top, with every scene present — so the rule above cannot be
    satisfied by a screen that is slow or truncated for everyone.

    Alice loads in ~165ms against Monte Cristo's ~1.7s.
  */
  await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })

  await expect.poll(
    () => page.locator('[data-scene-event-id]').count(),
    { timeout: 20_000, message: 'the rest of the book arrives behind the first chapter' },
  ).toBe(51)

  // And it is readable from the top: the first pass is the opening, not the middle.
  expect(await scroller(page).evaluate((el) => el.scrollTop)).toBeLessThan(200)
})
