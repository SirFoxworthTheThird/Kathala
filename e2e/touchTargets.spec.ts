import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The time cursor is the app's central control and the one a reader taps most
 * on a phone. Its step buttons were 24x20 — less than half the 44px touch
 * guideline, and smaller than every other icon button in the same bar.
 *
 * Sizes are measured rather than asserted against class names, so a refactor
 * that keeps the classes but loses the size still fails.
 */
test.describe('Touch targets', () => {
  test.describe.configure({ timeout: 120_000 })

  /**
   * Built at desktop width: below `lg` the nav collapses behind a hamburger,
   * and this spec is about the size of the cursor controls, not about reaching
   * them. Callers switch to the phone viewport afterwards.
   */
  async function worldWithAMoment(page: Page) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Thumbs')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]

    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await page.getByTitle('Open chapter detail').first().click()
    await page.getByRole('main').getByRole('button', { name: 'Add Event' }).first().click()
    await page.getByPlaceholder('Event title').fill('Scene')
    await page.getByRole('button', { name: 'Add Event' }).last().click()
    await page.goto(`/#/worlds/${id}/timeline`)
    await page.getByTitle('Scene', { exact: true }).click()
    return id
  }

  const box = async (page: Page, name: string) => {
    const b = await page.getByRole('button', { name }).first().boundingBox()
    return b ? { w: Math.round(b.width), h: Math.round(b.height) } : null
  }

  test('the time-cursor steps are comfortably tappable on a phone', async ({ page }) => {
    await worldWithAMoment(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(600)

    for (const name of ['Previous moment', 'Next moment']) {
      const b = await box(page, name)
      expect(b, `${name} should be rendered`).not.toBeNull()
      expect(b!.w, `${name} is ${b!.w}px wide`).toBeGreaterThanOrEqual(32)
      expect(b!.h, `${name} is ${b!.h}px tall`).toBeGreaterThanOrEqual(32)
    }

    // The clear-cursor control discards the reading position, so it must not
    // sit flush against the button a reader taps repeatedly.
    const next = await page.getByRole('button', { name: 'Next moment' }).first().boundingBox()
    const clear = await page.getByRole('button', { name: 'View all chapters' }).first().boundingBox()
    expect(clear, 'the clear-cursor control should be present at 390px').not.toBeNull()
    expect(Math.round(clear!.x - (next!.x + next!.width)), 'gap between "next" and "clear"')
      .toBeGreaterThanOrEqual(4)
  })

  test('the phone top bar still fits after enlarging them', async ({ page }) => {
    await worldWithAMoment(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(600)

    // The whole point of the small buttons was to fit; check that undoing that
    // has not pushed the page sideways or overflowed the header.
    const geo = await page.evaluate(() => {
      const de = document.documentElement
      const header = document.querySelector('header')!.getBoundingClientRect()
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, headerRight: Math.round(header.right) }
    })
    expect(geo.scrollWidth, 'the page must not scroll sideways').toBeLessThanOrEqual(geo.clientWidth + 1)
    expect(geo.headerRight).toBeLessThanOrEqual(geo.clientWidth + 1)
  })

  test('a chapter title is not truncated on a phone', async ({ page }) => {
    // At 390px the title — the only thing telling one row from another — lost
    // roughly 40% of the row to "Set Active" and two icon buttons and rendered
    // as "Ch. 1 — The Vanish…". The row wraps below `sm` so the title gets the
    // full first line.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Wrapping')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('The Vanishing Glass')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    const title = page.getByText('Ch. 1 — The Vanishing Glass').first()
    await expect(title).toBeVisible()

    const clipped = async () => title.evaluate((el) => el.scrollWidth > el.clientWidth + 1)

    // Desktop: plenty of room, nothing clipped — the control half of the pair.
    expect(await clipped(), 'the title should fit on a desktop').toBe(false)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(600)
    await expect(title).toBeVisible()
    expect(await clipped(), 'the title is truncated at 390px').toBe(false)
  })
})
