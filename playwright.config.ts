import { defineConfig, devices } from '@playwright/test'
import { resolveChromium } from './e2e/chromium-path'

/**
 * `E2E_DEV=1` runs the suite against the Vite dev server instead of a build —
 * slower, but it keeps hot reload, which is what you want while writing a spec.
 * Everything else runs against the production bundle.
 */
const E2E_DEV = !!process.env.E2E_DEV
const DEV_URL = 'http://localhost:5173'
const PREVIEW_URL = 'http://localhost:4173'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts', // warm the Vite compile before the suite
  // Tests inside one file still run in order — several specs build state in an
  // early test and read it in a later one.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry everywhere, not just on CI. Running files in parallel surfaced a
  // residual ~1%-per-run of timing failures — a navigation interrupted mid-goto,
  // a keyboard shortcut pressed a beat before its listener is bound — that pass
  // in isolation and land on a different spec each time. Six such specs were
  // fixed individually before it was clear that was not converging.
  //
  // This does not hide them: Playwright reports a test that failed then passed
  // as *flaky*, so they stay visible in the summary and can be worked off, while
  // a genuine regression still fails twice and fails the run.
  retries: 1,
  // Files, however, run in parallel. The old comment here said workers had to
  // be 1 for "IndexedDB state isolation", but Playwright gives each worker its
  // own browser context and storage is partitioned per context, so the specs do
  // not see each other's databases. Measured against the built bundle on the
  // same 16 tests: 42s at one worker, 25s at four.
  //
  // Four, and not more: raising it was tried and measured against. On a
  // four-core box the suite is already CPU-saturated — a full run shows a load
  // average near 19 — so six workers only adds contention. Paired A/B/A/B over
  // a 45-file subset: **4 workers 215s and 212s, 6 workers 216s and 261s**,
  // with the extra workers also producing retries that four did not.
  //
  // That pairing matters more than the numbers. This container's throughput
  // drifts by a third between runs — the same tree measured 713s and then 948s
  // — so any two runs taken an hour apart say nothing, and every conclusion
  // here comes from variants interleaved back to back instead.
  workers: 4,
  // Playwright's per-test default is 30s, and a great many of these specs land
  // between 28s and 30s because each rebuilds a world through the real UI. That
  // one-second margin makes them fail on a loaded machine for no reason to do
  // with the code under test. Individual specs still narrow this where they
  // want a tighter guarantee.
  timeout: 90_000,
  reporter: 'html',
  use: {
    baseURL: E2E_DEV ? DEV_URL : PREVIEW_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Falls back to a pre-installed browser where Playwright's own
          // pinned build is unavailable; undefined everywhere else, which is
          // the normal managed-browser path. See e2e/chromium-path.ts.
          ...(() => {
            const executablePath = resolveChromium()
            return executablePath ? { executablePath } : {}
          })(),
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
  webServer: E2E_DEV
    ? {
        command: 'npm run dev',
        url: DEV_URL,
        reuseExistingServer: true,
        timeout: 30_000,
      }
    : {
        // Build once, then serve the bundle. The dev server transforms modules
        // on demand, and with 83 database resets — each a full document load —
        // the suite paid that cost over and over. Measured on the same 16 tests:
        // 70s against `vite dev`, 42s against the built bundle.
        // VITE_E2E keeps the Dexie seeding seam (window.__pwdb) in the bundle;
        // a normal `npm run build` still strips it.
        command: 'VITE_E2E=1 npm run build && npx vite preview --port 4173 --strictPort',
        url: PREVIEW_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
