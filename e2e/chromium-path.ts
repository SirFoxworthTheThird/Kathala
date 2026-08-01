import { existsSync } from 'node:fs'

/**
 * Which Chromium to drive the tests with.
 *
 * Playwright normally downloads and manages its own build, pinned to the
 * `@playwright/test` version. Some environments provide one instead and block
 * the download — and if the provided build does not match the pin, Playwright
 * looks for a version that was never fetched and the whole suite fails before
 * the first test:
 *
 *     Executable doesn't exist at …/chromium_headless_shell-1217/…
 *
 * So: an explicit `PW_CHROMIUM_PATH` wins, then a pre-installed browser if one
 * is actually on disk, and otherwise nothing — which lets Playwright use its
 * own managed build, the normal case locally and in CI. Resolving it here
 * rather than at the call site means `npm run test:e2e` works as written
 * wherever it runs, instead of only for whoever remembers the variable.
 */
export function resolveChromium(): string | undefined {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH

  const preinstalled = [
    // Symlink to whichever build the image shipped.
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return preinstalled.find((p) => existsSync(p))
}
