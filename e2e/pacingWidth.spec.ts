import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * WRUN-14. The pacing panel is as wide as it has to be, and no wider.
 *
 * The chart is `AXIS_W + scenes × STEP`, so a three-chapter draft — the state
 * this app's target user is in — draws a few hundred pixels of it. The panel
 * was a plain block, so it stretched to the whole content column and framed
 * about a thousand pixels of nothing above the chapter list.
 *
 * Both halves are here in one file on purpose. Making the panel narrow is easy
 * and wrong on its own: on a long book the chart is thousands of pixels wide
 * and the panel must still take the full column and scroll inside it. A test
 * for the small case alone would be satisfied by a panel that is always small.
 */

async function draft(page: Page, chapters: number, scenesPer: number) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, chapters, scenesPer }: { id: string; chapters: number; scenesPer: number }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd(Array.from({ length: chapters }, (_, i) => ({
      id: `ch${i + 1}`, worldId: id, timelineId: 'tl', number: i + 1, title: `Chapter ${i + 1}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    const evs: unknown[] = []
    for (let c = 1; c <= chapters; c++) {
      for (let s = 0; s < scenesPer; s++) {
        evs.push({
          id: `ev-${c}-${s}`, worldId: id, chapterId: `ch${c}`, timelineId: 'tl',
          title: `Scene ${c}.${s}`, description: '', sortOrder: s, tags: [],
          locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
          involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
          inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
          // Rated, or the curve is not drawn and there is no chart to measure.
          tension: 3, isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
    }
    await db.events.bulkAdd(evs)
  }, { id: worldId, chapters, scenesPer })

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
}

/** The chart, the panel framing it, and the column they sit in. */
const measure = (page: Page) => page.evaluate(() => {
  const svg = document.querySelector('svg[role="img"]') as SVGElement | null
  const panel = svg?.closest('div.rounded-lg') as HTMLElement | null
  const column = panel?.parentElement as HTMLElement | null
  if (!svg || !panel || !column) return null
  return {
    chart: Math.round(svg.getBoundingClientRect().width),
    panel: Math.round(panel.getBoundingClientRect().width),
    column: Math.round(column.getBoundingClientRect().width),
  }
})

test.describe('The pacing panel fits what it is drawing', () => {
  test.describe.configure({ timeout: 240_000 })

  test('a short draft gets a short panel, not the whole column', async ({ page }) => {
    await draft(page, 3, 2)
    const m = (await measure(page))!
    expect(m, 'the pacing chart should be on screen').not.toBeNull()

    // The panel is the chart plus its tension gutter and padding — not the
    // column. Measured at 352px against a 1196px column for these six scenes.
    expect(m.panel, `panel ${m.panel}px around a ${m.chart}px chart`)
      .toBeLessThan(m.chart + 160)
    expect(m.panel, `panel ${m.panel}px in a ${m.column}px column`)
      .toBeLessThan(m.column * 0.6)
  })

  test('a long book still gets the full column, and scrolls inside it', async ({ page }) => {
    await draft(page, 20, 4)
    const m = (await measure(page))!

    // 80 scenes draw far more chart than the column can hold…
    expect(m.chart, `chart ${m.chart}px`).toBeGreaterThan(m.column)
    // …so the panel takes the column rather than overflowing the page, and the
    // chart scrolls within it. This is the half that `w-fit` alone would break.
    expect(m.panel).toBe(m.column)

    const scrolls = await page.evaluate(() => {
      const svg = document.querySelector('svg[role="img"]')
      const box = svg?.parentElement as HTMLElement | null
      return !!box && box.scrollWidth > box.clientWidth + 1
    })
    expect(scrolls, 'the chart should scroll inside the panel').toBe(true)
  })
})
