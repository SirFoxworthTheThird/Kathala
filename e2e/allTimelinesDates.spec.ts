import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Dates, not day counts, on All timelines (run-10 plan, Part 2). Writer run 10
 * set a calendar with eras and read "Day 113491" in the merged list. A book
 * with no calendar still reads in days: `dayOffset.spec.ts`.
 */
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')

test('All timelines, in-world order, dates each scene on the book’s calendar', async ({ page }) => {
  test.setTimeout(150_000)
  await resetDB(page)
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(FIXTURE)
  await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('tablist', { name: 'Timelines' }).getByRole('tab', { name: /All timelines/ }).click()
  const main = page.getByRole('main')
  await main.getByRole('group', { name: 'Combined order' }).getByRole('button', { name: /Chronological/ }).click()

  // The book's first scene, The Mercy's Ch. 1, on 2 Longdark, 1 BL — as its When: line says.
  const first = main.getByRole('button').filter({ hasText: 'The Mercy · Ch. 1 — Deceleration' }).first()
  await expect(first).toContainText('2 Longdark, 1 BL')
  // A scene three centuries on, in its own era's years.
  await expect(main.getByRole('button').filter({ hasText: 'The Compact · Ch. 2 — The Hall of Muster' }).first()).toContainText('11 Firstwatch, 311 AL')
  // And no day counts left.
  await expect(main.getByText(/^Day \d+$/)).toHaveCount(0)

  // One timeline's own tab, in in-world order, says the same.
  await page.getByRole('tablist', { name: 'Timelines' }).getByRole('tab', { name: /The Compact/ }).click()
  await main.getByRole('group', { name: 'Timeline order' }).getByRole('button', { name: /Chronological/ }).click()
  await expect(main.getByRole('button').filter({ hasText: 'Ch. 2 — The Hall of Muster' }).first()).toContainText('11 Firstwatch, 311 AL')
  await expect(main.getByText(/^Day \d+$/)).toHaveCount(0)
})
