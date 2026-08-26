import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav, dismissFirstRunGuide } from './helpers/nav'

/**
 * A subplot needs a way to be *answered*, not dismissed.
 *
 * The checker reports a thread that stops advancing near the end as *left
 * dangling* and advises "resolve it or carry it into a later scene" — advice it
 * then made impossible to take, because a `PlotThread` had a name, a colour and
 * a description and nothing else. The only way to clear the warning was to tag
 * a late scene, which is a lie about a subplot that genuinely lands early.
 *
 * Measured on the shipped Monte Cristo before this: 50 findings, 44 of them
 * observations, and 10 of those were dangling threads that could not be acted
 * on at all.
 *
 * The rule is unit-tested in `src/lib/__tests__/threadContinuity.test.ts`. This
 * is the round trip: meet it in the checker, answer it, see it gone, and take
 * the answer back.
 */

async function bookWithADanglingThread(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ninth Bell')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.plotThreads.add({ id: 'th', worldId: id, name: 'The Marrow Conspiracy', color: '#f59e0b', description: '', createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
      id: `ch${i + 1}`, worldId: id, timelineId: 'tl', number: i + 1, title: `Chapter ${i + 1}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    // The thread advances only in Ch. 1 and Ch. 2, then five chapters of silence.
    await db.events.bulkAdd(Array.from({ length: 6 }, (_, i) => ({
      id: `ev${i + 1}`, worldId: id, chapterId: `ch${i + 1}`, timelineId: 'tl',
      title: `Scene ${i + 1}`, description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: i < 2 ? ['th'] : [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })))
  }, worldId)
  return worldId
}

const resolvedAt = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { plotThreads: { get: (id: string) => Promise<{ resolvedEventId?: string | null } | undefined> } }
  return (await db.plotThreads.get('th'))?.resolvedEventId ?? null
})

test.describe('Saying where a subplot lands', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the checker offers the answer, names the scene, and stops reporting it', async ({ page }) => {
    const worldId = await bookWithADanglingThread(page)
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settleNav(page)

    await page.getByRole('button', { name: 'Continuity Checker' }).first().click()
    const panel = page.getByRole('dialog').first()
    await expect(panel).toBeVisible({ timeout: 60_000 })

    // The finding, and nothing recorded yet.
    await expect(panel.getByText(/is left dangling/)).toBeVisible({ timeout: 30_000 })
    expect(await resolvedAt(page)).toBeNull()

    /*
      The offer names the scene it will write, so the writer agrees to that
      assertion rather than to "make the warning go away" — the lesson of the
      cast fix that silently put four people in a room they were not in.
    */
    const offer = panel.getByRole('button', { name: /Resolves at Ch\. 2 — "Scene 2"/ })
    await expect(offer).toBeVisible()
    await offer.click()

    await expect.poll(() => resolvedAt(page), { timeout: 15_000 }).toBe('ev2')
    // And the finding is gone because it has been answered, not hidden.
    await expect(panel.getByText(/is left dangling/)).toHaveCount(0)
  })

  test('and the dashboard says so, and can take it back', async ({ page }) => {
    const worldId = await bookWithADanglingThread(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { plotThreads: { update: (id: string, c: object) => Promise<unknown> } }
      await db.plotThreads.update('th', { resolvedEventId: 'ev2' })
    })
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settleNav(page)

    const row = page.getByRole('main').locator('div', { hasText: 'The Marrow Conspiracy' }).last()
    await expect(row.getByText('resolves Ch. 2')).toBeVisible({ timeout: 30_000 })
    // The dangling warning is not also shown: it has been answered.
    await expect(page.getByRole('main').getByText(/dangling/)).toHaveCount(0)

    // A statement about the book must be as easy to change as it was to make.
    await row.getByRole('button', { name: 'reopen' }).click()
    await expect.poll(() => resolvedAt(page), { timeout: 15_000 }).toBeNull()
    await expect(page.getByRole('main').getByText(/dangling/).first()).toBeVisible({ timeout: 15_000 })
  })
})
