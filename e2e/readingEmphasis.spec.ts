import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * The book's italics are italics, not underscores.
 *
 * Project Gutenberg writes emphasis as `_like this_`, and every book in the
 * Library carries it that way — 6,304 spans across 28 of the 41. The manuscript
 * printed the underscores, so a blind reader run reading *The Count of Monte
 * Cristo* met them on the first page and went on meeting them for 117 chapters.
 *
 * Alice rather than Monte Cristo because it downloads fast enough to reset per
 * test; the fault and the fix are the same in both.
 */

const prose = (page: Page) => page.locator('[data-scene-event-id]')

async function openBook(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await expect(prose(page).first()).toBeVisible({ timeout: 60_000 })
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a reader sees emphasis rendered, and no underscores around it', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)

  /*
    The presence that makes the absence mean something. If the stored prose had
    no underscores — a re-exported book, a different edition — then "no
    underscores on screen" would pass while proving nothing at all.
  */
  const stored = await page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: {
      sceneTexts: { toArray: () => Promise<{ text: string }[]> }
    } }).__pwdb
    const all = await db!.sceneTexts.toArray()
    const joined = all.map((t) => t.text).join('\n')
    return {
      pairs: (joined.match(/(?<![A-Za-z0-9_])_[^_\n]+_(?![A-Za-z0-9_])/g) ?? []).length,
      hasVery: joined.includes('_very_'),
    }
  })
  expect(stored.pairs, 'the downloaded book stores underscored emphasis').toBeGreaterThan(50)
  expect(stored.hasVery, 'including the one this test reads back off the page').toBe(true)

  await openBook(page, worldId)

  /*
    Soft, both of them, so one red run reports on both claims. Hard assertions
    stop at the first failure, and the first time this was run against unparsed
    prose only the `<em>` check reported — leaving the half that catches a
    *partial* fix, emphasis rendered but delimiters left behind, unexercised.
  */

  // Rendered as real emphasis. "There was nothing so _very_ remarkable in that"
  // is the first page of chapter 1.
  await expect
    .soft(page.getByRole('main').locator('em', { hasText: /^very$/ }).first(),
      'the emphasis is an <em>')
    .toBeVisible()

  // And nowhere on the page does a reader see the delimiters.
  const shown = await page.getByRole('main').innerText()
  expect(shown.length, 'the book is actually on screen').toBeGreaterThan(2000)
  const leftover = shown.match(/(?<![A-Za-z0-9_])_[^_\n]+_(?![A-Za-z0-9_])/g) ?? []
  expect.soft(leftover, `underscores still on the page: ${leftover.slice(0, 5).join(', ')}`)
    .toEqual([])
})

test('the writer drafting the same book sees it rendered too', async ({ page }) => {
  /*
    The Manuscript screen is read-only in both modes — the prose is edited on the
    scene, not here — so there is no reason for an author to be shown the
    markup while a reader is not. Pairing the modes also stops a fix that only
    reached the reading branch from passing.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await openBook(page, worldId)

  await expect(
    page.getByRole('main').locator('em', { hasText: /^very$/ }).first(),
  ).toBeVisible()
})
