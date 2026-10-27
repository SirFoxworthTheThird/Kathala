import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { parkCursor } from './helpers/cursor'

/**
 * Part E2: the reader's schedule, on the Knowledge screen. Each fact the
 * reader is set to learn, drawn against the chapters in reading order — its
 * reveal, and every earlier chapter whose prose gives it away — and what the
 * reader knows at the time cursor, with the strand that told them.
 *
 * Run 10's case: the Compact, three centuries on, naming the Opener in
 * chapter 11 when the Mercy was to reveal it in chapter 19.
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
    const scenes = [
      ['e1', 'c1', 'mercy', 1, 'Departure', 'The Mercy left port.'],
      ['e11', 'c11', 'compact', 11, 'The Archive', 'In the archive, the Opener was only a name.'],
      ['e12', 'c12', 'compact', 12, 'The Logs', 'Nobody read the logs.'],
      ['e19', 'c19', 'mercy', 19, 'The Reveal', 'Ilse was the Opener.'],
    ] as const
    let i = 0
    for (const [eid, cid, tl, number, title, text] of scenes) {
      i++
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: tl, title, description: '', sortOrder: 1,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 8, updatedAt: now })
    }
    await db.knowledgeFacts.add({ id: 'opener', worldId: id, title: 'Ilse is the Opener', description: '', tags: [], spoilerWords: ['the Opener'], readerLearnsAtEventId: 'e19', createdAt: now, updatedAt: now })
    await db.knowledgeFacts.add({ id: 'port', worldId: id, title: 'The Mercy has sailed', description: '', tags: [], spoilerWords: [], readerLearnsAtEventId: 'e1', createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

async function openSchedule(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: 'Reader’s schedule' }).click()
  await expect(page.getByRole('table', { name: 'The reader’s schedule' })).toBeVisible()
}

const known = (page: Page) => page.getByRole('region', { name: /^What the reader knows/ })

test('the reader’s schedule draws a strand telling a fact early, and what the reader knows at the cursor', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await openSchedule(page, worldId)
  const table = page.getByRole('table', { name: 'The reader’s schedule' })
  const opener = table.getByRole('row', { name: /Ilse is the Opener/ })

  // Its reveal, in its strand; and the other strand giving it away eight chapters before.
  await expect(opener.getByRole('cell', { name: 'Reveal: Ch. 19, The Mercy' })).toHaveCount(1)
  await expect(opener.getByRole('cell', { name: 'Ch. 11, The Compact gives it away 8 chapters early (“the Opener”)' })).toHaveCount(1)
  // Nothing early for the fact told where it should be.
  const port = table.getByRole('row', { name: /The Mercy has sailed/ })
  await expect(port.getByRole('cell', { name: 'Reveal: Ch. 1, The Mercy' })).toHaveCount(1)
  await expect(port.getByRole('cell', { name: /gives it away/ })).toHaveCount(0)

  // At chapter 12 the reader knows the Opener already, from the Compact.
  await parkCursor(page, 'e12')
  await openSchedule(page, worldId)
  await expect(known(page).getByRole('heading')).toHaveText('What the reader knows by Ch. 12, The Compact')
  await expect(known(page).getByRole('listitem').filter({ hasText: 'Ilse is the Opener' }))
    .toContainText('told early by Ch. 11, The Compact — its reveal is Ch. 19, The Mercy')
  // At chapter 1, only what chapter 1 tells.
  await parkCursor(page, 'e1')
  await openSchedule(page, worldId)
  await expect(known(page).getByRole('listitem')).toHaveCount(1)
  await expect(known(page).getByRole('listitem')).toContainText('The Mercy has sailed')
})

test('a reader is not offered the schedule: it is every reveal at once', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('button', { name: 'Reader’s schedule' })).toHaveCount(1)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as { worlds: { update: (k: string, v: unknown) => Promise<unknown> } }
    await db.worlds.update(id, { readingMode: true })
  }, worldId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('heading', { name: 'Knowledge' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reader’s schedule' })).toHaveCount(0)
})
