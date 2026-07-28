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
