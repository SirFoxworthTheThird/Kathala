import { expect, type Page } from '@playwright/test'

/**
 * Move the pointer off the nav rail and let its width transition finish.
 *
 * The rail expands on hover and animates over 150ms. Clicking a link inside it
 * leaves the pointer there, so the expanded rail sits over the left of the
 * page — and Playwright's next click hovers its own target, which is *under*
 * the rail, so the rail never un-hovers and the click never lands. Retrying
 * cannot break that deadlock; moving away first can.
 */
export const settleNav = (page: Page) =>
  page.mouse.move(700, 400).then(() => page.waitForTimeout(200))

/**
 * Leave the first-run guide, if it is showing.
 *
 * Creating a world lands on the dashboard while it still has no timeline, and
 * that arms the guide's latch — deliberately, so that seeding a timeline behind
 * its back does not dismiss it (`WorldDashboardView`: "keep the wizard mounted
 * until it explicitly exits"). Whether the latch arms before a spec's seeding
 * lands is a race on the live query, so a spec that creates a world and then
 * expects the dashboard's own panels sees them intermittently. Three specs hit
 * this, all reading as "the panel is simply absent" rather than as a flake.
 *
 * Takes the guide's own documented way out rather than waiting longer.
 */
export async function dismissFirstRunGuide(page: Page, timeout = 5000) {
  const skip = page.getByRole('button', { name: /Skip and explore on my own/ }).first()
  /*
    Wait for it rather than look once.
    `count()` is a reading taken at an instant, and the instant is exactly the
    one the paragraph above says is racy — so a spec that arrived a tick early
    dismissed nothing, and the guide then covered the dashboard for the rest of
    the test. `deleteConfirms` failed that way on a full run, spending its whole
    240s waiting for a panel behind the wizard.

    The wait only costs anything when the guide genuinely never appears — a
    world that already had a timeline — and it is bounded for that case.
  */
  try {
    await skip.waitFor({ state: 'visible', timeout })
  } catch {
    return
  }
  await skip.click()
  // And it really went, so a caller that depends on the dashboard is not
  // racing the exit animation.
  await expect(skip).toHaveCount(0)
}
