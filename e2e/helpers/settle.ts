import type { Page } from '@playwright/test'

/**
 * Wait for a screen to stop changing, instead of guessing how long it takes.
 *
 * The suite carried 407 `waitForTimeout` calls totalling **563 seconds** of
 * fixed sleeping. Most stand where a route was just navigated to and its live
 * queries have to resolve, and the number was picked to be comfortably longer
 * than the slowest case anyone had seen — which means every fast case pays for
 * the slow one. Measured across twelve routes of a real library world, a hash
 * navigation settles in **463ms on average** against a flat 1,200.
 *
 * This is not merely the fast version of that sleep, it is the more reliable
 * one. A fixed wait is a guess in *both* directions: too long for the common
 * case and, on a loaded machine, too short for the rare one. Waiting for the
 * page to stop changing tracks the actual work, and the ceiling here is higher
 * than the sleeps it replaces — so where 1,200ms would have given up and read a
 * half-drawn screen, this is still waiting.
 *
 * `innerText` rather than a DOM-node count: a live query resolving usually
 * swaps placeholder text for real text without changing the element count, and
 * a spoiler sweep reads `innerText` anyway, so this settles on exactly the thing
 * the assertion will read.
 */
export async function settle(
  page: Page,
  { floor = 250, ceiling = 4000 }: { floor?: number; ceiling?: number } = {},
): Promise<void> {
  /*
    Polled *inside* the page, not across the wire.

    The first version of this looped in Node calling `page.evaluate`, which is a
    CDP round-trip per poll — perhaps six per call, several hundred per test.
    That is fine on an idle machine and expensive on a busy one, and this suite
    runs six workers on four cores: measured over the whole suite, converting a
    further 196s of fixed sleeps that way made the run *slower*, 652s to 677s,
    because a sleeping test yields its core and a polling one does not.

    `waitForFunction` sends the predicate once and Chromium runs it on its own
    timer, so a settle costs one message regardless of how long it waits. The
    state has to live on `window` because the predicate is re-entered from
    scratch each time; keying it on `location.href` restarts the count when a
    navigation swaps the document under us, which is a change rather than a
    finish.
  */
  await page
    .waitForFunction(
      ({ floor: min }: { floor: number }) => {
        const w = window as unknown as {
          __pwSettle?: { href: string; last: number; stable: number; start: number }
        }
        const now = Date.now()
        const len = document.body.innerText.length
        if (!w.__pwSettle || w.__pwSettle.href !== location.href) {
          w.__pwSettle = { href: location.href, last: -1, stable: 0, start: now }
        }
        const s = w.__pwSettle
        if (len > 0 && len === s.last) s.stable += 1
        else { s.stable = 0; s.last = len }
        // Two agreeing reads *and* the floor, so a screen that renders its final
        // text before its data arrives is not mistaken for finished.
        return s.stable >= 2 && now - s.start >= min
      },
      { floor },
      { polling: 100, timeout: ceiling },
    )
    // The ceiling is a bound, not a failure: this replaces a fixed sleep that
    // would simply have ended, and the assertion that follows is what decides
    // whether the screen was ready.
    .catch(() => {})
}
