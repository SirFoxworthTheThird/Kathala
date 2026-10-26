import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'
import { readAt } from './helpers/cursor'

/**
 * The helper that puts the cursor at a scene for eleven specs
 * (`helpers/cursor.ts`), held to the case that made them flaky: a reading
 * world the app has not placed yet has no `eventByWorld` entry, and opening it
 * puts the reader at its first scene. A write that only updated the entries
 * already there lost the cursor whenever it got in first. Here it always gets
 * in first, so the case is the same on every run rather than one in
 * twenty-four.
 *
 * Two worlds alike, because placing one uses up its case: the first is opened
 * as it is, to show the app does put an unplaced reader at the start; the
 * second has the cursor parked, and keeps it.
 */

/** A reading world of two scenes, `<id>-1` and `<id>-2`, cloned from the one the UI made. */
async function seedReadingWorld(page: Page, from: string, id: string) {
  await page.evaluate(async ({ from, id }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
      add: (v: unknown) => Promise<unknown>; get: (k: string) => Promise<Record<string, unknown>>
    }>
    const now = Date.now()
    if (id !== from) await db.worlds.add({ ...(await db.worlds.get(from)), id, name: `Unplaced ${id}` })
    await (db.worlds as unknown as { update: (k: string, v: unknown) => Promise<unknown> }).update(id, { readingMode: true })
    await db.timelines.add({ id: `${id}-tl`, worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: `${id}-c1`, worldId: id, timelineId: `${id}-tl`, number: 1, title: 'Opening', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const n of [1, 2]) {
      await db.events.add({
        id: `${id}-${n}`, worldId: id, chapterId: `${id}-c1`, timelineId: `${id}-tl`, title: `Scene ${n}`, description: '', sortOrder: n,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, { from, id })
}

const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state ?? {})

/** At the world's address, with the app on another screen and none the wiser. */
async function standAt(page: Page, worldId: string) {
  await page.goto('/#/', { waitUntil: 'load' })
  await settle(page)
  expect((await stored(page)).eventByWorld ?? {}, 'not placed yet').not.toHaveProperty(worldId)
  await page.evaluate((id) => history.replaceState(null, '', `#/worlds/${id}/`), worldId)
}

test('the cursor is parked in a reading world the app has not placed yet', async ({ page }) => {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Unplaced')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const made = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await seedReadingWorld(page, made, made)
  await seedReadingWorld(page, made, 'second')

  // Opened as it is: the reader is put at the start.
  await standAt(page, made)
  await page.reload({ waitUntil: 'load' })
  await expect.poll(async () => (await stored(page)).eventByWorld?.[made]).toBe(`${made}-1`)

  // Parked: kept, past the app's own opening.
  await standAt(page, 'second')
  await readAt(page, 'second-2')
  expect((await stored(page)).eventByWorld.second).toBe('second-2')
})
