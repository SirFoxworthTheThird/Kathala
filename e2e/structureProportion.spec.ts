import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The structure board used to be a flat list of equal-height rows: it showed
 * which beats were placed and in what order, but nothing about how much of the
 * book each act took. A beat sheet exists to answer "does Act 2 sag?", and a
 * twenty-two chapter book whose Act 1 is two chapters long looked exactly like
 * one whose Act 1 was ten.
 *
 * The arithmetic is unit-tested in src/lib/__tests__/structureBoard.test.ts.
 * This drives the wiring: that the ruler reaches the screen with the right
 * widths, and that the per-beat dots sit where the chapters say they should.
 */
test.describe('Structure proportion', () => {
  test.describe.configure({ timeout: 120_000 })

  /** Twenty-two chapters; beats placed to give a 2 / 12 / 8 chapter division. */
  async function seed(page: import('@playwright/test').Page, worldId: string) {
    return page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        timelines: { add: (v: Record<string, unknown>) => Promise<unknown> }
        chapters: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
        events: { bulkAdd: (v: Record<string, unknown>[]) => Promise<unknown> }
      }
      const now = Date.now()
      const timelineId = 'tl-structure'
      await db.timelines.add({
        id: timelineId, worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now,
      })
      const chapters = Array.from({ length: 22 }, (_, i) => ({
        id: `ch-${i + 1}`, worldId, timelineId, number: i + 1,
        title: `Chapter ${i + 1}`, synopsis: '', notes: '', wordGoal: null,
        createdAt: now, updatedAt: now,
      }))
      await db.chapters.bulkAdd(chapters)

      // Act 1 ends where the midpoint lands (Ch. 3); Act 3 opens at the climax
      // (Ch. 15). Climax and resolution both sit in Act 3, eight chapters apart.
      const placed: [string, number][] = [
        ['hook', 1], ['inciting-incident', 1], ['plot-point-1', 2],
        ['midpoint', 3], ['plot-point-2', 14],
        ['climax', 15], ['resolution', 22],
      ]
      await db.events.bulkAdd(placed.map(([beat, chapter], i) => ({
        id: `ev-${beat}`, worldId, chapterId: `ch-${chapter}`, timelineId,
        title: `Scene ${beat}`, description: '',
        locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
        involvedItemIds: [], tags: [], threadIds: [], motifIds: [], sortOrder: i,
        travelDays: null, inWorldTime: null, tension: null, structureBeat: beat,
        status: 'draft', povCharacterId: null, isFlashback: false,
        createdAt: now, updatedAt: now,
      })))
      return chapters.length
    }, { worldId })
  }

  test('the ruler shows how the chapters divide, and the dots where beats fall', async ({ page }) => {
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Sagging Middle')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    expect(await seed(page, worldId), 'the seeding seam should be present in an e2e build').toBe(22)

    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Structure' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('7 / 7 beats placed')).toBeVisible({ timeout: 15_000 })

    // The ruler: three bands whose widths are the acts' shares of the book.
    await expect(page.getByRole('heading', { name: 'How the book divides' })).toBeVisible()
    await expect(page.getByText('22 chapters')).toBeVisible()

    const bands = page.locator('[data-act]')
    await expect(bands).toHaveCount(3)
    await expect(bands.nth(0)).toHaveAttribute('data-share', (2 / 22).toFixed(4))
    await expect(bands.nth(1)).toHaveAttribute('data-share', (12 / 22).toFixed(4))
    await expect(bands.nth(2)).toHaveAttribute('data-share', (8 / 22).toFixed(4))

    // Measured on screen, not just in the attribute: Act 2 really is drawn wider
    // than Act 1, which is the whole point of the band.
    const widths = await bands.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
    expect(widths[1]).toBeGreaterThan(widths[0] * 4)
    expect(widths[1]).toBeGreaterThan(widths[2])

    await expect(page.getByText('Ch. 1–2 (9%)')).toBeVisible()
    await expect(page.getByText('Ch. 3–14 (55%)')).toBeVisible()
    await expect(page.getByText('Ch. 15–22 (36%)')).toBeVisible()

    // Per-beat dots. Hook is in Ch. 1 and the resolution in Ch. 22, so the two
    // sit at opposite ends of their tracks.
    const hookX = await page.locator('[data-beat-position="hook"]').evaluate(
      (el) => el.getBoundingClientRect().x - el.parentElement!.getBoundingClientRect().x
    )
    const resolutionX = await page.locator('[data-beat-position="resolution"]').evaluate(
      (el) => el.getBoundingClientRect().x - el.parentElement!.getBoundingClientRect().x
    )
    expect(resolutionX).toBeGreaterThan(hookX * 10)

    // Hook and inciting incident are both in Ch. 1, so they coincide — the thing
    // a list of equal rows could never show.
    const incitingX = await page.locator('[data-beat-position="inciting-incident"]').evaluate(
      (el) => el.getBoundingClientRect().x - el.parentElement!.getBoundingClientRect().x
    )
    expect(Math.abs(incitingX - hookX)).toBeLessThan(1)
  })

  test('the ruler holds off until each act has a beat, and says so', async ({ page }) => {
    // The opposite condition, in the same spec: with nothing placed in Act 2 or
    // Act 3 there is no division to draw, so the bands must be absent and the
    // reason present. Vacuity cannot satisfy both this test and the one above.
    await resetDB(page)

    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Just Started')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async ({ worldId }) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        timelines: { add: (v: Record<string, unknown>) => Promise<unknown> }
        chapters: { add: (v: Record<string, unknown>) => Promise<unknown> }
      }
      const now = Date.now()
      await db.timelines.add({ id: 'tl-x', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      await db.chapters.add({
        id: 'ch-x', worldId, timelineId: 'tl-x', number: 1, title: 'One',
        synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
      })
    }, { worldId })

    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: 'Structure' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Place a beat in Act 2 and one in Act 3/)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-act]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'How the book divides' })).toHaveCount(0)
  })
})
