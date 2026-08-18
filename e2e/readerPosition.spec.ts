import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * F-4: saying where you are was cheap only if you found it.
 *
 * Measured by the reader run: the always-visible stepper moves by **moment**,
 * so chapter 1 → chapter 4 of *Philosopher's Stone* is 9 taps and walking the
 * book is ~50. **Read to here** on a chapter row is 2. But it lived only on the
 * Timeline, it was called *View from here* — a display option, not a bookmark —
 * and the dashboard's reading notice, the screen the Library lands you on,
 * offered exactly one thing to do: *Turn it off in settings*.
 */

const storedCursor = (page: Page) => page.evaluate(() => {
  const raw = localStorage.getItem('plotweave-ui')
  return raw ? (JSON.parse(raw) as { state?: { activeEventId?: string | null } }).state?.activeEventId ?? null : null
})

async function readerOnTheDashboard(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
  return worldId
}

test.describe('A reader can say how far they have got', () => {
  test.describe.configure({ timeout: 300_000 })

  test('the reading notice offers the way to set it, not just the way out', async ({ page }) => {
    await readerOnTheDashboard(page)
    const notice = page.getByRole('complementary', { name: 'Reading mode' })
    await expect(notice).toBeVisible()

    // Both, and the useful one first — the notice used to carry only the exit.
    const setIt = notice.getByRole('link', { name: 'Set where you have read to' })
    await expect(setIt).toBeVisible()
    await expect(notice.getByRole('link', { name: 'Turn it off in settings' })).toBeVisible()

    // And it goes where the control lives.
    await setIt.click()
    await expect(page).toHaveURL(/#\/worlds\/[^/]+\/timeline$/)
  })

  test('and the control there is named for what a reader is doing', async ({ page }) => {
    const worldId = await readerOnTheDashboard(page)
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)

    const readToHere = page.getByRole('button', { name: 'Read to here' })
    await expect(readToHere.first()).toBeVisible({ timeout: 30_000 })
    // The writer's wording is not what a reader is shown.
    await expect(page.getByRole('button', { name: 'View from here' })).toHaveCount(0)

    // Two taps from the dashboard, and it does move the position.
    const before = await storedCursor(page)
    await readToHere.last().click()
    await expect.poll(() => storedCursor(page), { timeout: 15_000 }).not.toBe(before)
    // Having read to there, the row says so.
    await expect(page.getByRole('button', { name: 'Reading here' }).first()).toBeVisible()
  })

  /**
   * The other half: a writer sees the writer's words. Without this, renaming
   * the control for everybody would pass every assertion above — and *View from
   * here* is right for someone moving a viewfinder rather than a bookmark.
   */
  test('a writer still gets the writer wording', async ({ page }) => {
    const worldId = await readerOnTheDashboard(page)
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
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)

    await expect(page.getByRole('button', { name: 'View from here' }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Read to here' })).toHaveCount(0)
    // And the notice is gone with the mode.
    await expect(page.getByRole('complementary', { name: 'Reading mode' })).toHaveCount(0)
  })
})
