import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * A reader is not handed the story player.
 *
 * `Play story on the map` walks the time cursor from one scene to the next on a
 * timer — which for someone reading is a spoiler engine with a start button. It
 * also moves the cursor to scene one before it starts, and navigates off the
 * book to the Map. `Stop` is worse: it is `setActiveEventId(null)`, the
 * full-reveal state, with no confirmation — the same fault the chapter rows had.
 *
 * `Controls` already consults the gate; it gates **Compare chapters** and
 * nothing else, so Play and the speed cycler were offered on every screen a
 * reader can open, the Read screen included.
 */

const play = (page: Page) => page.getByRole('button', { name: 'Play story on the map' })
// By prefix: the button is named "Playback speed: 1×", the rate spliced in so
// the visible text is part of the name. Matching the whole literal string found
// nothing in either mode, and the reader half passed on that — vacuously.
const speed = (page: Page) => page.getByRole('button', { name: /^Playback speed/ })

async function openBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.locator('[data-scene-event-id]').first()).toBeVisible({ timeout: 60_000 })
}

async function stopReadingMode(page: Page, worldId: string) {
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('the reading screen offers a reader no story player', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openBook(page, worldId)

  await expect.soft(play(page), 'no play button').toHaveCount(0)
  await expect.soft(speed(page), 'no playback speed').toHaveCount(0)
})

test('nor does the Timeline, which is where the bar is most obvious', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('main').getByText(/Down the Rabbit-Hole/i).first()).toBeVisible()

  await expect.soft(play(page), 'no play button').toHaveCount(0)
  await expect.soft(speed(page), 'no playback speed').toHaveCount(0)
})

test('a writer keeps the player on the same book and the same screen', async ({ page }) => {
  /*
    The presence beside the absence. Playback is how a writer watches their cast
    move across the map, and a guard that removed it for everyone would satisfy
    both tests above while taking a feature away from the person writing.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await stopReadingMode(page, worldId)
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)

  await expect(play(page), 'the writer still has the player').toBeVisible()
  await expect(speed(page), 'and the speed control').toBeVisible()
})
