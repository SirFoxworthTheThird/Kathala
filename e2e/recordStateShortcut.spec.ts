import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Recording one character's state at one scene cost six to eight clicks across
 * three screens: move the cursor, Characters, the person, Current State, set,
 * Save. Two screens already knew a state was missing and neither was a way to
 * fix it — the Arc grid, which is laid out exactly like the bookkeeping, and
 * the chapter-detail cast row, which says "no state recorded" in so many words.
 *
 * Both are the way there now. The grid stays a readout rather than becoming an
 * editor: in chapter mode a column is a chapter while snapshots key on a scene,
 * so a cell has no well-defined target to write to. Navigation may guess where
 * the writer meant; writing may not.
 */

async function worldWithAGap(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Gap')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch2', worldId: id, timelineId: 'tl', number: 2, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Ashe', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['corvin'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'The reed house', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch2', title: 'The seal breaks', sortOrder: 0 })

    /*
      The one recorded state is in chapter *two*, so chapter one is the gap.
      State carries forward, so a scene after a record is never empty — an empty
      cell only exists before a character's first recorded state.
    */
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'corvin', eventId: 'ev2', isAlive: true,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 2,
      createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

const cursorEventId = (page: Page) => page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('plotweave-ui') ?? '{}')?.state?.activeEventId ?? null
  } catch { return null }
})

test.describe('the screens that name a gap are the way to fill it', () => {
  test.describe.configure({ timeout: 240_000 })

  test('one click from the Arc grid to the right character and scene', async ({ page }) => {
    const worldId = await worldWithAGap(page)
    await page.goto(`/#/worlds/${worldId}/arc`, { waitUntil: 'load' })
    await settle(page)

    // The empty cell says it is a way in, not just that something is missing.
    const gap = page.getByRole('gridcell', { name: 'No state recorded — record it' }).first()
    await expect(gap).toBeVisible({ timeout: 20_000 })
    await gap.click()

    // One click: the right character, the Current State tab, the right scene.
    await expect(page).toHaveURL(/\/characters\/corvin\?tab=state/)
    await expect(page.getByRole('tab', { name: 'Current State' })).toHaveAttribute('data-state', 'active')
    expect(await cursorEventId(page)).toBe('ev1')
  })

  /*
    The bug underneath, which was there before any of this and had nothing to do
    with navigation: the three cell renderers were declared inside the component,
    so every render gave each a new identity and React remounted the cell instead
    of updating it. Focus fires before click; focusing a cell set state; the
    re-render pulled the node out from under the click. **The first click on any
    cell did nothing and the second worked** — true of the notes-expand click all
    along, and only visible once a cell had somewhere to go.

    Asserted as one click on a cell that has never been focused, which is the
    only condition under which it failed.
  */
  test('the first click works, without a warm-up click', async ({ page }) => {
    const worldId = await worldWithAGap(page)
    await page.goto(`/#/worlds/${worldId}/arc`, { waitUntil: 'load' })
    await settle(page)

    const gap = page.getByRole('gridcell', { name: 'No state recorded — record it' }).first()
    await expect(gap).toBeVisible({ timeout: 20_000 })
    // Nothing has focused this cell: no prior click, no keyboard entry.
    await gap.click()
    await page.waitForTimeout(600)
    expect(page.url()).toContain('/characters/corvin?tab=state')
  })

  test('and in place from the cast row that names the gap', async ({ page }) => {
    const worldId = await worldWithAGap(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)

    const row = page.locator('[data-cast-without-state="corvin"]')
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row.getByText('no state recorded — record it')).toBeVisible()
    await row.click()

    /*
      This used to navigate to the character's page, which was one click and a
      change of screen. Both writer runs still priced the whole act at six to
      eight interactions, so the row takes the answer where it stands — see
      `e2e/recordStateInline.spec.ts` for the recording itself.
    */
    await expect(page.getByRole('button', { name: 'Record state' })).toBeVisible()
    await expect(page).toHaveURL(/timeline\/ch1/)

    /*
      And the route this test was written for is still here, one click further
      in, still carrying the cursor with it — the character's page reads the
      cursor, so arriving there on the wrong scene would be the dead end the
      shortcut exists to avoid.
    */
    await page.getByRole('button', { name: 'Full editor' }).click()
    await expect(page).toHaveURL(/\/characters\/corvin\?tab=state/)
    expect(await cursorEventId(page)).toBe('ev1')
  })

  test('but a reader is offered neither', async ({ page }) => {
    // The pair: these are ways to write, and reading mode has none of them.
    const worldId = await worldWithAGap(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByText(/record it/)).toHaveCount(0)
  })
})
