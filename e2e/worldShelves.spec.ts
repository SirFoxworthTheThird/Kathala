import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Two shelves on the world selector.
 *
 * A book from the library and a draft being written sort together by creation
 * date, so a reader with a few downloads loses their own work among other
 * people's books. What has to hold is that each world lands on the right shelf
 * — and that the shelf headings only appear when there is something to head.
 */

async function newWorld(page: Page, name: string) {
  await page.getByRole('button', { name: 'New World' }).first().click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await page.goto('/#/')
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible()
}

async function downloadBook(page: Page, title: string) {
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  const row = page.locator('li', { hasText: title }).first()
  await row.getByRole('button', { name: /^Download \(/ }).click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 120_000 })
  await page.goto('/#/')
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toBeVisible()
}

/** The cards under a given heading. */
const shelf = (page: Page, name: RegExp) =>
  page.locator('main section').filter({ has: page.getByRole('heading', { name }) })

test('a draft and a downloaded book land on different shelves', async ({ page }) => {
  test.setTimeout(180_000)
  await resetDB(page)

  await newWorld(page, 'My Novel')

  // With nothing to read, there is no reading shelf and no heading over the
  // drafts either — one list needs no label.
  await expect(page.getByRole('heading', { name: /Reading/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Your worlds/i })).toHaveCount(0)
  await expect(page.getByText('My Novel')).toBeVisible()

  await downloadBook(page, 'Dracula')

  // Now both headings exist, and each world is under the right one.
  await expect(shelf(page, /Your worlds/i)).toContainText('My Novel')
  await expect(shelf(page, /Your worlds/i)).not.toContainText('Dracula')
  await expect(shelf(page, /Reading/i)).toContainText('Dracula')
  await expect(shelf(page, /Reading/i)).not.toContainText('My Novel')
})

test('the start-from-scratch tile stays with the drafts', async ({ page }) => {
  test.setTimeout(180_000)
  await resetDB(page)
  await newWorld(page, 'My Novel')
  await downloadBook(page, 'Dracula')

  // It makes a world to write, so it belongs on that shelf and not the other.
  // SEL-5: it used to be called "New World" — the header button's name — so a
  // populated screen offered one thing under one name twice.
  const tile = 'Start from scratch'
  await expect(shelf(page, /Your worlds/i).getByRole('button', { name: tile })).toBeVisible()
  await expect(shelf(page, /Reading/i).getByRole('button', { name: tile })).toHaveCount(0)

  // And the name really is distinct: the header's button stays the only thing
  // on the page called "New World", populated screen and all. The empty state
  // already held this line (see selectorGroups.spec.ts); the populated one did
  // not, which is the finding.
  await expect(page.getByRole('button', { name: 'New World' })).toHaveCount(1)
  // It still opens the same dialog the header's button does.
  await shelf(page, /Your worlds/i).getByRole('button', { name: tile }).click()
  await expect(page.getByRole('heading', { name: 'Create New World' })).toBeVisible()
})

test('turning reading mode off moves the book to your own shelf', async ({ page }) => {
  test.setTimeout(180_000)
  await resetDB(page)
  await downloadBook(page, 'Dracula')

  await expect(shelf(page, /Reading/i)).toContainText('Dracula')

  // The guide tells a writer to turn reading mode off to edit a downloaded
  // world. Doing so makes it theirs, and the shelf follows rather than leaving
  // an editable world filed under Reading.
  await page.getByText('Dracula').first().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  await page.goto(`/#${new URL(page.url()).hash.replace('#', '').split('/').slice(0, 3).join('/')}/settings`)
  await page.getByRole('button', { name: 'Turn off reading mode' }).click()
  await settle(page)

  await page.goto('/#/')
  // No reading shelf left to be on, and the book is still here — the pairing
  // matters, since a world that simply vanished would also lose the heading.
  await expect(page.getByRole('heading', { name: /Reading/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Dracula' })).toBeVisible()
})
