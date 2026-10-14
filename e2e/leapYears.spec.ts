import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Leap years: 29 February where the year has one, and the dates after it a
 * day on — opt in, so the calendars already written keep their dates.
 */

const EARTH_2025 = {
  startYear: 2025, yearSuffix: '',
  // Monday first: 1 January 2025 was a Wednesday.
  week: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], first: 2 },
  months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]]
    .map(([name, days]) => ({ name, days })),
  leap: { month: 1, days: 1, every: 4, skip: 100, keep: 400 },
}
// From 1 January 2025: three common years, then January 2028.
const FEB_29_2028 = 365 * 3 + 31 + 28

/** Two scenes: the first on the calendar's first day, the second pinned to 29 February 2028. */
async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Leap')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, calendar, pin }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.worlds.update(id, { calendar })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'February', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'ada', worldId: id, name: 'Ada Wren', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'New Year', 'The bells went on too long.', null], ['e2', 'The Leap Day', 'An extra day, and nobody knew what to do with it.', pin]] as const
    let i = 0
    for (const [eid, title, text, inWorldTime] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: ['ada'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 8, updatedAt: now })
    }
  }, { id: worldId, calendar: EARTH_2025, pin: FEB_29_2028 })
  return worldId
}

const pinOf = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ inWorldTime: number | null }> } }
  return (await db.events.get(eid)).inWorldTime
}, id)

test.describe('leap years', () => {
  test.describe.configure({ timeout: 150_000 })

  test('the Calendar has 29 February 2028, and 1 March under its Wednesday', async ({ page }) => {
    const worldId = await book(page)
    // Over three years the Calendar draws only the months with scenes in them: one in March 2028, and one in February 2027.
    await page.evaluate(async ({ id, march1, feb3 }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      for (const [eid, title, inWorldTime, sortOrder] of [['e3', 'March Comes In', march1, 3], ['e4', 'A Year Before', feb3, 4]] as const) {
        await db.events.add({
          id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder,
          tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], travelDays: null, inWorldTime, structureBeat: null, status: 'draft',
          povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
    }, { id: worldId, march1: FEB_29_2028 + 1, feb3: 365 * 2 + 31 + 2 })
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByLabel('February 29, 2028', { exact: true })).toContainText('The Leap Day', { timeout: 20_000 })
    const march = main.locator('div.rounded-lg', { has: page.getByRole('heading', { name: 'March 2028', exact: true }) })
    // 1 March 2028 was a Wednesday: third column. Without the leap day it would be a Tuesday's.
    await expect(march.locator('div.grid.gap-1').last()).toHaveAttribute('data-week-start', '2', { timeout: 20_000 })
    await expect(march.getByLabel('March 1, 2028', { exact: true })).toContainText('March Comes In')
    // 2027's February has no 29th.
    const feb2027 = main.locator('div.rounded-lg', { has: page.getByRole('heading', { name: 'February 2027', exact: true }) })
    await expect(feb2027.getByLabel('February 28, 2027', { exact: true })).toHaveCount(1)
    await expect(feb2027.getByLabel('February 29, 2027', { exact: true })).toHaveCount(0)
  })

  test('a pin on 29 February moved to a common year takes the 28th', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'An extra day' }).first().click()
    const scene = page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'This scene' })
    await scene.getByRole('button', { name: 'More about this scene' }).click()
    const pinned = scene.getByRole('group', { name: 'Pinned date' })
    await expect(pinned.getByLabel('Day', { exact: true })).toHaveValue('29')
    await expect(pinned.locator('[data-weekday]')).toHaveText('Tuesday')

    await pinned.getByLabel('Year', { exact: true }).fill('2027')
    await expect.poll(() => pinOf(page, 'e2')).toBe(365 * 2 + 31 + 27)
    await expect(pinned.getByLabel('Day', { exact: true })).toHaveValue('28')
  })

  test('When: 29 February where the year has it; said where it has not', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    const line = page.locator('.cm-line', { hasText: 'When: 29 February, 2028' })
    await expect(line).toHaveCount(1, { timeout: 20_000 })

    const replace = async (from: string, to: string) => {
      await page.locator('.cm-line', { hasText: from }).first().click()
      await page.evaluate((from) => {
        type View = { state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } }; dispatch: (tr: unknown) => void }
        const view = (document.querySelector('.cm-content') as unknown as { cmTile: { root: { view: View } } }).cmTile.root.view
        for (let n = 1; n <= view.state.doc.lines; n++) {
          const l = view.state.doc.line(n)
          if (l.text.includes(from)) { view.dispatch({ selection: { anchor: l.from, head: l.to } }); return }
        }
      }, from)
      await page.keyboard.type(to)
      await page.locator('.cm-line', { hasText: 'An extra day' }).first().click()
    }

    await replace('When: 29 February, 2028', '  When: 29 February 2027')
    await expect(page.getByText('February has 28 days in 2027, so “29 February 2027” is not a date in it.', { exact: false })).toBeVisible({ timeout: 15_000 })
    expect(await pinOf(page, 'e2')).toBe(FEB_29_2028)

    // 1 March 2028: the day after the leap day.
    await replace('When: 29 February 2027', '  When: 1 March 2028')
    await expect.poll(() => pinOf(page, 'e2'), { timeout: 15_000 }).toBe(FEB_29_2028 + 1)
  })

  test('Settings: a new Earth calendar has Earth’s leap years; a world’s own shape has none until given a rule', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Calendars')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    const stored = () => page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { get: (i: string) => Promise<{ calendar?: { leap?: unknown } | null }> } }
      return (await db.worlds.get(id)).calendar?.leap ?? null
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    const leap = page.getByRole('group', { name: 'Leap years' })

    // Earth: the Gregorian rule.
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect.poll(stored).toEqual({ month: 1, days: 1, every: 4, skip: 100, keep: 400 })
    await expect(leap.getByLabel('A leap year every')).toHaveValue('4')
    await expect(leap).toContainText('365 days in a common year, 366 in a leap year.')
    await expect(leap).toContainText('The first leap year from the story’s start is 4.')
    // Taken off, and given back from the button an Earth year has.
    await leap.getByRole('button', { name: 'Remove the leap rule' }).click()
    await expect.poll(stored).toBeNull()
    await leap.getByRole('button', { name: 'Earth’s leap years' }).click()
    await expect.poll(stored).toEqual({ month: 1, days: 1, every: 4, skip: 100, keep: 400 })

    // Four seasons: none, until one is added.
    await page.getByRole('button', { name: 'Disable calendar' }).click()
    await page.getByRole('button', { name: /Four seasons/ }).click()
    await expect(leap).toContainText('No leap years: every year is 364 days.')
    // Not Earth's year, so not Earth's rule to offer.
    await expect(leap.getByRole('button', { name: 'Earth’s leap years' })).toHaveCount(0)
    expect(await stored()).toBeNull()
    await leap.getByRole('button', { name: 'Add a leap rule' }).click()
    await expect.poll(stored).toEqual({ month: 0, days: 1, every: 4 })
    await expect(leap).toContainText('364 days in a common year, 365 in a leap year.')
    await leap.getByRole('button', { name: 'Remove the leap rule' }).click()
    await expect.poll(stored).toBeNull()
  })
})
