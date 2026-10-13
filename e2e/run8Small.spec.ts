import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * What writer run 8 noted while writing *Slack Water*:
 *
 * - The Appearances tab counted mentions as appearances: "37" for a man who is
 *   never on stage.
 * - On Knowledge, clicking the open fact closed it, and one person's knowing
 *   it could not be found to take away.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Slack Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const [n, cast] of [[1, ['nell']], [2, ['nell']], [3, []]] as const) {
      await db.events.add({
        id: `e${n}`, worldId: id, chapterId: 'c1', timelineId: 'tl', title: `Scene ${n}`, description: '', sortOrder: n,
        tags: [], locationMarkerId: null, involvedCharacterIds: [...cast], mentionedCharacterIds: ['edmund'], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
    for (const [cid, name] of [['nell', 'Nell Garrity'], ['edmund', 'Edmund Varley']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.knowledgeFacts.add({ id: 'reel', worldId: id, title: 'The reel was cut', description: '', tags: [], readerLearnsAtEventId: null, originEventId: null, createdAt: now, updatedAt: now })
    await db.knowledgeReveals.add({ id: 'r1', worldId: id, factId: 'reel', characterId: 'nell', eventId: 'e2', note: '', createdAt: now, updatedAt: now })
  }, worldId)
  return worldId
}

test.describe('what writer run 8 noted', () => {
  test.describe.configure({ timeout: 150_000 })

  test('the Appearances tab counts scenes on stage, and says the mentions apart', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/characters/edmund`, { waitUntil: 'load' })
    await settle(page)
    // Never on stage, named in three scenes.
    await expect(page.getByRole('tab', { name: 'Appearances 0 · 3 mentioned' })).toBeVisible({ timeout: 20_000 })
    // On stage in two, and never mentioned: the count alone, as it was.
    await page.goto(`/#/worlds/${worldId}/characters/nell`)
    await settle(page)
    await expect(page.getByRole('tab', { name: 'Appearances 2', exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test('a fact stays open when clicked again; one person’s knowing it is taken away by name; ✕ closes it', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/knowledge`, { waitUntil: 'load' })
    await settle(page)
    const fact = page.getByRole('button', { name: /The reel was cut/ }).first()
    const knownBy = page.getByText(/Known by \(1\)/)
    await fact.click()
    await expect(knownBy).toBeVisible()
    await fact.click()
    await page.waitForTimeout(300)
    await expect(knownBy).toBeVisible()

    await page.getByRole('button', { name: 'Nell Garrity does not know this', exact: true }).click()
    await expect(page.getByText(/Known by \(0\)/)).toBeVisible()
    expect(await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as { knowledgeReveals: { count: () => Promise<number> } }
      return db.knowledgeReveals.count()
    })).toBe(0)

    await page.getByRole('button', { name: 'Close the fact', exact: true }).click()
    await expect(page.getByText(/Known by/)).toHaveCount(0)
  })
})
