import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * EV-1: the expanded scene card opened roughly a dozen sections at once, so a
 * scene created a minute ago — a title and nothing else — presented its whole
 * ontology before the writer had written a sentence.
 *
 * The rule is "show what's filled": a section holding something is shown, the
 * rest collapse into one row of named chips. Nothing is hidden behind a menu or
 * a mode, and the data decides rather than a ranking someone had to invent.
 */
test.describe('Scene card disclosure', () => {
  test.describe.configure({ timeout: 120_000 })

  async function open(page: import('@playwright/test').Page) {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Disclosure')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
        string,
        { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }
      >
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.add({
        id: 'ch1', worldId, timelineId: 'tl', number: 1, title: 'One',
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })
      const base = {
        worldId, chapterId: 'ch1', timelineId: 'tl', description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
        involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
        inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      }
      await db.events.bulkAdd([
        { ...base, id: 'tracked', title: 'A tracked scene', sortOrder: 0, tags: ['ritual'], tension: 4 },
        { ...base, id: 'bare', title: 'A bare scene', sortOrder: 1, tags: [], tension: null },
      ])
    }, { worldId })

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await expect(page.getByRole('button', { name: 'Expand “A bare scene”' })).toBeVisible({ timeout: 30_000 })
  }

  const section = (page: import('@playwright/test').Page, name: string) =>
    page.getByText(name, { exact: true })

  test('a bare scene shows almost nothing; a tracked one shows what it holds', async ({ page }) => {
    await open(page)

    // ── The bare scene: the sections it does not use are not drawn. ──
    await page.getByRole('button', { name: 'Expand “A bare scene”' }).click()
    await expect(section(page, 'Description')).toBeVisible()
    await expect(section(page, 'Status')).toBeVisible()
    await expect(section(page, 'Tags'), 'an unused section should not be drawn').toHaveCount(0)
    await expect(section(page, 'Dramatic Tension')).toHaveCount(0)
    await expect(section(page, 'Mentioned')).toHaveCount(0)
    await expect(section(page, 'Story Beat')).toHaveCount(0)

    // …but every one of them is named and one click away, not buried. The chip
    // reads exactly as the section heading it opens.
    for (const label of ['Tags', 'Mentioned', 'Elapsed Time', 'Flashback', 'Story Beat', 'Dramatic Tension']) {
      await expect(page.getByRole('button', { name: `+ ${label}` }),
        `${label} should be offered as a chip`).toBeVisible()
    }
    await page.getByRole('button', { name: 'Collapse “A bare scene”' }).click()

    // ── The tracked scene: the same two sections are drawn, because it uses
    // them. Paired with the absences above, so neither half can pass alone. ──
    await page.getByRole('button', { name: 'Expand “A tracked scene”' }).click()
    await expect(section(page, 'Tags')).toBeVisible()
    await expect(section(page, 'Dramatic Tension')).toBeVisible()
    // And a section it holds is no longer offered as a chip — it is already there.
    await expect(page.getByRole('button', { name: '+ Tags' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '+ Dramatic Tension' })).toHaveCount(0)
    // One it does not hold still is.
    await expect(page.getByRole('button', { name: '+ Mentioned' })).toBeVisible()
  })

  test('a chip opens its section, and stays open', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Expand “A bare scene”' }).click()

    await expect(section(page, 'Story Beat')).toHaveCount(0)
    await page.getByRole('button', { name: '+ Story Beat' }).click()
    await expect(section(page, 'Story Beat')).toBeVisible()
    // The chip is spent — the section is on screen, so offering it again would
    // be offering something the writer already has.
    await expect(page.getByRole('button', { name: '+ Story Beat' })).toHaveCount(0)
    // Revealing one does not reveal the rest.
    await expect(section(page, 'Dramatic Tension')).toHaveCount(0)
  })

  test('editing opens the whole scene, because that is what was asked for', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Expand “A bare scene”' }).click()
    await expect(section(page, 'Dramatic Tension')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await expect(section(page, 'Tags')).toBeVisible()
    await expect(section(page, 'Dramatic Tension')).toBeVisible()
    await expect(section(page, 'Elapsed Time')).toBeVisible()
    // The chip row steps aside while editing — everything is already open.
    await expect(page.getByRole('button', { name: '+ Tags' })).toHaveCount(0)
  })
})
