import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * ST-2: structure rows are ~1400px wide with content at both ends and nothing
 * between. The middle was not empty by accident — the beat's name and hint took
 * `flex-1` and swallowed all the slack, while the position track, the one
 * element on the row that reads better the wider it is, was pinned at 112px.
 *
 * So the fix is not "add something to the middle" but "give the middle to the
 * thing that wanted it". Measured as geometry: the track has to occupy the
 * centre of the row and grow with it.
 */
test.describe('Structure rows use their width', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the position track takes the middle rather than leaving it empty', async ({ page }) => {
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Structure')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    // Chapters and scenes, with one scene tagged to a beat so a row has a
    // position to draw. Without that the track is empty and its width says
    // nothing.
    const seeded = await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        timelines: { add: (v: unknown) => Promise<unknown> }
        chapters: { bulkAdd: (v: unknown[]) => Promise<unknown> }
        events: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      }
      const now = Date.now()
      await db.timelines.add({ id: 'tl', worldId, name: 'Main', description: '', color: '#6366f1', createdAt: now })
      await db.chapters.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
        id: `ch${i}`, worldId, timelineId: 'tl', number: i + 1, title: `Chapter ${i + 1}`,
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })))
      await db.events.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
        id: `ev${i}`, worldId, timelineId: 'tl', chapterId: `ch${i}`,
        title: `Scene ${i + 1}`, description: '', locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null,
        // The middle scene carries a beat, so one row has a placed position.
        structureBeat: i === 3 ? 'midpoint' : null,
        threadIds: [], status: 'idea', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })))
      return 6
    }, worldId)
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(6)

    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await settleNav(page)
    await expect(page.locator('[data-beat-track]').first()).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(800)

    const wide = await page.evaluate(() => {
      const track = document.querySelector('[data-beat-track]')!
      const row = track.closest('li')!
      const t = track.getBoundingClientRect()
      const r = row.getBoundingClientRect()
      const label = row.querySelector('div')!.getBoundingClientRect()
      return {
        row: Math.round(r.width),
        track: Math.round(t.width),
        label: Math.round(label.width),
        // Does the track actually span the row's centre, or sit off to one side
        // with the gap beside it?
        spansCentre: t.left < r.left + r.width / 2 && t.right > r.left + r.width / 2,
      }
    })

    expect(wide.spansCentre, `track ${wide.track}px in a ${wide.row}px row`).toBe(true)
    // It used to be 112px whatever the row was. A quarter of the row is well
    // clear of that at this width and well under "the track is the row".
    expect(wide.track).toBeGreaterThan(wide.row / 4)
    // The track and the beat's name share the slack evenly, which is the point:
    // the middle belongs to one of them rather than to nothing. Measured at
    // 1600px, both settle at 406px where the track used to be 112.
    expect(
      wide.track,
      `track ${wide.track}px vs label ${wide.label}px`,
    ).toBeGreaterThan(wide.label / 2)

    // The paired read: narrow the window and the track gives the space back
    // rather than forcing the row to scroll. Same locator, opposite direction,
    // so neither half can pass by the track simply being enormous.
    await page.setViewportSize({ width: 900, height: 900 })
    await page.waitForTimeout(800)
    const narrow = await page.evaluate(() => {
      const track = document.querySelector('[data-beat-track]')!
      const row = track.closest('li')!
      return {
        row: Math.round(row.getBoundingClientRect().width),
        track: Math.round(track.getBoundingClientRect().width),
      }
    })
    expect(narrow.row).toBeLessThan(wide.row)
    expect(narrow.track).toBeLessThan(wide.track)
    expect(narrow.track, 'it should still be a track, not a dot').toBeGreaterThan(50)
  })
})
