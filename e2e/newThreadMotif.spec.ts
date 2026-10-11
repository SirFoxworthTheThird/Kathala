import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A plot thread or motif made from a scene's own field — beside the Page, and
 * on a scene card — and tagged on that scene, without the dashboard.
 */

async function book(page: Page, opts: { thread?: boolean } = {}): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Assize')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async ([id, thread]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The assize rises', 'The court sat.'], ['e2', 'Teodora at the table', 'She counted.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 3, updatedAt: now })
    }
    if (thread) await db.plotThreads.add({ id: 'debt', worldId: id, name: 'The debt', description: '', color: '#f59e0b', createdAt: now, updatedAt: now })
  }, [worldId, !!opts.thread] as const)
  return worldId
}

/** Each scene's threads and motifs, by name. */
const tagged = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { toArray: () => Promise<Array<{ id: string; threadIds: string[]; motifIds: string[] }>> }
    plotThreads: { toArray: () => Promise<Array<{ id: string; name: string }>> }
    motifs: { toArray: () => Promise<Array<{ id: string; name: string }>> }
  }
  const threads = await db.plotThreads.toArray()
  const motifs = await db.motifs.toArray()
  const name = (list: Array<{ id: string; name: string }>, id: string) => list.find((x) => x.id === id)?.name ?? id
  return Object.fromEntries((await db.events.toArray()).map((e) => [e.id, {
    threads: e.threadIds.map((id) => name(threads, id)), motifs: e.motifIds.map((id) => name(motifs, id)),
  }]))
})

test.describe('a thread or motif made from the scene', () => {
  test.describe.configure({ timeout: 150_000 })

  test('beside the Page, in a world with none yet: made, and tagged on the scene the caret is in', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    await page.locator('.cm-line', { hasText: 'She counted.' }).first().click()
    const scene = page.getByRole('complementary', { name: 'The open chapter' }).getByRole('region', { name: 'This scene' })
    await expect(scene).toContainText('Teodora at the table')
    await scene.getByRole('button', { name: 'More about this scene' }).click()

    await scene.getByRole('button', { name: 'New thread for this scene', exact: true }).click()
    await scene.getByLabel('Name of the new thread').fill('The tide debt')
    await page.keyboard.press('Enter')
    await expect.poll(() => tagged(page)).toEqual({ e1: { threads: [], motifs: [] }, e2: { threads: ['The tide debt'], motifs: [] } })
    await expect(scene.getByLabel('Remove thread The tide debt')).toBeVisible()
    await expect(scene.getByLabel('Name of the new thread')).toHaveCount(0)

    await scene.getByRole('button', { name: 'New motif for this scene', exact: true }).click()
    await scene.getByLabel('Name of the new motif').fill('Drowned bells')
    await scene.getByRole('button', { name: 'Make it', exact: true }).click()
    await expect.poll(() => tagged(page)).toEqual({ e1: { threads: [], motifs: [] }, e2: { threads: ['The tide debt'], motifs: ['Drowned bells'] } })

    // Cancel makes nothing.
    await scene.getByRole('button', { name: 'New motif for this scene', exact: true }).click()
    await scene.getByLabel('Name of the new motif').fill('Never this')
    await scene.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await page.evaluate(async () => (await ((window as { __pwdb?: never }).__pwdb as unknown as { motifs: { count: () => Promise<number> } }).motifs.count()))).toBe(1)
  })

  test('on a scene card: made beside the threads the world has, and tagged on that scene', async ({ page }) => {
    const worldId = await book(page, { thread: true })
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Teodora at the table', exact: true }).click()
    await main.getByRole('button', { name: '+ Plot Threads' }).click()
    await main.getByRole('button', { name: 'New thread for this scene', exact: true }).click()
    await main.getByLabel('Name of the new thread').fill('The rebellion')
    await page.keyboard.press('Enter')
    await expect.poll(() => tagged(page)).toEqual({ e1: { threads: [], motifs: [] }, e2: { threads: ['The rebellion'], motifs: [] } })
    await expect(main.getByLabel('Remove thread The rebellion')).toBeVisible()
  })
})
