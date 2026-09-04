import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Playback in reading mode, on a world whose bar is in merged mode.
 *
 * The bottom bar has four track modes, and three of them fed the playback timer
 * from an ungated list — `useTimelineEvents`, which does not stop at the
 * reader's position. Merged mode fed it `useWorldEvents`, which does. So in
 * reading mode the sequence handed to `useTimelinePlayback` ended at the cursor,
 * the first tick found itself already on the last event, and playback turned
 * itself off without moving. Pressing play held one scene for five seconds and
 * gave up.
 *
 * Merged mode needs two or more timelines with no frame relationship between
 * them, which is why nothing caught it until a world of that shape shipped in
 * the Library.
 *
 * The world below is the smallest thing with that shape: two timelines, and a
 * chapter 2 that sits *after* the cursor so the gated sequence really does stop
 * there. Chapter 2's tooltip is the pair — "not yet reached" before the play,
 * its title after — so neither half of this can pass vacuously: a bar that
 * never advanced keeps the first tooltip, and one that revealed everything
 * would have failed the first assertion.
 */

const bar = (page: Page) => page.locator('[data-chapter-bar]')

/** The time-cursor pill in the top bar, which names the scene the cursor is on. */
const cursorPill = (page: Page) => page.locator('header button[title]').filter({ hasText: /Ch\.|chapters/ }).first()

const cursorTitle = (page: Page) =>
  page.locator('header button').evaluateAll((els) => {
    const t = els.map((e) => e.getAttribute('title') ?? '').find((s) => /^(Playing… )?Ch\./.test(s))
    return t ?? '(none)'
  })

/**
 * Two timelines, three scenes, and the cursor parked on the last scene of
 * chapter 1 — the position at which the gated sequence has nothing after it.
 *
 * Built through the UI rather than seeded, because what is under test is which
 * of two lists the bar hands to the playback timer, and that wiring only exists
 * in the running app.
 */
async function twoTimelineWorld(page: Page) {
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Merged')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  const gotoTimeline = () => page.getByRole('link', { name: /timeline/i }).first().click()
  const addChapter = async (title: string) => {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(title)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
  }
  const addScene = async (chapterIndex: number, title: string) => {
    await page.getByTitle('Open chapter detail').nth(chapterIndex).click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill(title)
    await page.getByRole('button', { name: 'Add Scene' }).last().click()
    await gotoTimeline()
  }

  // Timeline 1: chapters 1 and 2, one scene each.
  await gotoTimeline()
  await page.getByRole('button', { name: 'Create Timeline' }).click()
  await addChapter('One')
  await addChapter('Two')
  await addScene(0, 'Alpha one')
  await addScene(1, 'Alpha two')

  // Timeline 2: its own chapter 1, one scene. Merged in reading order this
  // lands after Alpha one and before Alpha two.
  await gotoTimeline()
  await page.getByRole('button', { name: 'New Timeline' }).click()
  await addChapter('Three')
  await addScene(0, 'Beta one')

  // The cursor goes on Beta one: last in the merged sequence that the reading
  // gate lets through, and two scenes short of the end of the real one.
  await gotoTimeline()
  await settle(page)
  await bar(page).locator('button[title="Beta one"]').click()
  await expect.poll(() => cursorTitle(page)).toContain('Beta one')

  return worldId
}

async function startReading(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Turn on reading mode' }).click()
  await expect(page.getByRole('button', { name: 'Turn off reading mode' })).toBeVisible()
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
}

/** Press play and wait out one hold — 5s at normal speed, plus room to spare. */
async function playAndWait(page: Page) {
  await bar(page).getByTitle('Play all timelines on the map').click()
  await expect.poll(() => cursorTitle(page), { timeout: 40_000 }).toMatch(/^Playing… Ch\.2 · Alpha two$/)
}

test.describe('Playback in a merged bar', () => {
  test.describe.configure({ timeout: 300_000 })

  test('carries the reader past their own position', async ({ page }) => {
    const worldId = await twoTimelineWorld(page)
    await startReading(page, worldId)

    // The gate is on and holding chapter 2 back: it has no block in the bar at
    // all, because no scene of it has been reached.
    await expect(cursorPill(page)).toBeVisible()
    await expect(bar(page).locator('[title*="Ch. 2"]')).toHaveCount(0)

    await playAndWait(page)

    // The cursor moved into the chapter the gate was holding, and the bar has
    // caught up — chapter 2 is drawn, by its name.
    await expect(bar(page).locator('[title="Ch. 2 — Two"]')).toHaveCount(1)
  })

  test('and does the same with reading mode off', async ({ page }) => {
    // The control. Without it, the test above is satisfied by playback being
    // broken everywhere rather than fixed in reading mode.
    await twoTimelineWorld(page)
    await expect(bar(page).locator('[title="Ch. 2 — Two"]')).toHaveCount(1)

    await playAndWait(page)
  })
})
