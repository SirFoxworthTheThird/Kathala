import { expect, type Page } from '@playwright/test'

/**
 * Download a named world from the Library.
 *
 * Specs used to take `Download (…)` `.first()`, which meant *Harry Potter and
 * the Philosopher's Stone* only because that is the order `index.json` happened
 * to list. Filing the catalogue alphabetically (**LIB-1**) moved *Around the
 * World in Eighty Days* to the top and six specs started asserting Hogwarts
 * facts about Phileas Fogg.
 *
 * The order of a catalogue is not something a test about factions or pacing
 * should depend on, so say which book you mean. `libraryCovers` already scoped
 * its cards this way; this is that pattern, shared.
 */
export async function downloadLibraryBook(page: Page, title: string) {
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  const card = page.locator('li', { hasText: title }).first()
  // The catalogue is fetched, so wait for the card rather than for a timeout.
  await expect(card).toBeVisible({ timeout: 60_000 })
  await card.scrollIntoViewIfNeeded()
  await card.getByRole('button', { name: /^Download \(/ }).click()
  await expect(page).toHaveURL(/#\/worlds\//, { timeout: 90_000 })
}

/**
 * The book most reading-mode specs are written against: a large cast, several
 * chapters, maps, and factions — and the one they all silently assumed.
 */
export const DEFAULT_BOOK = "Harry Potter and the Philosopher's Stone"
