import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Eras (docs/records/scene-time-plan.md, Part 2): years that count down to a
 * turning point and up after it — BBY and ABY, BC and AD.
 */

/** A year of two thirty-day months, so a year is 60 days. */
const MONTHS = [{ name: 'Harvest', days: 30 }, { name: 'Frost', days: 30 }]
const STAR_WARS = {
  startYear: -19, yearSuffix: '', months: MONTHS,
  eras: [{ label: 'BBY', counts: 'down', first: 1 }, { label: 'ABY', start: 0, counts: 'up', first: 0 }],
}

/** A book that begins in 19 BBY, and a second scene a year later. */
async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Kessel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ({ id, calendar }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; update: (id: string, v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.worlds.update(id, { calendar })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'The Run', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Spice', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'han', worldId: id, name: 'Tam Orrow', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The Maw', 'The ship came out of the dark wrong.', null], ['e2', 'Kessel Docks', 'The docks smelled of coolant.', 60]] as const
    let i = 0
    for (const [eid, title, text, travelDays] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: ['han'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 7, updatedAt: now })
    }
  }, { id: worldId, calendar: STAR_WARS })
  return worldId
}

const pinOf = (page: Page, id: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ inWorldTime: number | null }> } }
  return (await db.events.get(eid)).inWorldTime
}, id)

test.describe('eras', () => {
  test.describe.configure({ timeout: 150_000 })

  test('the Calendar counts down to the turning point: 19 BBY, then 18 BBY a year later', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/calendar`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Harvest 19 BBY', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('heading', { name: 'Harvest 18 BBY', exact: true })).toBeVisible()
    // Not counting up from it, as one count with a suffix would.
    await expect(main.getByRole('heading', { name: 'Harvest 20 BBY', exact: true })).toHaveCount(0)
    await expect(main.getByLabel('Harvest 1, 18 BBY', { exact: true })).toContainText('Kessel Docks')
  })

  test('a pin picks its year in an era', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'The docks smelled' }).first().click()
    const scene = page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'This scene' })
    await scene.getByRole('button', { name: 'More about this scene' }).click()
    const pinned = scene.getByRole('group', { name: 'Pinned date' })
    await pinned.getByRole('button', { name: 'Pin to a date' }).click()
    // From the date the scene is on: 1 Harvest, 18 BBY.
    await expect(pinned.getByLabel('Year', { exact: true })).toHaveValue('18')
    await expect(pinned.getByLabel('Year era', { exact: true })).toHaveValue('0')
    await expect.poll(() => pinOf(page, 'e2')).toBe(60)

    // 4 ABY: the turning point is 19 years after the start, and four more after it.
    await pinned.getByLabel('Year era', { exact: true }).selectOption({ label: 'ABY' })
    await pinned.getByLabel('Year', { exact: true }).fill('4')
    await expect.poll(() => pinOf(page, 'e2')).toBe((19 + 4) * 60)
    await expect(pinned.getByLabel('Year', { exact: true })).toHaveValue('4')
  })

  test('When: with an era, read and drawn back in it', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.locator('.cm-line', { hasText: 'When: +60 days' })).toHaveCount(1, { timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'When: +60 days' }).first().click()
    await page.evaluate(() => {
      type View = { state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } }; dispatch: (tr: unknown) => void }
      const view = (document.querySelector('.cm-content') as unknown as { cmTile: { root: { view: View } } }).cmTile.root.view
      for (let n = 1; n <= view.state.doc.lines; n++) {
        const line = view.state.doc.line(n)
        if (line.text.includes('When: +60 days')) { view.dispatch({ selection: { anchor: line.from, head: line.to } }); return }
      }
    })
    await page.keyboard.type('  When: 4 Harvest 18 BBY')
    await page.locator('.cm-line', { hasText: 'The docks smelled' }).first().click()
    await expect.poll(() => pinOf(page, 'e2'), { timeout: 15_000 }).toBe(63)
    await expect(page.locator('.cm-line', { hasText: 'When: 4 Harvest, 18 BBY' })).toHaveCount(1)
  })

  test('Settings: BC and AD on an Earth calendar; the start year in an era; the suffix gives way to the eras and comes back', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Augustus')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await page.getByLabel('Start year', { exact: true }).fill('14')
    const eras = page.getByRole('group', { name: 'Eras' })
    // Before: a suffix, and no era to pick.
    await expect(page.getByLabel('Year suffix')).toBeVisible()
    await expect(page.getByLabel('Start year era', { exact: true })).toHaveCount(0)

    await eras.getByRole('button', { name: 'BC and AD' }).click()
    const stored = () => page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { get: (i: string) => Promise<{ calendar?: { startYear: number; eras?: Array<{ label: string }> } }> } }
      const cal = (await db.worlds.get(id)).calendar
      return { startYear: cal?.startYear, eras: cal?.eras?.map((e) => e.label) ?? null }
    }, worldId)
    // 14 is now 14 AD: nothing moved, it is only said.
    await expect.poll(stored).toEqual({ startYear: 14, eras: ['BC', 'AD'] })
    await expect(page.getByLabel('Start year era', { exact: true })).toHaveValue('1')
    await expect(page.getByLabel('Year suffix')).toHaveCount(0)
    await expect(eras).toContainText('The story begins in 14 AD.')

    // 44 BC is the year inside -43: there is no year 0.
    await page.getByLabel('Start year era', { exact: true }).selectOption({ label: 'BC' })
    await page.getByLabel('Start year', { exact: true }).fill('44')
    await expect.poll(stored).toEqual({ startYear: -43, eras: ['BC', 'AD'] })
    await expect(eras).toContainText('The story begins in 44 BC.')

    await eras.getByRole('button', { name: 'Remove the eras' }).click()
    await expect.poll(stored).toEqual({ startYear: -43, eras: null })
    await expect(page.getByLabel('Year suffix')).toBeVisible()
  })
})
