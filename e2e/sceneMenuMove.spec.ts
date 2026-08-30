import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settleNav, dismissFirstRunGuide } from './helpers/nav'

/**
 * N11 and N13, from a blind writer run — two things the app could do but did
 * not offer where they were looked for.
 *
 * N13: the scene's ⋯ menu contained exactly one item, *Delete scene*. Moving a
 * scene to another chapter existed on the Corkboard (drag) and in the Timeline's
 * bulk-selection toolbar, but not in the menu a writer opens first.
 *
 * N11: exporting a world named "The Ninth Bell" produced `the-drowning-year.md`,
 * the name of the timeline. The naming rule is unit-tested in
 * `src/lib/__tests__/manuscriptFileName.test.ts`; this checks the name that
 * actually reaches the download.
 */

const WORLD = 'The Ninth Bell'

async function worldWithTwoChapters(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(WORLD)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'The Drowning Year', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['ch1', 1, 'Low Water'], ['ch2', 2, 'The Bell Tower']] as Array<[string, number, string]>) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The ninth bell does not ring',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    // Prose, or there is nothing to export and the Manuscript screen correctly
    // disables its own tools.
    await db.sceneTexts.add({
      id: 'st1', worldId: id, eventId: 'ev1',
      text: 'The bell did not ring, and the whole street heard it not ring.',
      wordCount: 12, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

const chapterOf = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { events: { get: (id: string) => Promise<{ chapterId: string } | undefined> } }
  return (await db.events.get('ev1'))?.chapterId
})

test.describe('The scene menu can move a scene', () => {
  test.describe.configure({ timeout: 180_000 })

  test('N13: the menu offers the move, and it happens', async ({ page }) => {
    const worldId = await worldWithTwoChapters(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settleNav(page)

    // It starts where it was seeded — without this the assertion after the move
    // could be true for a reason that has nothing to do with the menu.
    expect(await chapterOf(page)).toBe('ch1')

    await page.getByRole('button', { name: /More actions for/ }).first().click()
    // The finding: one item, and it was Delete. Both are here now.
    await expect(page.getByRole('menuitem', { name: 'Move to chapter…' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete scene' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Move to chapter…' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The chapter it is already in is not a move, so it is not offered.
    await dialog.getByRole('button', { name: /Pick a chapter/ }).click()
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option').first()).toHaveText(/The Bell Tower/)
    await page.getByRole('option').first().click()
    await dialog.getByRole('button', { name: 'Move scene' }).click()

    await expect.poll(() => chapterOf(page), { timeout: 15_000 }).toBe('ch2')
  })

  test('N11: the manuscript downloads under the book’s name, not the timeline’s', async ({ page }) => {
    const worldId = await worldWithTwoChapters(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settleNav(page)

    await page.getByRole('button', { name: /Export/ }).first().click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Download/ }).click()
    // "the-drowning-year.md" was the finding — the timeline, not the book.
    expect((await download).suggestedFilename()).toBe('the-ninth-bell.md')
  })
})
