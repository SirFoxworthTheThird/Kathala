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
  // context; if that happens, settle and retry once.
  await page.waitForLoadState('load').catch(() => {})
  try {
    await clearStorage()
  } catch {
    await page.waitForLoadState('load').catch(() => {})
    await clearStorage()
  }
  // Navigate to / so the app re-opens the fresh DB.
  // Use goto instead of reload to avoid conflicts when a prior test's import
  // navigation is still in flight (which would cause reload to be interrupted).
  // Wait for 'load' rather than 'networkidle': Vite's HMR websocket keeps the
  // network perpetually "busy", so networkidle can time out under load. The
  // subsequent auto-waiting locators handle readiness.
  await page.goto('/', { waitUntil: 'load', timeout: 60_000 })
}
