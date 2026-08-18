import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * HB-9, from an outside review: *Calendar configuration overwhelms Settings.*
 *
 * Two concrete parts, both still true when this was picked up. Twelve month
 * rows sat open in the middle of the Settings page — thirteen once a world had
 * festival days — and the only route to a calendar unlike Earth's was editing
 * those rows one at a time.
 *
 * `SettingsIndex` (SET-2) had already given the page a jump nav, which helps
 * you get past the calendar but not with the calendar itself.
 */

const monthsToggle = (page: Page) => page.getByRole('button', { name: /^Months/ })

async function settings(page: Page) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Calendared')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  return worldId
}

const storedCalendar = (page: Page, worldId: string) => page.evaluate(async (id) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    worlds: { get: (i: string) => Promise<{ calendar?: { months: { name: string; days: number; intercalary?: boolean }[] } | null }> }
  }
  return (await db.worlds.get(id))?.calendar ?? null
}, worldId)

test.describe('Setting up a calendar', () => {
  test.describe.configure({ timeout: 300_000 })

  test('the month rows are folded away, and open when asked for', async ({ page }) => {
    await settings(page)
    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()

    // Folded: the rows are not merely off-screen, they are not rendered — a
    // control in the DOM but not on screen is still reachable, and these write
    // to the world.
    await expect(page.getByLabel('Month 1 name')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add month' })).toHaveCount(0)
    await expect(monthsToggle(page)).toHaveAttribute('aria-expanded', 'false')

    // But what the year *is* stays visible without opening anything, which is
    // what makes folding them acceptable.
    await expect(page.getByText('12 months', { exact: true })).toBeVisible()

    // And the presence half: one press and every row is there.
    await monthsToggle(page).click()
    await expect(monthsToggle(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel('Month 1 name')).toHaveValue('January')
    await expect(page.getByLabel('Month 12 name')).toHaveValue('December')
    await expect(page.getByRole('button', { name: 'Add month' })).toBeVisible()
  })

  test('a preset builds the shape, so nobody types thirty twelve times', async ({ page }) => {
    const worldId = await settings(page)

    await page.getByRole('button', { name: /^Twelve months of thirty/ }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()
    // Twelve months and a thirteenth entry outside them — the fiddly part.
    await expect(page.getByText('12 months · 1 named day')).toBeVisible()

    const cal = await storedCalendar(page, worldId)
    expect(cal).not.toBeNull()
    expect(cal!.months.filter((m) => !m.intercalary)).toHaveLength(12)
    expect(cal!.months.filter((m) => m.intercalary).map((m) => m.days)).toEqual([5])
  })

  /**
   * The pair to the test above. A preset that produced the same calendar as
   * *Enable calendar* would satisfy every assertion there while being useless,
   * so the two must differ — and the plain button must still give Earth.
   */
  test('and the plain button still gives the Gregorian year', async ({ page }) => {
    const worldId = await settings(page)

    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()

    const cal = await storedCalendar(page, worldId)
    expect(cal!.months).toHaveLength(12)
    expect(cal!.months[0].name).toBe('January')
    expect(cal!.months.some((m) => m.intercalary)).toBe(false)
  })

  /**
   * Applying a preset over a calendar somebody has already edited would throw
   * their work away, so they are offered only before there is one.
   */
  test('presets are not offered once a calendar exists', async ({ page }) => {
    await settings(page)
    // Offered here — without this the absence below could pass on a screen
    // where they were never built at all.
    await expect(page.getByRole('button', { name: /^Four seasons/ })).toBeVisible()

    await page.getByRole('button', { name: 'Enable calendar' }).click()
    await expect(page.getByText('365 days/year')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Four seasons/ })).toHaveCount(0)
  })
})
