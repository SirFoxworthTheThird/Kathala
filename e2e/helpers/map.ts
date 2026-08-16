import { expect, type Page } from '@playwright/test'

/**
 * Set-up-once and occasional map commands (scale, levels, replace image,
 * export, the AI tools) live behind the floating toolbar's overflow menu so
 * they don't eat vertical space from the canvas. Opening it is a click.
 */
export async function openMapTools(page: Page) {
  await page.getByRole('button', { name: 'Map tools' }).click()
}

/**
 * Waits for the map view to finish rendering. The floating toolbar only mounts
 * once a layer is active, so it doubles as a readiness signal.
 */
export async function waitForMapReady(page: Page) {
  await expect(page.getByRole('button', { name: 'Map tools' })).toBeVisible({ timeout: 15_000 })
}

/**
 * One of the sidebar's six section headers, by the name it shows.
 *
 * Reaching for these by role and name alone is not safe, because the names are
 * not the sidebar's to reserve: the root map that `sectionImport` creates for a
 * world with no uploaded image is called **Locations**, the same word as the
 * section below it, and once SB-6 made the layer name a button a page-wide
 * `getByRole('button', { name: /^Locations/ }).first()` started landing on the
 * map layer instead of the header. The section then never opened, and the
 * location row the test wanted was matched by a Leaflet marker underneath the
 * drawer — which fails as an unrelated-looking "element intercepts pointer
 * events", nowhere near the line at fault.
 *
 * `aria-expanded` is the discriminator rather than a test-only attribute: it is
 * what makes these headers disclosures, and the layer rows do not have it.
 */
export function sidebarSection(page: Page, name: string | RegExp) {
  return page.locator('button[aria-expanded]').filter({ hasText: name })
}
