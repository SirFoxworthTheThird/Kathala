import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * **W-6.** The Continuity Checker's headline counted findings it was not
 * showing.
 *
 * A writer suppressed two *"Dead character"* warnings with the reason *"He is a
 * body in these scenes. That is the plot."* and met a header reading **3
 * warnings** over a list of one. It survived a reload, which is what told them
 * it was not a stale render.
 *
 * Suppressing a finding is the writer saying *yes, I meant that*, and the whole
 * point of saying it is to get the number down.
 *
 * Driven here because it is a disagreement between two parts of one screen, and
 * because the suppression has to round-trip through Dexie to be worth anything.
 */

/** Two dead-character warnings: one corpse, in two scenes after they die. */
async function worldWithTwoWarnings(page: import('@playwright/test').Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Suppression')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    await db.characters.add({ id: 'teodor', worldId: id, name: 'Teodor Ilm', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['teodor'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'He falls', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch2', title: 'The autopsy', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev3', chapterId: 'ch3', title: 'The inquest', sortOrder: 0 })

    // Dead from chapter 1, and in the cast of two scenes after it.
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'teodor', eventId: 'ev1', isAlive: false,
      currentLocationMarkerId: null, currentMapLayerId: null, inventoryItemIds: [],
      inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: 1, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

test.describe('the Continuity Checker headline', () => {
  test.describe.configure({ timeout: 240_000 })

  test('counts what it is showing, and keeps counting it after a reload', async ({ page }) => {
    const worldId = await worldWithTwoWarnings(page)
    await page.goto(`/#/worlds/${worldId}/`, { waitUntil: 'load' })
    await settle(page)

    await page.getByTitle('Continuity Checker').click()
    const panel = page.locator('.fixed').filter({ hasText: 'Continuity Checker' }).last()

    // Presence: two warnings, and the header says two.
    await expect(panel.getByText('2 warnings')).toBeVisible({ timeout: 20_000 })

    // Suppress one, with a reason, the way the finding is meant to be answered.
    await panel.getByRole('button', { name: 'Suppress this issue' }).first().click()
    await panel.getByPlaceholder(/Reason for suppressing/).fill('He is a body in these scenes. That is the plot.')
    await panel.getByTitle('Confirm suppress').click()

    // Absence: the number follows the list down.
    await expect(panel.getByText('1 warning', { exact: false })).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText('2 warnings')).toHaveCount(0)

    /*
      And after a reload, which is where the writer's run settled that this was
      not a stale render: the suppression is in Dexie, so the count must still
      agree with the list when the panel is built again from scratch.
    */
    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByTitle('Continuity Checker').click()
    const reopened = page.locator('.fixed').filter({ hasText: 'Continuity Checker' }).last()
    await expect(reopened.getByText('1 warning', { exact: false })).toBeVisible({ timeout: 20_000 })
    await expect(reopened.getByText('2 warnings')).toHaveCount(0)
  })
})
