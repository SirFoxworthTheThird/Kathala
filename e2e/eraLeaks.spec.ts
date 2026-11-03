import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * Era-aware early reveals (run-10 plan, Part 3). Run 10's book braids three
 * eras; its judges found a reveal of Ch. 19, set in The Mercy, given away
 * eight chapters early by The Compact, three centuries on. With the fact's
 * spoiler word set, the checker says which era gives it away.
 */
const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/cold-choir.pwk')
const TITLE = 'Ilse Varga flew Deck Nine down to Ninefold'

test('a fact given away by a later era’s earlier chapter is reported as that', async ({ page }) => {
  test.setTimeout(150_000)
  await resetDB(page)
  await page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(FIXTURE)
  await expect(page.getByRole('heading', { name: 'The Cold Choir' })).toBeVisible({ timeout: 60_000 })
  await expect(page).toHaveURL(/#\/worlds\/[^/]+/)
  await settle(page)

  const checker = async () => {
    await page.getByTitle('Continuity Checker').click()
    return page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
  }

  // No spoiler words yet: nothing for this fact, early or otherwise.
  let found = await checker()
  await expect(found.getByText(/can’t be checked for early reveals/)).toBeVisible({ timeout: 30_000 })
  await expect(found.getByText(`A later era gives it away: "${TITLE}"`)).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.evaluate(async (title) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
      filter: (f: (v: { title: string }) => boolean) => { first: () => Promise<{ id: string } | undefined> }
      update: (id: string, v: unknown) => Promise<unknown>
    }>
    const fact = await db.knowledgeFacts.filter((f) => f.title === title).first()
    await db.knowledgeFacts.update(fact!.id, { spoilerWords: ['Opener'] })
  }, TITLE)

  // "Opener" is in nine scenes before Ch. 19, every one of them in The Compact or The Quiet.
  found = await checker()
  await expect(found.getByText(`A later era gives it away: "${TITLE}"`)).toHaveCount(9, { timeout: 30_000 })
  await expect(found.getByText(`Possible early reveal: "${TITLE}"`)).toHaveCount(0)
  await expect(found.getByText(`An earlier era gives it away: "${TITLE}"`)).toHaveCount(0)
  await expect(found.getByText(
    'The reader is set to learn this in Ch. 19, The Mercy, but "The Old Ban" (Ch. 11, The Compact) already references it (matched "Opener").',
  )).toBeVisible()
})
