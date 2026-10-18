import { test, expect, type Page } from '@playwright/test'
import { settle } from './helpers/settle'
import { braid } from './helpers/braid'

/**
 * Spoiler words (run-10 plan, Part 3). A fact the reader learns at a set scene
 * is asked for the words that would give it away, suggested from the names it
 * uses; the early-reveal check matches them; and the Continuity screen says
 * which facts it cannot look for, rather than passing them over. Run 10's
 * facts had nothing to match, and a reveal given away eight chapters early
 * went unreported.
 */

/** A fact about Ash, and Ash, in the braided book: the reader is to learn it in Ch. 3 — or, unset, whenever. */
async function withFact(page: Page, worldId: string) {
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.characters.add({
      id: 'ash', worldId: id, name: 'Ash', description: '', aliases: [], tags: [],
      portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.knowledgeFacts.add({
      id: 'sold', worldId: id, title: 'Ash sold the colony', description: '', tags: [],
      readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now,
    })
  }, worldId)
}

const checker = async (page: Page) => {
  await page.getByTitle('Continuity Checker').click()
  return page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
}

test('a fact the reader learns at a set scene is asked for its spoiler words, and the check uses them', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await braid(page)
  await withFact(page, worldId)
  await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: /Ash sold the colony/ }).first().click()
  // Learned whenever a POV character knows it: no set scene to be early for, so nothing asked.
  await expect(page.getByText('Reader learns at')).toBeVisible()
  await expect(page.getByLabel('Add a spoiler word')).toHaveCount(0)

  // Set to Ch. 3's scene: now it is asked, with the name the fact uses offered.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { update: (id: string, v: unknown) => Promise<unknown> }>
    await db.knowledgeFacts.update('sold', { readerLearnsAtEventId: 'e-c3' })
  })
  await expect(page.getByLabel('Add a spoiler word')).toBeVisible()

  // Nothing to look for yet: the checker says so.
  let found = await checker(page)
  await expect(found.getByText('1 fact can’t be checked for early reveals')).toBeVisible({ timeout: 30_000 })
  await expect(found.getByText(/Possible early reveal/)).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Its own name, from the suggestion, and a word typed: both kept.
  await page.getByRole('button', { name: 'Add “Ash”' }).click()
  await page.getByLabel('Add a spoiler word').fill('pipes')
  await page.keyboard.press('Enter')
  const list = page.getByRole('list', { name: 'Spoiler words' })
  await expect(list.getByRole('listitem')).toHaveText(['Ash', 'pipes'])
  await expect(page.getByRole('button', { name: 'Add “Ash”' })).toHaveCount(0)

  // Ch. 1 says "Ash", Ch. 2 "pipes": both before Ch. 3, both listed; and the fact is no longer unchecked.
  found = await checker(page)
  await expect(found.getByText('Possible early reveal: "Ash sold the colony"')).toHaveCount(2, { timeout: 30_000 })
  await expect(found.getByText(/can’t be checked for early reveals/)).toHaveCount(0)
})
