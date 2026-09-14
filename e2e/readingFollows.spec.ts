import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Reading mode now hands the reader the book, and follows them through it.
 *
 * Thirty-one of the shipped worlds carry the complete text of a public-domain
 * novel — their catalogue entries call themselves reading-mode editions — and
 * the screen that shows it was closed to exactly the reader it was assembled
 * for. The rules that keep the cursor from taking anything away live in
 * `src/lib/readingPosition.ts` and are unit-tested there; what needs a browser
 * is whether the screen is reachable, whether it reads as a book rather than as
 * a draft, and whether a freshly downloaded world starts closed.
 */

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a downloaded book opens at its first scene, not at "all chapters"', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  // A null cursor means every chapter, which on a book nobody has read is the
  // whole plot. The position is recorded against the world, so read it back.
  const position = await page.evaluate(() => {
    const raw = localStorage.getItem('plotweave-ui')
    const st = raw ? JSON.parse(raw) : null
    const byWorld = st?.state?.eventByWorld ?? {}
    const ids = Object.values(byWorld)
    return { count: ids.length, anyNull: ids.some((v) => v === null) }
  })
  expect(position.count).toBeGreaterThan(0)
  expect(position.anyNull).toBe(false)
})

test('the reader is offered the book, under a reader’s name for it', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Read', exact: true })).toBeVisible()
  // "Manuscript" is what an author calls their draft; there is no author here.
  await expect(nav.getByRole('link', { name: 'Manuscript', exact: true })).toHaveCount(0)
})

test('a world with no prose offers no book at all', async ({ page }) => {
  // The paired absence. Harry Potter is structural notes only — its own
  // catalogue entry says "no text from the book is included" — so a Read link
  // there would open a screen with nothing on it.
  await downloadLibraryBook(page, "Harry Potter and the Philosopher's Stone")
  await settle(page)

  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Characters' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Read', exact: true })).toHaveCount(0)
})

test('the book reads as a book, not as a draft', async ({ page }) => {
  await downloadLibraryBook(page, 'Dracula')
  await settle(page)

  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Read', exact: true }).click()
  await settle(page)

  const main = page.getByRole('main')
  // The prose is there.
  await expect(main.getByText(/Jonathan Harker/i).first()).toBeVisible()

  // And the author's instruments are not: no draft/reading switch, no word
  // goal, no "scenes written" tally, no export or find-and-replace.
  await expect(main.getByRole('group', { name: 'View mode' })).toHaveCount(0)
  await expect(main.getByLabel('Word goal for the book')).toHaveCount(0)
  await expect(main.getByText(/scenes written/)).toHaveCount(0)
  await expect(main.getByRole('button', { name: /Find & replace/ })).toHaveCount(0)
  await expect(main.getByRole('button', { name: /^Export$/ })).toHaveCount(0)
})
