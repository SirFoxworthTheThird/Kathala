import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * NEW-2, NEW-3 and NEW-4 — what the first-run wizard tells you about itself.
 *
 * NEW-4 is measured here rather than fixed: the finding says content occupies
 * the top-left third with the rest given over to the watermark, and neither is
 * true any more — the watermark went with X-1 and the card was centred for
 * NEW-1. The numbers below are what says so, and they fail if either regresses.
 */

async function firstRun(page: Page) {
  await page.goto('/')
  await resetDB(page)
  // resetDB pre-dismisses the tutorial; the wizard is the thing under test.
  await page.evaluate(() => localStorage.removeItem('plotweave-tutorial'))
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('First')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await expect(page.getByRole('navigation', { name: 'Wizard progress' }))
    .toBeVisible({ timeout: 30_000 })
}

test.describe('The first-run wizard says what it is asking for', () => {
  test.describe.configure({ timeout: 120_000 })
  test.use({ viewport: { width: 1440, height: 900 } })

  test('NEW-2: the steps are named on screen, not only to a screen reader', async ({ page }) => {
    await firstRun(page)
    const nav = page.getByRole('navigation', { name: 'Wizard progress' })

    // Presence: every step's name is readable, so what step 3 will ask is
    // visible from step 1. They used to exist only inside each dot's aria-label.
    for (const label of ['Begin your story', 'Add a character', 'Place them in the story', 'Done']) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible()
    }

    // And the numbers are still there, so position is not lost to the names.
    const dots = await nav.evaluate((el) =>
      Array.from(el.querySelectorAll('li')).map((li) => (li.textContent ?? '').trim()),
    )
    expect(dots[0]).toContain('1')
    expect(dots.length).toBe(4)
  })

  test('NEW-3: the step-1 button names what it does', async ({ page }) => {
    await firstRun(page)

    // "Begin" read as "start the wizard", which had already started.
    await expect(page.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0)

    // And not "Create timeline" either: the Timeline screen's empty state has a
    // "Create Timeline" button, and `getByRole` matches names case-insensitively,
    // so re-using it made the two indistinguishable across a navigation. Two
    // specs started failing intermittently on exactly that.
    await expect(page.getByRole('button', { name: 'Create timeline', exact: true })).toHaveCount(0)

    const create = page.getByRole('button', { name: 'Create and continue' })
    await expect(create).toBeVisible()
    await page.getByLabel('Timeline name').fill('The Age of Embers')
    await create.click()

    // It did what it says, and the wizard moved on — so this is not passing on
    // a button that was merely relabelled and wired to nothing.
    await expect(page.getByRole('navigation', { name: 'Wizard progress' })
      .getByText('Add a character', { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('NEW-4: the first screen is centred, not a third of a page of wallpaper', async ({ page }) => {
    await firstRun(page)

    const geom = await page.getByRole('navigation', { name: 'Wizard progress' }).evaluate((el) => {
      const card = el.closest('div')!.getBoundingClientRect()
      return {
        centreOffset: Math.round(Math.abs(card.left + card.width / 2 - window.innerWidth / 2)),
        topFraction: card.top / window.innerHeight,
      }
    })
    // Measured at 1440x900: a 576x366 card at left=458, top=291 — centred, and
    // starting a third of the way down rather than pinned to the top-left.
    expect(geom.centreOffset, 'the card is pushed off centre').toBeLessThan(40)
    expect(geom.topFraction).toBeGreaterThan(0.1)

    // The watermark this finding is half about (X-1) is gone for good.
    const wallpaper = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundImage)
    expect(wallpaper === 'none' || !wallpaper.includes('url(')).toBe(true)
  })
})
