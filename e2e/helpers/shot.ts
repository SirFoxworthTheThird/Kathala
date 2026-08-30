import type { Page, TestInfo } from '@playwright/test'

/**
 * Save a validation screenshot alongside the running test's own artifacts.
 *
 * These were written to `screenshots/validation/`, a *tracked* directory, and
 * both validation specs wrote the same eleven filenames into it — so the
 * committed image was whichever book happened to run last, and every full suite
 * run left the working tree dirty with pictures nothing reads. Nothing in the
 * app, the docs or the README referenced them.
 *
 * `testInfo.outputPath` puts them under the gitignored `test-results/`, one
 * directory per test, which removes the collision as well as the churn.
 * Attaching them puts them in the HTML report, which is the only place anybody
 * was ever going to look.
 */
export async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(name)
  await page.screenshot({ path, fullPage: false })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}
