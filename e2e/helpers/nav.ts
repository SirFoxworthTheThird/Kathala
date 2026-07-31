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
