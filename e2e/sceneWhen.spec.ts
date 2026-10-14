import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The header's `When:` line (docs/records/scene-time-plan.md): days since the
 * previous scene, or a date on the book's own calendar, written where the
 * scene is written.
 */

const EARTH_2025 = {
  startYear: 2025, yearSuffix: '',
  // Monday first: 1 January 2025 was a Wednesday.
  week: { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], first: 2 },
  months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]]
    .map(([name, days]) => ({ name, days })),
}

/** Shire Reckoning: twelve months of thirty, and five days outside them. */
const SHIRE = {
  startYear: 1418, yearSuffix: '',
  week: { days: ['Sterday', 'Sunday', 'Monday', 'Trewsday', 'Hevensday', 'Mersday', 'Highday'], first: 0 },
  months: [
    { name: '2 Yule', days: 1, intercalary: true },
    ...['Afteryule', 'Solmath', 'Rethe', 'Astron', 'Thrimidge', 'Forelithe'].map((name) => ({ name, days: 30 })),
    { name: '1 Lithe', days: 1, intercalary: true },
    { name: "Midyear's Day", days: 1, intercalary: true },
    { name: '2 Lithe', days: 1, intercalary: true },
    ...['Afterlithe', 'Wedmath', 'Halimath', 'Winterfilth', 'Blotmath', 'Foreyule'].map((name) => ({ name, days: 30 })),
    { name: '1 Yule', days: 1, intercalary: true },
  ],
}

/**
 * Two scenes with Nell in both. On Earth the timeline starts on 8 October 2025
 * (day 280), as writer run 9's did, and the second scene is a day after the
 * first; in the Shire it starts on the calendar's first day.
 */
async function book(page: Page, calendar: 'earth' | 'shire'): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Short Weight')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, calendar, offset }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.worlds.update(id, { calendar })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Merrow', description: '', color: '#6366f1', dayOffset: offset, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Cold Room', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'nell', worldId: id, name: 'Nell Ashdown', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'Flat 114', 'The lift worked on alternate days.', null], ['e2', 'Custom House', 'The scales were older than the building.', 1]] as const
    let i = 0
    for (const [eid, title, text, travelDays] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: ['nell'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 6, updatedAt: now })
    }
  }, { id: worldId, calendar: calendar === 'earth' ? EARTH_2025 : SHIRE, offset: calendar === 'earth' ? 280 : 0 })
  return worldId
}

/** A scene's two time fields. */
const timeOf = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ travelDays: number | null; inWorldTime: number | null }> } }
  const e = await db.events.get(eid)
  return { travelDays: e.travelDays, inWorldTime: e.inWorldTime }
}, id)

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

/**
 * Selects a line's text — `whole` takes its line break too, to delete it — and
 * nothing else. Set on the editor, since Home and End stop where a line wraps
 * and a drag depends on where the rows fall; what replaces it is typed.
 */
async function selectLine(page: Page, text: string, whole = false) {
  await page.locator('.cm-line', { hasText: text }).first().click()
  await page.evaluate(({ text, whole }) => {
    type View = { state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } }; dispatch: (tr: unknown) => void }
    const view = (document.querySelector('.cm-content') as unknown as { cmTile: { root: { view: View } } }).cmTile.root.view
    for (let n = 1; n <= view.state.doc.lines; n++) {
      const line = view.state.doc.line(n)
      if (line.text.includes(text)) { view.dispatch({ selection: { anchor: whole ? line.from - 1 : line.from, head: line.to } }); return }
    }
    throw new Error(`no line with ${text}`)
  }, { text, whole })
}

/** Leaves the header for the second scene's prose, which is what applies it. */
const leave = (page: Page) => page.locator('.cm-line', { hasText: 'The scales were older' }).first().click()

test.describe('the When: line', () => {
  test.describe.configure({ timeout: 150_000 })

  test('a date written on it pins the scene, counted from the timeline’s start, and the Calendar has it there', async ({ page }) => {
    const worldId = await book(page, 'earth')
    await openPage(page, worldId)
    // Drawn from the records: the second scene is a day after the first; the first has no time.
    await expect(page.locator('.cm-line', { hasText: 'When:' })).toHaveCount(1, { timeout: 20_000 })
    await expect(page.locator('.cm-line', { hasText: 'When: +1 day' })).toHaveCount(1)

    await selectLine(page, 'When: +1 day')
    await page.keyboard.type('  When: 16 October 2025')
    await leave(page)
    // 16 October is day 288, the timeline's eighth; the days since are left, for if the pin comes off.
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: 1, inWorldTime: 8 })
    // Drawn back as the app writes dates.
    await expect(page.locator('.cm-line', { hasText: 'When: 16 October, 2025' })).toHaveCount(1)

    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByLabel('October 16, 2025', { exact: true })).toContainText('Custom House', { timeout: 20_000 })
    await expect(main.getByLabel('October 9, 2025', { exact: true })).not.toContainText('Custom House')
  })

  test('days since over a date take the pin off; the line deleted takes the days since', async ({ page }) => {
    const worldId = await book(page, 'earth')
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { update: (id: string, v: unknown) => Promise<unknown> } }
      await db.events.update('e2', { inWorldTime: 8 })
    })
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'When: 16 October, 2025' })).toHaveCount(1, { timeout: 20_000 })

    await selectLine(page, 'When: 16 October, 2025')
    await page.keyboard.type('  When: +3 days')
    await leave(page)
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: 3, inWorldTime: null })
    await expect(page.locator('.cm-line', { hasText: 'When: +3 days' })).toHaveCount(1)

    await selectLine(page, 'When: +3 days', true)
    await page.keyboard.press('Backspace')
    await leave(page)
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: null, inWorldTime: null })
    await expect(page.locator('.cm-line', { hasText: 'When:' })).toHaveCount(0)
    // The rest of the header stands.
    await expect(page.locator('.cm-draft-header', { hasText: 'Characters: @@Nell Ashdown' })).toHaveCount(2)
  })

  test('a date the calendar cannot read is said, and writes nothing; spelt right, it is written and the note goes', async ({ page }) => {
    const worldId = await book(page, 'earth')
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'When: +1 day' })).toHaveCount(1, { timeout: 20_000 })

    await selectLine(page, 'When: +1 day')
    await page.keyboard.type('  When: 16 Octobre 2025')
    await leave(page)
    const note = page.getByText('“16 Octobre 2025” is not a date on this book’s calendar.', { exact: false })
    await expect(note).toBeVisible({ timeout: 15_000 })
    expect(await timeOf(page, 'e2')).toEqual({ travelDays: 1, inWorldTime: null })
    // Kept as typed, to be put right on the line.
    await expect(page.locator('.cm-line', { hasText: 'When: 16 Octobre 2025' })).toHaveCount(1)

    await selectLine(page, 'When: 16 Octobre 2025')
    await page.keyboard.type('  When: 16 October 2025')
    await leave(page)
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: 1, inWorldTime: 8 })
    await expect(note).toHaveCount(0)
  })

  test('Shire Reckoning: a day outside the months, by its name', async ({ page }) => {
    const worldId = await book(page, 'shire')
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'When: +1 day' })).toHaveCount(1, { timeout: 20_000 })

    await selectLine(page, 'When: +1 day')
    await page.keyboard.type("  When: Midyear's Day 1418")
    await leave(page)
    // 2 Yule, six months of thirty, 1 Lithe: Midyear's Day is the year's 183rd day, day 182 of the clock.
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: 1, inWorldTime: 182 })
    await expect(page.locator('.cm-line', { hasText: "When: Midyear's Day, 1418" })).toHaveCount(1)
  })

  test('a scene pasted with its header keeps its date', async ({ page }) => {
    const worldId = await book(page, 'earth')
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'The scales were older' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.locator('.cm-content').evaluate((el, t) => {
      const data = new DataTransfer()
      data.setData('text/plain', t)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    }, ['## The weighing', '[', '  Characters: @@Nell Ashdown', '  When: 20 October 2025', ']', '', 'The scales again.'].join('\n'))

    const pasted = () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { toArray: () => Promise<Array<{ title: string; travelDays: number | null; inWorldTime: number | null }>> } }
      return (await db.events.toArray()).filter((e) => e.title === 'The weighing').map((e) => [e.travelDays, e.inWorldTime])
    })
    // 20 October: day 292, the timeline's twelfth.
    await expect.poll(pasted, { timeout: 30_000 }).toEqual([[null, 12]])
  })

  test('on a scene card, as on the Page', async ({ page }) => {
    const worldId = await book(page, 'earth')
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Custom House', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('[\n  Characters: @@Nell Ashdown\n  When: +1 day\n]\n\nThe scales were older than the building.', { timeout: 20_000 })

    await draft.fill('[\n  Characters: @@Nell Ashdown\n  When: Thursday 16 October\n]\n\nThe scales were older than the building.')
    await draft.blur()
    await expect.poll(() => timeOf(page, 'e2'), { timeout: 15_000 }).toEqual({ travelDays: 1, inWorldTime: 8 })
    await expect(draft).toHaveValue('[\n  Characters: @@Nell Ashdown\n  When: 16 October, 2025\n]\n\nThe scales were older than the building.', { timeout: 15_000 })
  })
})
