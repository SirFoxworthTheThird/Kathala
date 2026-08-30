import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * HB-5. The Highbarrow review:
 *
 * > *"Five events without elapsed or pinned-day data all appeared on January 1…
 * > The page did not call out that most events were using a default date. The
 * > calendar looks authoritative even when it mostly reflects missing data."*
 *
 * The stacking is right — scenes with nothing said about their timing *do*
 * happen on the same day as the one before. What was missing was any sign of
 * which dates the writer chose and which the clock filled in.
 *
 * Which events count as provisional is unit-tested in
 * `src/lib/__tests__/inWorldTime.test.ts`; this drives the screen, and pairs
 * the summary's presence against its absence once the timings are stated.
 */

async function datedWorld(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, {
        add: (v: unknown) => Promise<unknown>
        bulkAdd: (v: unknown[]) => Promise<unknown>
        update: (id: string, changes: object) => Promise<unknown>
      }>
    const now = Date.now()
    await db.timelines.add({
      id: 'tl1', worldId: id, name: 'Main', description: '',
      color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now,
    })
    await db.chapters.add({
      id: 'ch1', worldId: id, timelineId: 'tl1', number: 1, title: 'Chapter 1',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    const base = {
      worldId: id, chapterId: 'ch1', timelineId: 'tl1', description: '', tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    }
    // One that starts the clock, one that states two days, and three that say
    // nothing at all — the shape the review met.
    await db.events.bulkAdd([
      { ...base, id: 'ev0', title: 'The wreck', sortOrder: 0 },
      { ...base, id: 'ev1', title: 'A letter arrives', sortOrder: 1, travelDays: 2 },
      { ...base, id: 'ev2', title: 'The gate opens', sortOrder: 2 },
      { ...base, id: 'ev3', title: 'Seven specialists return', sortOrder: 3 },
      { ...base, id: 'ev4', title: 'The compact is broken', sortOrder: 4 },
    ])
    await db.worlds.update(id, {})
  }, worldId)

  // The calendar is off by default; its own empty state turns it on.
  await page.goto(`/#/worlds/${worldId}/calendar`)
  await page.getByRole('button', { name: 'Enable calendar' }).click({ timeout: 30_000 })
  await page.waitForTimeout(1200)
  return worldId
}

const summary = (page: Page) => page.getByText(/no timing yet/)

test.describe('The calendar says which dates nobody chose', () => {
  test.describe.configure({ timeout: 180_000 })

  test('counts the scenes with no timing, and marks each of them', async ({ page }) => {
    await datedWorld(page)

    // Three of the five: the first starts the clock and the second states two
    // days, so neither is a gap.
    await expect(summary(page)).toBeVisible()
    await expect(page.getByText(/3 scenes have no timing yet/)).toBeVisible()

    // Per-scene, not only in aggregate — the review's complaint was that an
    // individual card looked as authoritative as any other.
    const marks = page.getByRole('main').getByText(', no timing set')
    await expect(marks).toHaveCount(3)
  })

  test('and says nothing once every scene is timed', async ({ page }) => {
    const worldId = await datedWorld(page)
    await expect(summary(page)).toBeVisible()

    // Absence paired with presence, in the run above and here: stating the
    // timings must take the warning away, or it is just decoration.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { update: (id: string, changes: object) => Promise<unknown> } }
      for (const id of ['ev2', 'ev3', 'ev4']) await db.events.update(id, { travelDays: 1 })
    })

    await expect(summary(page)).toHaveCount(0)
    await expect(page.getByRole('main').getByText(', no timing set')).toHaveCount(0)
    // …and the scenes are all still on the calendar, just properly dated now.
    await expect(page.getByRole('main').getByRole('button', { name: 'The gate opens' })).toBeVisible()
    void worldId
  })

  test('a scene pinned to a day is not a gap', async ({ page }) => {
    await datedWorld(page)
    await expect(page.getByText(/3 scenes have no timing yet/)).toBeVisible()

    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.events.update('ev2', { inWorldTime: 40 })
    })

    // A pin states the date as surely as elapsed days do.
    await expect(page.getByText(/2 scenes have no timing yet/)).toBeVisible()
  })
})
