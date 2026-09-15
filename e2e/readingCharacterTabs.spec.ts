import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { downloadLibraryBook } from './helpers/library'

/**
 * Current State answers the question the character page is open for.
 *
 * A blind reader run clicked **Current State** on Mercédès four times and stayed
 * on Overview every time. `tabCounts` had no `state` key, so `hasTab('state')`
 * was `(undefined ?? 0) > 0` — false for every reader — and `activeTab` fell
 * back to overview while the trigger went on rendering.
 *
 * The cost is not only a dead control. *Where is she now, is she still alive*
 * is the question a reader opens a character for mid-book, and without this tab
 * the page is one whole-book sentence and a History list.
 */

const tab = (page: Page, name: string | RegExp) => page.getByRole('tab', { name })

async function openFirstCharacter(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('main').getByRole('link').first().click()
  await settle(page)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a reader can open Current State, and it stays open', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)
  await openFirstCharacter(page, worldId)

  const state = tab(page, 'Current State')
  await expect(state).toBeVisible()
  await state.click()

  // Selected, and still selected — the failure was a snap back to Overview.
  await expect(state).toHaveAttribute('aria-selected', 'true')
  await expect(tab(page, 'Overview')).toHaveAttribute('aria-selected', 'false')
  await page.waitForTimeout(500)
  await expect(state, 'and it did not bounce back a moment later')
    .toHaveAttribute('aria-selected', 'true')
})

test('reading offers fewer tabs than writing, but never fewer than the two that say who this is', async ({ page }) => {
  /*
    The pair, on one character, so neither half can be satisfied alone.

    CH-3's rule stands: a tab with nothing behind it is a finding to a writer and
    a dead end to a reader, so reading must offer *fewer*. But Overview and
    Current State answer "who is this again", which is the whole reason the page
    is open, so they are offered whatever their counts.

    Comparing the same character in both modes rather than naming a tab: the
    first version of this asserted Goals was absent on Alice's first character,
    who turns out to have two. The rule is about the relationship between the
    two sets, not about any particular book's cast.
  */
  const worldId = await downloadLibraryBook(page, 'Alice\u2019s Adventures in Wonderland')
  await settle(page)
  await openFirstCharacter(page, worldId)
  const characterUrl = page.url()

  /*
    Without the count badge. A trigger reads "History 2", and the same tab reads
    a different count in the other mode, so comparing the raw text compares
    numbers rather than which tabs are offered.
  */
  const tabNames = async () => (await page.getByRole('tab').allInnerTexts())
    .map((t) => t.replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim())
  const reading = await tabNames()
  expect(reading, 'the two that are always offered').toEqual(
    expect.arrayContaining(['Overview', 'Current State']),
  )

  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await page.goto(characterUrl, { waitUntil: 'load' })
  await settle(page)
  const writing = await tabNames()

  expect(writing.length, `reading ${reading.length}, writing ${writing.length}`)
    .toBeGreaterThan(reading.length)
  for (const name of reading) {
    expect(writing, `${name} is offered to a writer too`).toContain(name)
  }
  expect(writing, 'and Current State is among them').toEqual(
    expect.arrayContaining(['Overview', 'Current State']),
  )
})
