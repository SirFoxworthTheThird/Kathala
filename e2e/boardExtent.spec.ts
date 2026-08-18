import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * CB-2: the corkboard scrolls sideways through every chapter in the book and
 * nothing on screen said so — no count, and a scrollbar the platform draws as
 * an overlay. Measured on the bundled Philosopher's Stone at 1280px: 1,228px of
 * 4,624 showing, and `offsetHeight - clientHeight` of **0**. Probed further and
 * it is not a styling gap: in this Chromium no scrollbar reclaims layout space
 * at all, styled or not. So the affordance is the app's own, not the platform's.
 */
test('the board says how much board there is, and offers a way through it', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await resetDB(page)

  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Wide Board')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)

  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settleNav(page)
  await page.getByRole('button', { name: 'Create Timeline' }).click()

  // Ten chapters at 256px a column is wider than any viewport this runs at.
  for (let i = 1; i <= 10; i++) {
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill(`Chapter ${i}`)
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText(`Ch. ${i} — Chapter ${i}`)).toBeVisible()
  }

  // One scene, so the header has both numbers to report.
  await page.getByTitle('Open chapter detail').first().click()
  await page.getByRole('main').getByRole('button', { name: 'Add Scene' }).first().click()
  await page.getByPlaceholder('Scene title').fill('Opening')
  await page.getByRole('button', { name: 'Add Scene' }).last().click()

  await page.getByRole('link', { name: /corkboard/i }).first().click()
  await settleNav(page)
  await expect(page.getByRole('heading', { name: 'Corkboard' })).toBeVisible({ timeout: 30000 })

  // The size is stated where you look first.
  await expect(page.getByText('10 chapters · 1 scene', { exact: true })).toBeVisible()

  const later = page.getByRole('button', { name: 'Scroll to later chapters' })
  const earlier = page.getByRole('button', { name: 'Scroll to earlier chapters' })
  const scrollLeft = () => page.evaluate(
    () => (document.querySelector('main .overflow-x-auto') as HTMLElement).scrollLeft,
  )

  // At the left edge there is board to the right and none to the left.
  await expect(later).toBeVisible({ timeout: 15_000 })
  await expect(earlier).toHaveCount(0)

  // Pressing it actually moves the board...
  await later.click()
  await expect.poll(scrollLeft, { timeout: 10_000 }).toBeGreaterThan(0)
  // ...and now there is board behind you, so the other control appears. This is
  // the presence half of the absence above, on the same locator.
  await expect(earlier).toBeVisible()

  // Run to the far end: the forward control goes, because there is nothing
  // further to go to.
  await page.evaluate(() => {
    const el = document.querySelector('main .overflow-x-auto') as HTMLElement
    el.scrollLeft = el.scrollWidth
  })
  await expect(later).toHaveCount(0)
  await expect(earlier).toBeVisible()
})
