import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * The built app's Content-Security-Policy (`src/lib/contentSecurityPolicy.ts`),
 * there so that a script the app did not ship cannot run beside the API key the
 * AI audit can be given (Part F3). The suite runs against the production
 * build, where the policy is; every other spec passing is the app's own
 * scripts, styles, pictures and the Library working under it.
 */

test('a script the app did not ship is refused, while the app’s own run', async ({ page }) => {
  await resetDB(page)
  // The app's own: it is running.
  await expect(page.getByRole('button', { name: 'New World' })).toBeVisible()
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain("script-src 'self'")

  const result = await page.evaluate(async () => {
    const refused: string[] = []
    document.addEventListener('securitypolicyviolation', (e) => refused.push(e.violatedDirective))
    // Inline, as an injected <script> would be.
    const inline = document.createElement('script')
    inline.textContent = 'window.__injected = "inline"'
    document.head.append(inline)
    // From elsewhere.
    const remote = document.createElement('script')
    remote.src = 'https://example.com/steal.js'
    document.head.append(remote)
    /*
      Not eval: what the test harness runs is outside the page's policy, so an
      eval from here proves nothing either way. That the policy grants no
      'unsafe-eval' is held in `apiKeyProtection.test.ts`.
    */
    await new Promise((r) => setTimeout(r, 500))
    return { injected: (window as { __injected?: string }).__injected ?? null, refused }
  })
  expect(result.injected).toBeNull()
  expect(result.refused.filter((d) => d.startsWith('script-src'))).toHaveLength(2)
})
