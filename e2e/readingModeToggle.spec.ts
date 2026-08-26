import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The reading-mode control is a toggle, and should read like one.
 *
 * It previously said "Reading mode is on" when on and "Turn on reading mode"
 * when off — a status in one direction and an instruction in the other, so the
 * on state looked like a label rather than something you could press. It also
 * carried no `aria-pressed`, so assistive tech was told neither that it toggles
 * nor which way it currently sits.
 */
test.describe('Reading mode toggle', () => {
  test.describe.configure({ timeout: 120_000 })

  async function settings(page: Page) {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Toggle')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]
    await page.goto(`/#/worlds/${id}/settings`)
    return id
  }

  test('states its action and its state in both directions', async ({ page }) => {
    await settings(page)

    // Off: an action to turn it on, and aria-pressed says it is not pressed.
    const on = page.getByRole('button', { name: 'Turn on reading mode' })
    await expect(on).toBeVisible()
    await expect(on).toHaveAttribute('aria-pressed', 'false')

    await on.click()

    // On: still an action — the opposite one — and aria-pressed flips. Both
    // halves are asserted, so a control stuck in either state fails.
    const off = page.getByRole('button', { name: 'Turn off reading mode' })
    await expect(off).toBeVisible()
    await expect(off).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Turn on reading mode' })).toHaveCount(0)

    // The state is still stated, just not as the button's own label.
    await expect(page.getByText('Reading mode is on.')).toBeVisible()

    await off.click()
    await expect(page.getByRole('button', { name: 'Turn on reading mode' })).toBeVisible()
    await expect(page.getByText('Reading mode is on.')).toHaveCount(0)
  })

  test('an action tile shows an affordance, not a missing value', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Tiles')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // A world with no events shows the onboarding wizard instead of the tiles.
    await page.goto(`/#/worlds/${id}`)
    await page.getByRole('button', { name: /skip and explore/i }).click()

    // The Continuity tile opens the checker; it has no count to show. It must
    // not render a bold em-dash, which reads as "unknown" rather than "open me".
    const tile = page.getByRole('button').filter({ hasText: 'Continuity' }).first()
    await expect(tile).toBeVisible()
    await expect(tile).not.toContainText('—')

    // Paired with a tile that does have a number, so "no dash anywhere" cannot
    // pass by the tiles simply failing to render.
    const timeline = page.getByRole('button').filter({ hasText: 'Timeline' }).first()
    await expect(timeline).toContainText(/\d/)
  })

  test('"Skip and explore on my own" actually leaves the wizard', async ({ page }) => {
    // The latch that keeps the wizard mounted used to re-arm itself the instant
    // it was released, so skipping did nothing for any world without an event —
    // which is every world the wizard appears for.
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Skipper')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    const skip = page.getByRole('button', { name: /skip and explore/i })
    await expect(skip, 'the wizard should greet a brand-new world').toBeVisible()
    await skip.click()

    // Gone, and the dashboard is underneath.
    await expect(page.getByRole('button', { name: /skip and explore/i })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button').filter({ hasText: 'Timeline' }).first()).toBeVisible()
  })

  test('the wizard leaves you alone once the world has a timeline', async ({ page }) => {
    // It used to trigger on "no events" as well, so a writer who built a
    // timeline and chapters on the Timeline screen came back to the dashboard
    // and was asked, at step 1 of 4, to name a timeline they had already named.
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Started')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const id = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // It does greet a world with nothing in it — the other half of the pair.
    await expect(page.getByRole('button', { name: /skip and explore/i })).toBeVisible()

    await page.getByRole('link', { name: /timeline/i }).click()
    await page.getByRole('button', { name: 'Create Timeline' }).click()
    await page.getByRole('button', { name: 'Add Chapter' }).first().click()
    await page.getByPlaceholder('Chapter title').fill('One')
    await page.getByRole('button', { name: 'Add Chapter' }).last().click()
    await expect(page.getByText('One').first()).toBeVisible()

    // Back on the dashboard: tiles, not step 1 of 4.
    await page.goto(`/#/worlds/${id}`)
    await expect(page.getByRole('button', { name: /skip and explore/i })).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('button').filter({ hasText: 'Timeline' }).first()).toBeVisible()
  })
})
