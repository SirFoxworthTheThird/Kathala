import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * F-6: the Calendar invited the reader to rearrange the author's chronology.
 *
 * The screen's own header said *"Drag an event to a day to pin it there"*, every
 * chip carried `draggable`, and `CalendarView` imported no gate at all. The
 * reader run confirmed the invitation but reported the **write** as
 * unreproduced — its synthetic drag events could not get past a `dragId` set
 * asynchronously.
 *
 * Playwright's `dragTo` drives real HTML5 drag events, and the write lands: on
 * a freshly downloaded *Philosopher's Stone*, in reading mode, dragging the one
 * chip onto another day changed that event's `inWorldTime` in the database.
 * So this is not a cosmetic invitation — it is the **RM-2** shape with a real
 * mutation behind it.
 *
 * Both tests end at the database, because a chip that has lost `draggable`
 * while `dropOnDay` still writes would satisfy a DOM assertion.
 */

/** Every event's pinned day, so a change anywhere in the book is visible. */
const inWorldTimes = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { events: { toArray: () => Promise<Array<{ id: string; inWorldTime: number | null }>> } }
  return (await db.events.toArray())
    .map((e) => `${e.id}:${e.inWorldTime}`)
    .sort()
    .join(',')
})

async function onTheCalendar(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  return worldId
}

/** Turn reading mode off on the world record — a reader's own escape hatch. */
async function stopReading(page: Page) {
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
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(2500)
}

/**
 * The grid itself. A page-wide lookup for a scene title finds three: the
 * time-cursor pill in the top bar and the chapter bar both carry it, which is
 * exactly the ambiguity the repo has been bitten by before. Every locator below
 * reaches through a day cell.
 */
const dayCell = (page: Page, day: number) =>
  page.locator('div[aria-label*="1981"]').filter({ hasText: new RegExp(`^${day}\\b`) }).first()

/** The one chip *Philosopher's Stone* draws, found inside the grid. */
const chipInGrid = (page: Page) =>
  page.locator('div[aria-label*="1981"]').getByRole('button', { name: /A Peculiar Day for Vernon/ }).first()

test.describe('Reading mode on the calendar', () => {
  test.describe.configure({ timeout: 300_000 })

  test('a reader is not invited to move the author\'s dates, and cannot', async ({ page }) => {
    await onTheCalendar(page)
    const before = await inWorldTimes(page)

    // The screen is drawn and showing the book — without this the absences
    // below would pass on a calendar that never rendered.
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
    await expect(chipInGrid(page)).toBeVisible()

    // The invitation is withdrawn, and so is the affordance.
    await expect(page.getByText(/Drag an event to a day/)).toHaveCount(0)
    await expect(page.locator('[draggable="true"]')).toHaveCount(0)

    // And the gesture itself, driven for real, moves nothing.
    await chipInGrid(page).dragTo(dayCell(page, 15)).catch(() => {})
    await page.waitForTimeout(1500)
    expect(await inWorldTimes(page)).toEqual(before)
  })

  /**
   * The presence half, and the one that proves the drag above is a real
   * gesture rather than one Playwright silently declines to deliver. Without
   * it, every assertion in the first test is satisfied by a calendar nobody
   * can drag on at all — which is the fix breaking the feature.
   */
  test('and with reading mode off the same drag pins the scene', async ({ page }) => {
    await onTheCalendar(page)
    await stopReading(page)

    await expect(page.getByText(/Drag an event to a day/)).toBeVisible()
    const chip = chipInGrid(page)
    await expect(chip).toHaveAttribute('draggable', 'true')

    const before = await inWorldTimes(page)
    await chip.dragTo(dayCell(page, 15))
    await expect.poll(() => inWorldTimes(page), { timeout: 15_000 }).not.toEqual(before)
  })
})
