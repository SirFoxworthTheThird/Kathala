import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Part E1: the early-reveal check on the scene being written. A fact's spoiler
 * words, in a scene before the one where the reader is set to learn it, are
 * underlined on the Page as they are typed, saying where the reader learns it —
 * and, in a book braided from timelines, in which one. The same words at or
 * after the reveal are not: they are the book telling it.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Mercy')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'mercy', worldId: id, name: 'The Mercy', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'compact', worldId: id, name: 'The Compact', description: '', color: '#f59e0b', dayOffset: 113_000, createdAt: now, updatedAt: now })
    const chapters = [['c1', 'mercy', 1, 'Departure'], ['c2', 'mercy', 2, 'Deck Nine'], ['c3', 'compact', 3, 'Three Centuries On']] as const
    for (const [cid, tl, number, title] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    const scenes = [
      ['e1', 'c1', 'mercy', 'Boarding', 'The ship was quiet. Ilse kept her keys close, and nobody asked about the Opener.'],
      ['e2', 'c2', 'mercy', 'The Reveal', 'So Ilse was the Opener, all along.'],
      ['e3', 'c3', 'compact', 'The Archive', 'The archive held the old logs.'],
    ] as const
    let i = 0
    for (const [eid, cid, tl, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: tl, title, description: '', sortOrder: 1,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 10, updatedAt: now })
    }
    // Learnt at the Reveal, in its own timeline; and one learnt three centuries on, in the other.
    await db.knowledgeFacts.add({ id: 'opener', worldId: id, title: 'Ilse is the Opener', description: '', tags: [], spoilerWords: ['the Opener'], readerLearnsAtEventId: 'e2', createdAt: now, updatedAt: now })
    await db.knowledgeFacts.add({ id: 'mutiny', worldId: id, title: 'The crew mutinied', description: '', tags: [], spoilerWords: ['mutiny'], readerLearnsAtEventId: 'e3', createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  // At the first chapter, which opens the page on its timeline: the Mercy, where the scenes being written are.
  await page.goto(`/#/worlds/${worldId}/manuscript/c1`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const leaks = (page: Page) => page.locator('.cm-content .cm-draft-leak')

test('a spoiler word before the reveal is underlined as it is written, saying where the reader learns it', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openPage(page, worldId)

  // Before the reveal: underlined, and said. At the reveal: the book telling it, and not.
  await expect(leaks(page)).toHaveCount(1)
  await expect(leaks(page)).toHaveText('the Opener')
  await expect(leaks(page)).toHaveAttribute('title', 'Gives away “Ilse is the Opener”: the reader learns this in Ch. 2.')
  await expect(page.locator('.cm-line', { hasText: 'So Ilse was the Opener' }).locator('.cm-draft-leak')).toHaveCount(0)

  // Typed now, in the first chapter: a fact the reader learns in the other timeline's chapter, which is named.
  await page.locator('.cm-line', { hasText: 'The ship was quiet' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Nobody spoke of mutiny.')
  const mutiny = leaks(page).filter({ hasText: 'mutiny' })
  await expect(mutiny).toHaveCount(1)
  await expect(mutiny).toHaveAttribute('title', 'Gives away “The crew mutinied”: the reader learns this in Ch. 3, The Compact.')

  // Taken out again, it goes.
  for (let n = 0; n < ' Nobody spoke of mutiny.'.length; n++) await page.keyboard.press('Backspace')
  await expect(mutiny).toHaveCount(0)
  await expect(leaks(page)).toHaveCount(1)
})
