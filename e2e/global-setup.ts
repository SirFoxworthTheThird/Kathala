import { chromium } from '@playwright/test'
import { resolveChromium } from './chromium-path'

/**
 * Warms the Vite dev server before the suite runs. The first navigation
 * triggers an on-demand compile of the app bundle, which can exceed a test's
 * timeout under load and make whichever spec runs first flake on cold start.
 * Navigating once here pays that cost outside any test.
 */
export default async function globalSetup() {
  const browser = await chromium.launch({
    executablePath: resolveChromium(),
  })
  const page = await browser.newPage()
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 120_000 })
    // Wait until the client bundle has mounted (the world-selector button).
    await page.getByRole('button', { name: 'New World' }).waitFor({ timeout: 120_000 })
  } catch {
    // Best-effort warmup — never fail the run here.
  } finally {
    await browser.close()
  }
}
