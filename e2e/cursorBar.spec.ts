import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * W-1 — where the time cursor's own control belongs.
 *
 * The finding names Corkboard and Structure, "the screens most about story
 * order", and points out that the top-bar pill still shows a chapter on them
 * while the bar is gone. Measuring which screens actually read `activeEventId`
 * inverted it: the Arc grid, the Lore roster and the Calendar all answer to the
 * cursor and all hid its control, which is the worse case. Corkboard and
 * Structure read nothing at all — so they were given something to read.
 */

const SPEC = JSON.stringify({
  world: { name: 'Aethelgard' },
  characters: [{ name: 'Kestrel' }],
  chapters: [{
    title: 'Landfall',
    events: [
      { id: 'e1', title: 'The wreck', characters: ['Kestrel'], beat: 'hook' },
      { id: 'e2', title: 'The harbour', characters: ['Kestrel'], beat: 'midpoint' },
    ],
  }],
  lore: [{ title: 'The Salt Accord', body: 'A treaty nobody honours.' }],
})

async function worldFromSpec(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Generate World from AI' }).first().click()
  await page.getByLabel('Story spec JSON').fill(SPEC)
  await page.getByRole('button', { name: 'Import world', exact: true }).click()
  await expect(page).toHaveURL(/#\/worlds\//)
  return page.url().split('/worlds/')[1].split('/')[0]
}

/** The chapter bar itself — the cursor's main control, not the top-bar pill. */
const bar = (page: Page) => page.locator('[data-chapter-bar]')

test.describe("The time cursor's control follows the cursor", () => {
  test.describe.configure({ timeout: 150_000 })

  test('W-1: the bar is on the story screens and off the two without a moment in them', async ({ page }) => {
    const worldId = await worldFromSpec(page)

    // Presence: every screen whose content answers to the cursor. Three of
    // these — arc, lore, calendar — read `activeEventId` and hid the control.
    for (const path of ['timeline', 'corkboard', 'structure', 'arc', 'calendar', 'lore', 'maps']) {
      await page.goto(`/#/worlds/${worldId}/${path}`, { waitUntil: 'load' })
      await expect(bar(page), `bar missing on /${path}`).toBeVisible({ timeout: 20_000 })
    }

    // Absence, in the same test: the dashboard and settings have no moment in
    // them, so vacuity cannot satisfy both halves.
    for (const path of ['', 'settings']) {
      await page.goto(`/#/worlds/${worldId}/${path}`, { waitUntil: 'load' })
      await settle(page)
      await expect(bar(page), `bar should not be on /${path}`).toHaveCount(0)
    }
  })

  test('EV-7: one chapter fills the track instead of leaving a stub in it', async ({ page }) => {
    const worldId = await worldFromSpec(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
    await expect(bar(page)).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(600)

    /** The scrubber's chapter segments, and the track they sit in. */
    const measure = () => page.evaluate(() => {
      const el = document.querySelector('[data-chapter-bar]')!
      const scroller = Array.from(el.querySelectorAll('div'))
        .find((d) => getComputedStyle(d).overflowX === 'auto')!
      const kids = Array.from(scroller.children) as HTMLElement[]
      return {
        track: Math.round(scroller.clientWidth),
        overflowing: scroller.scrollWidth > scroller.clientWidth + 1,
        segments: kids.map((k) => ({
          w: Math.round(k.getBoundingClientRect().width),
          clipped: (() => {
            const label = k.querySelector('div')!
            return label.scrollWidth > label.clientWidth + 1
          })(),
        })),
      }
    })

    // A single chapter used to draw a 48px stub in a 1300px bar, its title cut
    // to "1 · L…" and the rail short enough that it and its one tick read as a
    // clipped "+". It takes the track now, and the title is whole.
    const one = await measure()
    expect(one.segments.length).toBe(1)
    expect(one.segments[0].w, `segment ${one.segments[0].w}px in a ${one.track}px track`)
      .toBeGreaterThan(one.track * 0.9)
    expect(one.segments[0].clipped, 'the chapter title should not be truncated').toBe(false)

    // The paired read, on the same screen: with more chapters than fit, the
    // segments hold their minimum and the track scrolls, exactly as before —
    // so this cannot pass by segments simply always being enormous.
    await page.evaluate(async (worldId) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        timelines: { toArray: () => Promise<{ id: string }[]> }
        chapters: { bulkAdd: (v: unknown[]) => Promise<unknown> }
        events: { bulkAdd: (v: unknown[]) => Promise<unknown> }
      }
      const [tl] = await db.timelines.toArray()
      const now = Date.now()
      await db.chapters.bulkAdd(Array.from({ length: 40 }, (_, i) => ({
        id: `bulk-ch${i}`, worldId, timelineId: tl.id, number: i + 2,
        title: `Chapter ${i + 2}`, synopsis: '', notes: '', wordGoal: null,
        createdAt: now, updatedAt: now,
      })))
      await db.events.bulkAdd(Array.from({ length: 40 }, (_, i) => ({
        id: `bulk-ev${i}`, worldId, timelineId: tl.id, chapterId: `bulk-ch${i}`,
        title: `Scene ${i + 2}`, description: '', locationMarkerId: null,
        involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        tags: [], sortOrder: 0, travelDays: null, inWorldTime: null, tension: null,
        structureBeat: null, threadIds: [], status: 'idea', povCharacterId: null,
        isFlashback: false, createdAt: now, updatedAt: now,
      })))
    }, worldId)

    await expect
      .poll(async () => (await measure()).segments.length, { timeout: 15_000 })
      .toBe(41)
    const many = await measure()
    expect(many.overflowing, 'a full book still scrolls').toBe(true)
    expect(many.segments[0].w, 'and each segment keeps its floor').toBeLessThan(one.segments[0].w)
    expect(many.segments[0].w).toBeGreaterThan(30)
  })

  test('W-1: the corkboard and the structure board mark the scene the cursor is on', async ({ page }) => {
    const worldId = await worldFromSpec(page)

    // A control that moved nothing would be worse than its absence, so both
    // screens read the cursor now. Drive it from the bar itself.
    await page.goto(`/#/worlds/${worldId}/corkboard`, { waitUntil: 'load' })
    await expect(bar(page)).toBeVisible({ timeout: 20_000 })

    // Absence first: with the cursor on "all chapters" nothing is marked.
    await expect(page.getByRole('main').locator('[aria-current="true"]')).toHaveCount(0)

    await bar(page).getByTitle('The wreck', { exact: true }).click()
    const marked = page.getByRole('main').locator('[aria-current="true"]')
    await expect(marked).toHaveCount(1, { timeout: 15_000 })
    await expect(marked).toContainText('The wreck')

    // The same cursor, the other board — and it marks the beat holding that
    // scene rather than the same card twice.
    await page.goto(`/#/worlds/${worldId}/structure`, { waitUntil: 'load' })
    const beat = page.getByRole('main').locator('li[aria-current="true"]')
    await expect(beat).toHaveCount(1, { timeout: 20_000 })
    await expect(beat).toContainText('The wreck')

    // Moving the cursor moves the mark, so neither assertion is reading a
    // highlight that was simply always on the first row.
    await bar(page).getByTitle('The harbour', { exact: true }).click()
    await expect(page.getByRole('main').locator('li[aria-current="true"]'))
      .toContainText('The harbour', { timeout: 15_000 })
  })
})
