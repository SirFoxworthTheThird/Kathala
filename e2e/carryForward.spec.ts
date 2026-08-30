import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A snapshot is a whole state record, so what you save at one scene reaches
 * forward only until the next scene that recorded anything. The most natural
 * draft-two edit — "actually she has had this since chapter one" — stopped
 * there, and no screen said so.
 *
 * The record at the later scene is still the writer's statement about it and is
 * never overwritten behind their back. What is new is being told where the
 * change stopped, and being offered the choice.
 */

const KNIFE = 'The bread knife'

/**
 * Three scenes across two chapters. Corvin has a state recorded at all three,
 * written before any of this — which is the situation that makes an edit at
 * scene one stop at scene two.
 */
async function threeRecordedScenes(page: Page, lastInventory: string[]): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Carry')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, last]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Ashe', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'knife', worldId: id, name: 'The bread knife', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'letter', worldId: id, name: 'The sealed letter', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['corvin'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch2', worldId: id, timelineId: 'tl', number: 2, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'The reed house', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch1', title: 'Setting out', sortOrder: 1 })
    await db.events.add({ ...base, id: 'ev3', chapterId: 'ch2', title: 'The seal breaks', sortOrder: 0 })

    const snap = {
      worldId: id, characterId: 'corvin', isAlive: true, currentLocationMarkerId: null,
      currentMapLayerId: null, inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    }
    await db.characterSnapshots.add({ ...snap, id: 's1', eventId: 'ev1', inventoryItemIds: [], sortKey: 1 })
    await db.characterSnapshots.add({ ...snap, id: 's2', eventId: 'ev2', inventoryItemIds: [], sortKey: 1.000001 })
    await db.characterSnapshots.add({ ...snap, id: 's3', eventId: 'ev3', inventoryItemIds: last, sortKey: 2 })
  }, [worldId, lastInventory] as const)
  return worldId
}

/** What every one of Corvin's records holds, in narrative order. */
const inventories = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { toArray: () => Promise<Array<{ eventId: string; inventoryItemIds: string[] }>> } }
  const all = await db.characterSnapshots.toArray()
  return Object.fromEntries(all.map((s) => [s.eventId, s.inventoryItemIds]))
})

/** Give Corvin the knife at the first scene, from the Current State panel. */
async function giveKnifeAtFirstScene(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/characters/corvin`, { waitUntil: 'load' })
  await settle(page)

  /*
    The panel is about the scene under the time cursor, and a world opens with
    no cursor at all — "Select a scene from the timeline bar to view and edit
    state." So put it on the first moment before editing anything.
  */
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)
  await page.getByRole('tab', { name: 'Current State' }).click()
  await settle(page)

  // Inventory is added through a select, not a button per item.
  await page.getByRole('button', { name: 'Add existing item...' }).click()
  await page.getByRole('option', { name: KNIFE }).click()
  await page.getByRole('button', { name: 'Save State' }).click()
}

test.describe('an edit to an earlier scene says where it stops', () => {
  test.describe.configure({ timeout: 240_000 })

  test('offers to carry it forward, and does when asked', async ({ page }) => {
    const worldId = await threeRecordedScenes(page, [])
    await giveKnifeAtFirstScene(page, worldId)

    // The notice names the scene the change does not reach past.
    const notice = page.getByText(/recorded again at Ch\. 1 · Setting out/)
    await expect(notice).toBeVisible({ timeout: 15_000 })

    // Absence first: the later scenes are still empty-handed.
    expect((await inventories(page))['ev3']).toEqual([])

    await page.getByRole('button', { name: 'Carry it forward' }).click()
    await expect.poll(async () => (await inventories(page))['ev3'], { timeout: 15_000 })
      .toEqual(['knife'])
    expect((await inventories(page))['ev2']).toEqual(['knife'])
  })

  test('stops at a decision already made, and does not overwrite it', async ({ page }) => {
    // The last scene records the letter instead — a choice, not an inherited
    // blank. Carrying forward must stop before it.
    const worldId = await threeRecordedScenes(page, ['letter'])
    await giveKnifeAtFirstScene(page, worldId)

    await expect(page.getByText(/recorded again at Ch\. 1 · Setting out/)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Carry it forward' }).click()

    await expect.poll(async () => (await inventories(page))['ev2'], { timeout: 15_000 })
      .toEqual(['knife'])
    // The whole point: the scene that said something else still says it.
    expect((await inventories(page))['ev3']).toEqual(['letter'])
  })

  test('says nothing when there is nothing later to reach', async ({ page }) => {
    // The pair for the notice: without this, "it appears" could be a toast that
    // appears on every save.
    const worldId = await threeRecordedScenes(page, [])
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { characterSnapshots: { delete: (id: string) => Promise<void> } }
      await db.characterSnapshots.delete('s2')
      await db.characterSnapshots.delete('s3')
    })
    await giveKnifeAtFirstScene(page, worldId)

    await page.waitForTimeout(2500)
    await expect(page.getByText(/recorded again at/)).toHaveCount(0)
  })
})
