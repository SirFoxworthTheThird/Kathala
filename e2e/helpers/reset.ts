import type { Page } from '@playwright/test'

/**
 * Deletes the PlotWeaveDB IndexedDB database and clears localStorage,
 * giving each test a fresh slate. The tutorial is pre-dismissed so it
 * doesn't block any interactions.
 */
export async function resetDB(page: Page): Promise<void> {
  const clearStorage = () =>
    page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        // Clear localStorage (Zustand persisted state)
        localStorage.removeItem('plotweave-ui')
        // Mark the tutorial as done so it never appears during tests
        localStorage.setItem('plotweave-tutorial', JSON.stringify({ step: 0, done: true }))

        const req = indexedDB.deleteDatabase('PlotWeaveDB')
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => {
          // DB is open in another tab — resolve anyway; the test will still work
          resolve()
        }
      })
    })

  // Let any in-flight client-side navigation settle first, then clear storage.
  // Under load the page can still be navigating, which destroys the evaluate
  // context. A single retry was enough while the suite ran one file at a time;
  // with files running in parallel two consecutive failures happen, and this is
  // the most-called helper in the suite, so it takes a few attempts before
  // giving up rather than failing the test on a transient navigation.
  await page.waitForLoadState('load').catch(() => {})
  for (let attempt = 0; ; attempt++) {
    try {
      await clearStorage()
      break
    } catch (err) {
      if (attempt >= 4) throw err
      await page.waitForLoadState('load').catch(() => {})
      await page.waitForTimeout(150)
    }
  }
  // Navigate to / so the app re-opens the fresh DB.
  // Use goto instead of reload to avoid conflicts when a prior test's import
  // navigation is still in flight (which would cause reload to be interrupted).
  // Wait for 'load' rather than 'networkidle': Vite's HMR websocket keeps the
  // network perpetually "busy", so networkidle can time out under load. The
  // subsequent auto-waiting locators handle readiness.
  //
  // The router rewrites "/" to "/#/" on mount. That rewrite is a client-side
  // navigation, so 'load' does not wait for it, and when it lands mid-goto
  // Playwright reports "interrupted by another navigation" — so retry, since an
  // interrupted goto leaves the page somewhere harmless rather than broken.
  // (Waiting for the rewrite up front instead cost five seconds of every test
  // and caught nothing: by this point it has almost always already happened.)
  //
  // It has to stay a full document load: going to "/#/" would dodge the race
  // but only as a hash change, leaving the app running against the database we
  // just deleted with the previous test's world still on screen.
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 60_000 })
      return
    } catch (err) {
      // Five attempts rather than three: with files running in parallel this
      // race lands more often, and it is a navigation retry, not a real failure.
      if (attempt >= 4 || !String(err).includes('interrupted by another navigation')) throw err
      await page.waitForTimeout(250)
    }
  }
}
