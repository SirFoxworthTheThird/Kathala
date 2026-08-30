import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * **R13.** The relationship graph opened unreadable. Fourteen nodes at chapter
 * seven, name labels rendering at roughly 7px, and a banner saying as much:
 * *"Zoom in to read the relationship labels."* A reader's question — how is
 * this person connected to that one — cost a zoom and a pan before it could be
 * asked at all.
 *
 * `fitView` is right for a writer surveying a cast, where the whole shape is
 * the answer. It is wrong when fitting everything means reading nothing, so
 * while reading the fit is floored at the zoom the labels need: legible and
 * cropped, rather than complete and unreadable.
 *
 * Measured on the viewport transform rather than on a screenshot, because the
 * threshold in the code (`LABEL_MIN_ZOOM`) is a number and this can compare
 * against it. Inverting that condition drops the reading graph back to
 * `scale(0.302913)` and fails the first half — an earlier draft of this spec
 * passed against an unclamped build, and proved nothing.
 */

/** ReactFlow's current zoom, read off the pane it actually applies. */
const zoomOf = (page: Page) => page.evaluate(() => {
  const el = document.querySelector<HTMLElement>('.react-flow__viewport')
  const m = /scale\(([\d.]+)\)/.exec(el?.style.transform ?? '')
  return m ? Number(m[1]) : null
})

const LABEL_MIN_ZOOM = 0.55

test.describe('The relationship graph a reader opens', () => {
  test.describe.configure({ timeout: 180_000 })
  test.slow() // ReactFlow mounts a heavy canvas

  test('opens legible while reading, and keeps the survey while writing', async ({ page }) => {
    await resetDB(page)
    const worldId = await downloadLibraryBook(page, DEFAULT_BOOK)

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 60_000 })
    await settle(page)

    await expect.poll(() => zoomOf(page), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(LABEL_MIN_ZOOM)
    // The banner is the app's own admission that the labels cannot be read, so
    // its absence is the reader-facing half of the same fact.
    await expect(page.getByText('Zoom in to read the relationship labels')).toHaveCount(0)

    /*
      The pair. Turning reading mode off restores the writer's arrival — the
      whole cast fitted, small — so this cannot be passing because the graph
      happens to fit at any zoom on any world.
    */
    await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Turn off reading mode' }).click()
    await settle(page)

    await page.goto(`/#/worlds/${worldId}/relationships`, { waitUntil: 'load' })
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 60_000 })
    await settle(page)

    await expect.poll(() => zoomOf(page), { timeout: 30_000 }).toBeLessThan(LABEL_MIN_ZOOM)
    await expect(page.getByText('Zoom in to read the relationship labels')).toBeVisible()
  })
})
