import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * Open the month list. HB-9 folded it away by default — twelve rows sat open in
 * the middle of Settings — so anything reaching for a month row asks for it
 * first, as a writer now does.
 */
async function openMonths(page: Page) {
  const toggle = page.getByRole('button', { name: /^Months/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(page.getByLabel('Month 1 name')).toBeVisible()
}

// Drives the real HTML5 drag on the calendar to reschedule an event's in-world
// date. The date maths (buildCalendarMonths / dateToDayNumber) is unit-tested in
// src/lib/__tests__/calendarView.test.ts.

test.describe('Calendar view', () => {
  test('CAL-2: the first visit to Calendar can start one instead of being a dead end', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Undated World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // The finding asked for the nav item to be hidden when no calendar exists.
    // Hiding it hides the feature — nothing else in the app mentions that a
    // calendar can be had — so the item stays and the screen does the thing.
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await expect(page.getByText('No calendar yet')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toHaveCount(0)

    await page.getByRole('button', { name: 'Enable calendar' }).click()

    // One click, on the screen you are already on: the empty state is gone and
    // the calendar itself is here. Paired with the absence above, so neither
    // half can pass on its own.
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('No calendar yet')).toHaveCount(0)

    // And it is a real calendar, not a flag: the world now carries months.
    const months = await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { get: (id: string) => Promise<{ calendar?: { months: unknown[] } | null }> }
      }
      return (await db.worlds.get(id))?.calendar?.months.length ?? 0
    }, worldId)
    expect(months).toBeGreaterThan(1)
  })

  /**
   * HB-3a. Every field in the editor writes the *whole* calendar, because it is
   * a nested object on `worlds` — so a write to one used to carry a stale copy
   * of the others, taken from the last render. The interleaving is unit-tested
   * in `src/db/hooks/__tests__/worldCalendar.test.ts`, where it can be forced;
   * what this drives is the wiring, on the two fields the finding named.
   */
  test('editing the year and its suffix keeps both, and the months with them', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Highbarrow')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()

    // Straight from one field into the next, with nothing in between — the
    // sequence the finding describes.
    await page.getByLabel('Start year').fill('742')
    await page.getByLabel('Year suffix').fill('HB')
    await openMonths(page)
    await page.getByLabel('Month 1 name').fill('Afteryule')
    await page.getByLabel('Month 1 name').blur()

    // Read from the store, and after a reload, because the field showing what
    // you typed is not evidence that it was kept.
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await expect(page.getByLabel('Start year')).toHaveValue('742')
    await expect(page.getByLabel('Year suffix')).toHaveValue('HB')
    await openMonths(page)
    await expect(page.getByLabel('Month 1 name')).toHaveValue('Afteryule')

    const cal = await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { get: (i: string) => Promise<{ calendar?: { startYear: number; yearSuffix?: string; months: { name: string }[] } | null }> }
      }
      const c = (await db.worlds.get(id))?.calendar
      return { startYear: c?.startYear, suffix: c?.yearSuffix, first: c?.months[0].name, count: c?.months.length }
    }, worldId)
    expect(cal).toEqual({ startYear: 742, suffix: 'HB', first: 'Afteryule', count: 12 })
  })

  test('a day outside the months can be built, and reads as its name', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Reckoning')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()
    await expect(page.getByText('12 months', { exact: true })).toBeVisible()

    // Insert after January, so the new day falls at day 31 — in the middle of
    // the year, which is the whole reason appending was not enough.
    //
    // `exact`, or "entry 1" also matches entries 10, 11 and 12.
    await openMonths(page)
    await page.getByRole('button', { name: 'Insert a named day after entry 1', exact: true }).click()
    const name = page.getByLabel('Month 2 name')
    await expect(name).toHaveValue('New day')
    await name.fill("Midyear's Day")
    await name.blur()

    // It arrives already marked as outside the months, and the summary counts
    // the two kinds apart rather than calling thirteen things months.
    await expect(page.getByLabel('Entry 2 is days outside the months')).toBeChecked()
    await expect(page.getByText('366 days/year')).toBeVisible()
    await expect(page.getByText('12 months · 1 named day')).toBeVisible()

    // Stored as one flag on one entry — nothing else about the calendar moved.
    const cal = await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        worlds: { get: (i: string) => Promise<{ calendar?: { months: { name: string; days: number; intercalary?: boolean }[] } | null }> }
      }
      return (await db.worlds.get(id))?.calendar?.months ?? []
    }, worldId);
    expect(cal.length).toBe(13)
    expect(cal[1]).toEqual({ name: "Midyear's Day", days: 1, intercalary: true })
    expect(cal[0].intercalary, 'an ordinary month is untouched').toBeUndefined()

    // And it reads as a name rather than a position: a scene 31 days along
    // lands on it. The paired case is the scene before, still numbered.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        timelines: { add: (v: unknown) => Promise<unknown> }
        chapters: { add: (v: unknown) => Promise<unknown> }
        events: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      }
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now })
      await db.chapters.add({ id: 'ch', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.bulkAdd([30, 1].map((travelDays, i) => ({
        id: `ev${i}`, worldId: id, timelineId: 'tl', chapterId: 'ch',
        title: i === 0 ? 'Thirty days on' : 'The day after',
        description: '', locationMarkerId: null, involvedCharacterIds: [],
        mentionedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: i,
        travelDays, inWorldTime: null, tension: null, structureBeat: null,
        threadIds: [], status: 'idea', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })))
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline/ch`, { waitUntil: 'load' })
    const main = page.getByRole('main')
    await expect(main.getByText('Thirty days on')).toBeVisible({ timeout: 30000 })
    // Day 30 is the 31st day: the last day of January.
    await expect(main.getByText('31 January, 1')).toBeVisible()
    // Day 31 is the named day, and it carries no number.
    await expect(main.getByText("Midyear's Day, 1", { exact: true })).toBeVisible()
    await expect(main.getByText("1 Midyear's Day, 1")).toHaveCount(0)

    // And the Calendar view draws it as the one day it is rather than as a
    // month with six empty columns after it.
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible({ timeout: 30000 })
    const named = page.locator('[aria-label="Midyear\'s Day, 1"]')
    await expect(named).toHaveCount(1)
    // Its cell carries no day number — the name is the whole of the date.
    await expect(named).toHaveText("The day after")
    // Paired against an ordinary month on the same screen, whose cells are
    // still numbered and still seven across.
    await expect(page.locator('[aria-label="January 31, 1"]')).toHaveCount(1)
    const cols = await page.locator('[aria-label="January 31, 1"]').evaluate((el) =>
      getComputedStyle(el.parentElement!).gridTemplateColumns.split(' ').length)
    const namedCols = await named.evaluate((el) =>
      getComputedStyle(el.parentElement!).gridTemplateColumns.split(' ').length)
    expect(cols, 'a month is seven across').toBe(7)
    expect(namedCols, 'a single named day is one across').toBe(1)
  })

  test('drags an event to a new day to pin its in-world date', async ({ page }) => {
    test.setTimeout(90000)
    await page.goto('/')
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Dated World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // Enable the (default) calendar in world settings.
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()

    // One timeline, one chapter, one event.
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
    await page.getByPlaceholder('Scene title').fill('The gate opens')
    await page.getByRole('button', { name: 'Add Scene' }).last().click()

    // Calendar: the event sits on day 1 (in-world day 0 = 1 January, year 1).
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible({ timeout: 30000 })
    // Scoped to its day cell: the time-cursor pill in the top bar carries the
    // active scene's title too, so a page-wide match here is ambiguous whenever
    // the cursor happens to be sitting on this scene.
    const chip = page.locator('[aria-label="January 1, 1"]').getByRole('button', { name: 'The gate opens' })
    const day1 = page.locator('[aria-label="January 1, 1"]')
    const day10 = page.locator('[aria-label="January 10, 1"]')
    await expect(day1.getByRole('button', { name: 'The gate opens' })).toBeVisible()

    // Drag it to January 10.
    await chip.dragTo(day10)

    // It now lives in the January-10 cell, and no longer on January 1.
    await expect(day10.getByRole('button', { name: 'The gate opens' })).toBeVisible()
    await expect(day1.getByRole('button', { name: 'The gate opens' })).toHaveCount(0)
  })
})
