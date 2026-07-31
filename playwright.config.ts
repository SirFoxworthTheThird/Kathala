import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts', // warm the Vite compile before the suite
  fullyParallel: false, // IndexedDB state isolation — run tests sequentially by default
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Playwright's per-test default is 30s, and a great many of these specs land
  // between 28s and 30s because each rebuilds a world through the real UI. That
  // one-second margin makes them fail on a loaded machine for no reason to do
  // with the code under test. Individual specs still narrow this where they
  // want a tighter guarantee.
  timeout: 90_000,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Opt-in escape hatch: point at a pre-installed Chromium when the
        // sandbox can't download Playwright's pinned build. Unset in normal
        // CI/local runs, where Playwright uses its own managed browser.
        launchOptions: {
          ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
          // index.html pulls Playfair Display from Google Fonts. Where that host
          // is unreachable — a sandbox, a firewall, an aeroplane — the request
          // does not fail, it hangs, and every `waitUntil: 'load'` waits out the
          // full ~13s with it. Two navigations per test made that the single
          // largest cost in the suite, dwarfing the code under test.
          //
          // Everything under test is served from localhost, so give the test
          // browser no proxy and no DNS route to the font hosts: the request
          // then fails at once instead of hanging. (Host-resolver rules alone
          // are not enough — with a proxy configured the proxy does the
          // resolving, so the mapping never applies.) The app renders in its
          // fallback face while the webfont loads, so nothing under test moves.
          args: [
            '--no-proxy-server',
            '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
