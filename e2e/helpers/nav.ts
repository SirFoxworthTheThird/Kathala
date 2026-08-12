import type { Page } from '@playwright/test'

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
export async function dismissFirstRunGuide(page: Page) {
  const skip = page.getByRole('button', { name: /Skip and explore on my own/ })
  if (await skip.count()) await skip.first().click()
}
