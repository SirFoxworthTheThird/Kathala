import type { Page } from '@playwright/test'

/**
 * Give a test a fresh database: delete IndexedDB, clear the persisted UI state,
 * and pre-dismiss the tutorial so it never blocks an interaction.
 *
 * **One app boot, not two.** This used to clear storage from whatever document
 * was already loaded and then navigate to `/` to reopen the fresh database —
 * which meant every caller had to load the app *first* simply to have somewhere
 * to run the clear, and 234 of the 235 call sites did exactly that, one line
 * above. Both loads were full document loads of the bundle, measured at
 * ~360ms each, so the suite spent about 84 seconds booting an app it threw away
 * without looking at.
 *
 * An init script runs before any page script on the next navigation, so the
 * clear can happen *inside* the load that was going to happen anyway. Ordering
 * is what makes this safe rather than merely quicker: `deleteDatabase` is issued
 * before Dexie exists, and IndexedDB processes requests against one database in
 * order, so the app's `open` queues behind the delete instead of racing it.
 * Nothing holds a connection at that point — each test gets its own context.
 *
 * The nonce makes the script fire exactly once per call rather than once per
 * tab: a second `resetDB` in the same test installs a script with a new nonce
 * and resets again, while the first stays inert through the navigations in
 * between. Guarding on a bare flag would have worked for today's call sites —
 * every one of them resets once per test — and quietly stopped working for the
 * first spec that wanted two.
 */
export async function resetDB(page: Page): Promise<void> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  await page.addInitScript((token: string) => {
    /*
      A key *per* nonce, not one key holding the latest nonce. Two calls in one
      test install two scripts, and with a shared key each would see the other's
      token, decide it had not run, and fire again — so every navigation after
      the second reset deleted the database underneath the test. It cost a
      library download that had already succeeded, and the spec that caught it
      is the one that resets twice.
    */
    const key = `__pw_reset_${token}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // A document with no storage access is not one we need to reset.
      return
    }
    localStorage.removeItem('plotweave-ui')
    localStorage.setItem('plotweave-tutorial', JSON.stringify({ step: 0, done: true }))
    indexedDB.deleteDatabase('PlotWeaveDB')
  }, nonce)

  /*
    A full document load, deliberately. Going to "/#/" would be a hash change,
    which does not re-run init scripts and would leave the app running against
    the database we just asked to delete.

    The router rewrites "/" to "/#/" on mount, and that client-side navigation
    can land mid-goto, which Playwright reports as "interrupted by another
    navigation". An interrupted goto leaves the page somewhere harmless, so it
    is retried rather than failed. Five attempts rather than three: with files
    running in parallel this race lands more often.
  */
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 60_000 })
      return
    } catch (err) {
      if (attempt >= 4 || !String(err).includes('interrupted by another navigation')) throw err
      await page.waitForTimeout(250)
    }
  }
}
