import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav } from './helpers/nav'

/**
 * RD-3: the dashboard is where the Library drops a reader, and it was the one
 * screen in reading mode that never used the words. The mode was inferable only
 * from a changed theme and sublabels like "you have met so far", and nothing
 * said how to leave. The sentence itself is unit-tested in
 * `src/lib/__tests__/readingNotice.test.ts`; this checks the screen carries it,
 * and stops carrying it when the mode is off.
 */
test('the landing screen says it is in reading mode, and how to leave', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: /^Download \(/ }).first().click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 60_000 })
  await page.waitForTimeout(1000)
  const world = new URL(page.url()).hash.replace(/^#/, '').split('/').slice(0, 3).join('/')

  const notice = page.getByRole('complementary', { name: 'Reading mode' })
  await expect(notice).toBeVisible({ timeout: 20_000 })
  await expect(notice).toContainText('Reading mode is on')
  // It says where the reader is and what that is holding back...
  await expect(notice).toContainText(/reading up to chapter \d+/)
  // ...and how to get out, which the finding asked for by name.
  await expect(notice.getByRole('link', { name: 'Turn it off in settings' })).toBeVisible()

  // The link goes where it says.
  await notice.getByRole('link', { name: 'Turn it off in settings' }).click()
  await expect(page).toHaveURL(new RegExp(`${world}/settings$`.replace(/\//g, '\\/')))

  // Turning the mode off takes the notice away — the presence half above cannot
  // be passing on a banner that is simply always there.
  await settleNav(page)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await page.waitForTimeout(800)
  await page.goto(`/#${world}`)
  await settleNav(page)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  await expect(notice).toHaveCount(0)
})
