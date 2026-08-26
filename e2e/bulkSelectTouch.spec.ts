import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * HB-2c. The scene checkbox is the smallest target in the app.
 *
 * Measured on the shipped build at 390x667 with touch on: `EventRow`'s checkbox
 * is **12x12**, `ChapterRow`'s select-all is **14x14**, and consecutive scene
 * rows are **40px** apart. `.pw-tap` — the app's existing answer, a transparent
 * 44x44 overlay — cannot be used as-is, because at a 40px pitch two of them
 * overlap by 4px and a tap in that band selects the wrong scene.
 *
 * `.pw-tap-row` is 24x36: the width of the gutter, and 4px inside the pitch. The
 * numbers are asserted here rather than in a comment, so the day the row's
 * density changes this goes red instead of quietly overlapping.
 *
 * Note what this spec is *not* about. HB-2b claimed these checkboxes were
 * invisible and unreachable on touch; they never were, because `index.css`
 * forces hover-revealed controls visible on a hover-less pointer. The first
 * test below pins that down, so the premise cannot be believed again.
 */
test.use({ viewport: { width: 390, height: 667 }, hasTouch: true })

const SCENES = ['The gate opens', 'The road south', 'Rain on the ford']

async function timelineWithScenes(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Highbarrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  // A world created with no timeline arms the first-run wizard, which would sit
  // over the list this spec measures.
  await dismissFirstRunGuide(page)

  await page.evaluate(async ({ id, scenes }: { id: string; scenes: string[] }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Crossing', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.bulkAdd(scenes.map((title, i) => ({
      id: `ev${i + 1}`, worldId: id, chapterId: 'ch1', timelineId: 'tl',
      title, description: '', sortOrder: i, tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })))
  }, { id: worldId, scenes: SCENES })

  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  // Open the chapter, so its scene rows are rendered. Scoped to `main` because
  // the chapter bar along the bottom is titled with chapters too, and tapped
  // rather than clicked so no hover is left behind on the row.
  await page.getByRole('main').getByRole('button', { name: /^Ch\. 1/ }).first().tap()
  await expect(page.getByRole('checkbox', { name: `Select scene ${SCENES[0]}` })).toHaveCount(1)
  await page.mouse.move(2, 2)
}

/**
 * Centre of each checkbox's wrapper, the row pitch the overlay must fit inside,
 * and the overlay itself — read straight off the `::after`, which
 * `getComputedStyle` will report for a pseudo-element.
 */
async function geometry(page: Page) {
  return await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[aria-label^="Select scene "]')] as HTMLElement[]
    const wraps = inputs.map((i) => i.parentElement as HTMLElement)
    const rects = wraps.map((w) => w.getBoundingClientRect())
    const after = wraps[0] ? getComputedStyle(wraps[0], '::after') : null
    return {
      centres: rects.map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })),
      boxHeight: rects[0]?.height ?? 0,
      pitch: rects.length > 1 ? rects[1].y - rects[0].y : 0,
      overlay: { w: parseFloat(after?.width ?? '0'), h: parseFloat(after?.height ?? '0') },
    }
  })
}

const toolbar = (page: Page) => page.getByText(/\d+ scenes? selected/)

test.describe('The scene checkbox is tappable on a phone', () => {
  test.describe.configure({ timeout: 180_000 })

  test('it is showing and live at rest, with no hover anywhere', async ({ page }) => {
    await timelineWithScenes(page)

    // The correction to HB-2b, pinned: `group-hover` never fires here, and the
    // checkbox is visible and interactive regardless.
    const state = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label^="Select scene "]')
      const wrap = input?.parentElement as HTMLElement | null
      if (!wrap) return 'no checkbox'
      const cs = getComputedStyle(wrap)
      return `${cs.opacity} / ${cs.pointerEvents} / hover:${wrap.matches(':hover')}`
    })
    expect(state).toBe('1 / auto / hover:false')
  })

  test('a tap past the box still lands on it, and not on the row below', async ({ page }) => {
    await timelineWithScenes(page)
    const { centres, boxHeight, pitch, overlay } = await geometry(page)

    // The measurement this fix is sized from. If the row gets denser than the
    // overlay, the assertions below stop meaning what they say.
    expect(boxHeight, `the checkbox is ${boxHeight}px`).toBeLessThan(20)
    expect(pitch, `rows are ${pitch}px apart`).toBe(40)

    // The upper bound, stated as the property rather than the number: two
    // neighbouring overlays must not meet. Behaviour alone cannot guard this —
    // where they overlap, the later row simply wins and a tap there still
    // selects *a* row, so an oversized overlay reads as working right up until
    // it selects the wrong scene. A 44px overlay (`.pw-tap`, the obvious thing
    // to reach for) fails here.
    expect(overlay.h, `the overlay is ${overlay.h}px in a ${pitch}px row`).toBeLessThan(pitch)
    expect(overlay.h, 'and is meaningfully bigger than the box it covers').toBeGreaterThan(boxHeight * 2)

    // Presence: 16px below the centre — outside the 12px box, inside the 36px
    // overlay, and deliberately outside what the browser would have rescued on
    // its own. Chromium snaps a near-miss to a nearby target, and measured on
    // this build it reaches +14: without the overlay, +8 through +14 still
    // select this row, and +16 through +24 select **nothing at all**. So a test
    // written at +14 passes with the fix removed — this one is at +16 because
    // that is where the fix is the only thing doing the work.
    await page.touchscreen.tap(centres[0].x, centres[0].y + 16)

    // Absence, in the same test and the one that matters: the enlarged target
    // must not have reached into the row below it. A count of exactly one says
    // both halves at once.
    await expect(toolbar(page)).toHaveText('1 scene selected')
    await expect(page.getByRole('checkbox', { name: `Select scene ${SCENES[0]}` })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: `Select scene ${SCENES[1]}` })).not.toBeChecked()
  })

  test('the near-miss selects the row it belongs to, not its neighbour', async ({ page }) => {
    await timelineWithScenes(page)
    const { centres } = await geometry(page)

    // Reaching *up* from the second row: 16px above its centre is still its own
    // target, and must not be read as the first row's. Same 16 as above, and for
    // the same reason — inside the overlay, past what the browser rescues.
    await page.touchscreen.tap(centres[1].x, centres[1].y - 16)

    await expect(page.getByRole('checkbox', { name: `Select scene ${SCENES[1]}` })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: `Select scene ${SCENES[0]}` })).not.toBeChecked()
  })

  test("the chapter's select-all is left small on purpose, and still works", async ({ page }) => {
    await timelineWithScenes(page)

    // It looks like the same problem — 14px — but the header wraps on a phone
    // and the chapter title button lands just below it, so the overlay the
    // scene rows get would cover the button's top edge. This is the measurement
    // that decision rests on; if the header stops wrapping, it should be
    // revisited, and this goes red rather than staying a comment nobody checks.
    const m = await page.evaluate(() => {
      const input = document.querySelector('input[aria-label^="Select every scene"]')
      const wrap = input!.parentElement as HTMLElement
      const header = wrap.parentElement as HTMLElement
      const title = [...header.querySelectorAll('button')].find((b) => /^Ch\./.test(b.textContent ?? ''))!
      const w = wrap.getBoundingClientRect()
      const t = title.getBoundingClientRect()
      return { boxBottom: w.bottom, titleTop: t.top, height: w.height }
    })
    expect(m.height, `the select-all is ${m.height}px`).toBeLessThan(20)
    expect(m.titleTop - m.boxBottom,
      'the chapter title sits directly under the select-all, which is why it gets no overlay')
      .toBeLessThan(18)

    // Small, but not broken: a tap on the box itself still selects the chapter.
    await page.getByRole('checkbox', { name: /^Select every scene/ }).tap()
    await expect(toolbar(page)).toHaveText(`${SCENES.length} scenes selected`)
  })
})
