import { expect, type Page } from '@playwright/test'
import { resetDB } from './reset'
import { dismissFirstRunGuide } from './nav'

/*
  A small braided book for the *All timelines* specs: two ages, the First
  Age's chapter 1 and the Second Age's 2 and 3, one scene each. The Second
  Age starts at day 36500 of the world, and its first scene is pinned at day 5.
*/

/** Two ages braided: the First Age's chapter 1, the Second Age's 2 and 3. */
export async function braid(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Long Haul')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tA', worldId: id, name: 'The First Age', description: '', color: '#6366f1', dayOffset: 0, position: 0, createdAt: now })
    await db.timelines.add({ id: 'tB', worldId: id, name: 'The Second Age', description: '', color: '#f59e0b', dayOffset: 36500, position: 1, createdAt: now })
    const chapters: Array<[string, string, number, string, string, number | null]> = [
      ['c1', 'tA', 1, 'Ash', 'Ash fell on the colony.', null],
      ['c2', 'tB', 2, 'Brine', 'Brine in the pipes again.', 5],
      ['c3', 'tB', 3, 'Cinder', 'Cinder light over the yards.', null],
    ]
    for (const [cid, tl, number, title, prose, day] of chapters) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: tl, number, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e-${cid}`, worldId: id, chapterId: cid, timelineId: tl, title: `${title} scene`, description: '', sortOrder: 0,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: day, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t-${cid}`, worldId: id, eventId: `e-${cid}`, text: prose, wordCount: 5, updatedAt: now })
    }
  }, worldId)
  return worldId
}

/** The book's chapters in number order, and each scene's timeline: number:title:timeline. */
export const numbering = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<Record<string, string & number>>> }>
  const scenes = await db.events.toArray()
  return (await db.chapters.toArray()).sort((a, b) => a.number - b.number).map((c) => {
    const own = scenes.filter((e) => e.chapterId === c.id)
    // A chapter's scenes are in its timeline: say where one is not.
    const stray = own.some((e) => e.timelineId !== c.timelineId) ? ' (scene elsewhere)' : ''
    return `${c.number}:${c.title}:${c.timelineId}${stray}`
  })
})
