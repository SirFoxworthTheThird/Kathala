import type { Page } from '@playwright/test'

/**
 * Deletes the PlotWeaveDB IndexedDB database and clears localStorage,
 * giving each test a fresh slate. The tutorial is pre-dismissed so it
 * doesn't block any interactions.
 */
export async function resetDB(page: Page): Promise<void> {
  await page.evaluate(() => {
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
  // Reload so the app re-opens the fresh DB
  await page.reload()
  await page.waitForLoadState('networkidle')
}
