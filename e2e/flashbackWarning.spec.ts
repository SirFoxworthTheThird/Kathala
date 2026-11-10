import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/*
  The warning that a scene is set before the one in front of it (writer run
  2026-11-09, W-E; round-trip-plan.md, T6). It said "Ch. 3 is set on day 4,
  and Ch. 3 (…) on day 6" where both were scenes; it told the writer to mark
  the scene a flashback and gave no way to; its way out went to the chapter,
  not the scene; and "+ Flashback" on the card only showed a toggle to click
  again.
*/

async function seed(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Varrow')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl1', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl1', number: 3, title: 'The Marsh', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scene = (sid: string, title: string, sortOrder: number, day: number) => db.events.add({
      id: sid, worldId: id, chapterId: 'ch1', timelineId: 'tl1', title, description: '', sortOrder, tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: day, structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    await scene('e1', 'The price', 0, 6)
    await scene('e2', 'What the Kestrel Carried', 1, 4)
  }, worldId)
  return worldId
}

const flashback = (page: Page, id: string) => page.evaluate(async (sid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { get: (k: string) => Promise<{ isFlashback?: boolean } | undefined> }>
  return (await db.events.get(sid))?.isFlashback ?? false
}, id)

test.describe('a scene set before the one in front of it (round-trip-plan.md, T6)', () => {
  test.describe.configure({ timeout: 150_000 })

  test('the warning names both scenes, goes to the scene, and marks it a flashback from where it is', async ({ page }) => {
    const worldId = await seed(page)
    await page.goto(`/#/worlds/${worldId}`)
    await settle(page)
    await page.getByTitle('Continuity Checker').click()
    const checker = page.getByRole('dialog').filter({ hasText: 'Continuity Checker' })
    const warning = checker.getByText('"What the Kestrel Carried" happens before the scene in front of it')
    await expect(warning).toBeVisible()
    await expect(checker).toContainText('"What the Kestrel Carried" (Ch. 3) is set on day 4, and the scene before it, "The price" (Ch. 3), on day 6.')

    // Its way there goes to the scene: the book opens at it, with the cursor on it.
    await checker.getByRole('button', { name: 'Go to scene' }).click()
    await expect(page).toHaveURL(/\/manuscript\/ch1/)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}')?.state?.activeEventId)).toBe('e2')
    // And the Page is open at it to write in, where going to its chapter leaves the caret nowhere.
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.cm-content')), { timeout: 20_000 }).toBe(true)

    // What it says to do, done from it.
    await page.getByTitle('Continuity Checker').click()
    expect(await flashback(page, 'e2')).toBe(false)
    await checker.getByRole('button', { name: 'Mark as a flashback' }).click()
    await expect.poll(() => flashback(page, 'e2')).toBe(true)
    await expect(checker.getByText('happens before the scene in front of it')).toHaveCount(0)
  })

  test('"+ Flashback" on a scene card marks it in one click, and the toggle says it is pressed', async ({ page }) => {
    const worldId = await seed(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/ch1`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click()
    await page.getByRole('button', { name: 'Expand “The price”' }).click()
    const offer = page.getByRole('button', { name: '+ Flashback' })
    await expect(offer).toBeVisible({ timeout: 20_000 })
    expect(await flashback(page, 'e1')).toBe(false)
    await offer.click()
    await expect.poll(() => flashback(page, 'e1')).toBe(true)
    const toggle = page.getByRole('button', { name: 'Flashback / Retrospective' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // And a second click on the toggle unmarks it, and says so.
    await toggle.click()
    await expect.poll(() => flashback(page, 'e1')).toBe(false)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
