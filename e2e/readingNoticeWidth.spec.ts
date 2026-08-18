import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * F-5: the notice that explains reading mode collapsed into a ribbon.
 *
 * The dashboard's reading notice lays an icon, a two-line explanation and a
 * group of links out on one wrapping row. The explanation carried `min-w-0` —
 * the reflex for a flex child — which let it shrink to nothing rather than
 * pushing the links onto a line of their own. Measured on the built app before
 * the fix: a **24px** column at 430 and **8px** at 414, an aside 748px tall
 * instead of 138, with the heading drawn underneath a link.
 *
 * **Measuring page overflow cannot see this.** `documentElement.scrollWidth`
 * equalled `clientWidth` at every width in both states — the page was never too
 * wide, one column inside it was too narrow. So this spec measures the column.
 */

const WIDTHS = [320, 360, 390, 414, 430, 640] as const

/** The narrowest this reads at. The floor in the component is 13rem = 208px. */
const READABLE = 180
/** Before the fix the aside was 748px tall at 414 and 430. */
const TALLEST = 260

async function readerOnTheDashboard(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await page.waitForTimeout(2000)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  await page.waitForTimeout(2000)
}

/** Width and height of the notice and of the column holding its sentences. */
const measure = (page: Page) => page.evaluate(() => {
  const aside = document.querySelector('aside[aria-label="Reading mode"]') as HTMLElement | null
  if (!aside) return null
  const col = aside.querySelector('div[class*="flex-1"]') as HTMLElement | null
  if (!col) return null
  return {
    noticeHeight: Math.round(aside.getBoundingClientRect().height),
    columnWidth: Math.round(col.getBoundingClientRect().width),
  }
})

test.describe('The reading notice on a narrow screen', () => {
  test.describe.configure({ timeout: 300_000 })

  test('keeps its sentence readable at every phone width', async ({ page }) => {
    await readerOnTheDashboard(page)

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 780 })
      await page.waitForTimeout(400)

      const m = await measure(page)
      expect(m, `the notice should be on the dashboard at ${width}px`).not.toBeNull()
      expect(m!.columnWidth, `text column at ${width}px`).toBeGreaterThanOrEqual(READABLE)
      expect(m!.noticeHeight, `notice height at ${width}px`).toBeLessThanOrEqual(TALLEST)

      // Widening the column by dropping an action would satisfy the two
      // assertions above and lose the thing F-4 just put there.
      await expect(page.getByRole('link', { name: 'Set where you have read to' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Turn it off in settings' })).toBeVisible()
    }
  })

  /**
   * A different failure from the one above, and worth holding onto: making the
   * column refuse to shrink is exactly the change that can push the page wider
   * than the screen. This is the measurement that could *not* see F-5, kept for
   * what it can see.
   */
  test('without pushing the page wider than the screen', async ({ page }) => {
    await readerOnTheDashboard(page)
    for (const width of [320, 430] as const) {
      await page.setViewportSize({ width, height: 780 })
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
})
