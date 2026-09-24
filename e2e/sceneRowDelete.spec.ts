import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * **TL-3's fifth site.** That review moved delete behind a ⋯ menu on the
 * chapter row, the scene card, the character header and the lore card, and
 * missed the Timeline's own scene row — where the bin sat at x=1378 with *open
 * the chapter* at x=1354, both 20×20 and 24px apart.
 *
 * Two writer runs filed it, because the guide says flatly that "nothing
 * destructive sits in the row beside the everyday controls, so there is no
 * trash icon to catch a stray click on the way to *open* or *move earlier*".
 */
test.describe('a scene row has no bin beside its everyday controls', () => {
  test.describe.configure({ timeout: 240_000 })

  test('delete is one step in, and still there', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Rows')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await dismissFirstRunGuide(page)

    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'Playback', description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
        tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await settle(page)

    // Expand the chapter so the scene rows are on screen. The row's name is the
    // whole of "Ch. 1 — One"; matching the title alone matches nothing.
    await page.getByRole('button', { name: /Ch\. 1 — One/ }).click()
    const openChapter = page.getByRole('button', { name: /Open the chapter holding Playback/ })
    await expect(openChapter).toBeVisible({ timeout: 20_000 })

    // The absence: no bare bin anywhere in the row.
    await expect(page.getByRole('button', { name: 'Delete Playback' })).toHaveCount(0)

    /*
      And the presence, in the same test: delete still exists, one step in.
      Without this half, simply deleting the control would pass.
    */
    await page.getByRole('button', { name: /More actions for Playback/ }).click()
    await page.getByRole('menuitem', { name: 'Delete scene' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('main').getByText('Playback', { exact: true })).toHaveCount(0)
    // Belt and braces: gone from the store, not merely from this render.
    expect(await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { count: () => Promise<number> }>
      return db.events.count()
    })).toBe(0)
  })
})
