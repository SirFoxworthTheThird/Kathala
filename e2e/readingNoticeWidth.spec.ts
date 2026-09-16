import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
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
 *
 * **A-7 is the mirror image, and the fix above caused it.** Giving the sentence
 * a 13rem floor stopped it being squeezed and pushed the cost onto the links
 * instead, which carried `shrink-0` — max-content, so the group's own
 * `flex-wrap` could never fire. The pair sat side by side on a line too narrow
 * for them and *Turn it off in settings* ran off the screen: the reader run
 * measured 56 / 86 / 126px past the viewport at 390 / 360 / 320, and at 320 the
 * primary link was clipped too. Putting `shrink-0` back today still leaves it
 * 5px over at 320, which is what reddens this test.
 * `scrollWidth === clientWidth` throughout, again — so
 * the second test here measures the links the way the first measures the
 * column, because neither is visible from the page's own width.
 */

const WIDTHS = [320, 360, 390, 414, 430, 640] as const

/** The narrowest this reads at. The floor in the component is 13rem = 208px. */
const READABLE = 180
/** Before the fix the aside was 748px tall at 414 and 430. */
const TALLEST = 260

async function readerOnTheDashboard(page: Page) {
  await resetDB(page)
  await downloadLibraryBook(page, DEFAULT_BOOK)
  await settle(page)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
  await settle(page)
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

  test('keeps its links inside the screen at every phone width', async ({ page }) => {
    await readerOnTheDashboard(page)

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 780 })
      await page.waitForTimeout(400)

      const m = await page.evaluate(() => {
        const aside = document.querySelector('aside[aria-label="Reading mode"]') as HTMLElement | null
        if (!aside) return null
        const vw = document.documentElement.clientWidth
        return [...aside.querySelectorAll('a')].map((a) => ({
          text: (a.textContent ?? '').trim(),
          over: Math.round(a.getBoundingClientRect().right - vw),
          left: Math.round(a.getBoundingClientRect().left),
        }))
      })

      /*
        Both links, asserted before anything is measured about them. Without
        this the rule below is satisfied by a notice that has no links at all,
        which is the state the component renders when `worldId` is missing —
        reachable, and exactly the shape that would make this vacuous.
      */
      expect(m, `the notice should be on the dashboard at ${width}px`).not.toBeNull()
      expect(m!.map((l) => l.text), `both links at ${width}px`)
        .toEqual(['Set where you have read to', 'Turn it off in settings'])

      for (const link of m!) {
        expect(link.over, `"${link.text}" runs ${link.over}px past the right edge at ${width}px`)
          .toBeLessThanOrEqual(0)
        expect(link.left, `"${link.text}" starts off the left edge at ${width}px`)
          .toBeGreaterThanOrEqual(0)
      }
    }
  })
})
