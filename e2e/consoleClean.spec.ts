import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook, DEFAULT_BOOK } from './helpers/library'

/**
 * Walk every main screen of a real, populated world and let nothing throw.
 *
 * `ux-review.md` carried two console faults found while capturing screenshots —
 * a setState-during-render on Maps (BUG-1) and a duplicate React key (BUG-2) —
 * and neither had a status, because nothing in the suite watches the console.
 * They were found by a person looking at a devtools panel, which is not a thing
 * that happens twice.
 *
 * Two levels, because the two levels are genuinely different:
 *
 * - **Always.** Uncaught exceptions and `console.error` survive minification, so
 *   this half runs in the ordinary suite against the built bundle. It is the
 *   half that catches a screen that breaks on a world of this size.
 * - **`E2E_DEV=1` only.** React's duplicate-key and setState-during-render
 *   warnings are `console.warn` behind `NODE_ENV !== 'production'` and are
 *   *stripped from the bundle entirely*. A first attempt at this ran against
 *   `dist/` and reported a clean console for both bugs, which was worth nothing
 *   — the warnings could not have appeared. So that half is asserted only where
 *   it can be, and is skipped rather than quietly passing.
 *
 * Resource-load failures are excluded on purpose: `Failed to load resource` is
 * the network the test happens to be on, not the app. In this repo's sandbox
 * every remote fetch reports `ERR_CERT_AUTHORITY_INVALID` through the proxy.
 */

/** The one warning that is a false positive, measured rather than assumed. */
const STRICT_MODE_REACT_FLOW = 'nodeTypes or edgeTypes'

function watch(page: Page) {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  page.on('console', (m) => {
    const text = m.text()
    if (text.includes('Failed to load resource')) return
    if (m.type() === 'error') errors.push(`[error] ${text}`)
    if (m.type() === 'warning' && !text.includes(STRICT_MODE_REACT_FLOW)) warnings.push(`[warning] ${text}`)
  })
  return { errors, warnings }
}

test.describe('a populated world does not shout at the console', () => {
  test.describe.configure({ timeout: 420_000 })

  test('every main screen loads without throwing', async ({ page }) => {
    const { errors, warnings } = watch(page)

    await resetDB(page)
    await downloadLibraryBook(page, DEFAULT_BOOK)
    await settle(page)
    const id = new URL(page.url()).hash.split('/')[2]

    // Writing mode: reading mode puts half these screens away, and the two
    // faults this exists for were both found on the writer's UI.
    await page.goto(`/#/worlds/${id}/settings`)
    await page.getByRole('button', { name: 'Turn off reading mode' }).click().catch(() => {})
    await page.waitForTimeout(1500)

    const main = page.getByRole('main')

    /*
      Each screen is waited on something it only draws once it has content, so
      "no errors" is about a screen that rendered rather than one that had not
      started. An absence asserted over a blank page is the vacuity this suite
      keeps finding.
    */
    await page.goto(`/#/worlds/${id}/timeline`)
    await expect(main.getByText(/^Ch\. 1 —/).first()).toBeVisible({ timeout: 60_000 })

    await page.goto(`/#/worlds/${id}/characters`)
    await expect(main.getByRole('link').first()).toBeVisible({ timeout: 60_000 })

    await page.goto(`/#/worlds/${id}/relationships`)
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 60_000 })

    await page.goto(`/#/worlds/${id}/maps`)
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
    await settle(page)

    await page.goto(`/#/worlds/${id}/arc`)
    await expect(page.getByRole('grid')).toBeVisible({ timeout: 60_000 })

    await page.goto(`/#/worlds/${id}/corkboard`)
    await settle(page)
    await page.goto(`/#/worlds/${id}/manuscript`)
    await settle(page)
    await page.goto(`/#/worlds/${id}/items`)
    await settle(page)
    await page.goto(`/#/worlds/${id}/knowledge`)
    await settle(page)
    await page.goto(`/#/worlds/${id}/`)
    await settle(page)

    expect(errors, `errors:\n${[...new Set(errors)].join('\n')}`).toEqual([])

    /*
      BUG-1 and BUG-2. Only meaningful where React still ships its warnings —
      see the note at the top.

      A conditional assertion rather than `test.skip`: skipping mid-test aborts
      the whole test, so the first version of this reported "1 skipped" against
      the production build and the error assertion above — which had just run
      and passed — looked like it had never run at all. The annotation says
      which of the two happened, so a green run is readable rather than merely
      green.
    */
    if (process.env.E2E_DEV) {
      test.info().annotations.push({ type: 'checked', description: 'React dev warnings' })
      expect(warnings, `warnings:\n${[...new Set(warnings)].join('\n')}`).toEqual([])
    } else {
      test.info().annotations.push({
        type: 'not checked',
        description: 'React dev warnings are stripped from the production bundle — run with E2E_DEV=1',
      })
    }
  })
})
