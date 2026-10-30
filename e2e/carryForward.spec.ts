import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A snapshot was a whole state record, so what you saved at one scene reached
 * forward only until the next scene that recorded anything (F2). The most
 * natural draft-two edit — "actually she has had this since chapter one" —
 * stopped there, and the app offered to carry it on.
 *
 * Now a record says only what its scene says (Part B2), so the change reaches
 * every later scene that did not say otherwise, with nothing to offer; and a
 * scene that did say otherwise is still the writer's word about it. The item
 * half is still offered, for books recorded before custody (Part B1).
 */

const KNIFE = 'The bread knife'

/**
 * Three scenes across two chapters. Corvin has a state recorded at all three,
 * written before any of this — which is the situation that makes an edit at
 * scene one stop at scene two.
 */
async function threeRecordedScenes(page: Page, lastInventory: string[], farEra = false, firstInventory: string[] = [], lastNote: string | null = null): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Carry')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, last, far, first, note]) => {
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
    // `far`: Ch. 2 is in a timeline starting a hundred thousand days on — another era.
    if (far) await db.timelines.add({ id: 'far', worldId: id, name: 'Far', description: '', color: '#f59e0b', dayOffset: 100_000, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch2', worldId: id, timelineId: far ? 'far' : 'tl', number: 2, title: 'Two', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'The reed house', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch1', title: 'Setting out', sortOrder: 1 })
    await db.events.add({ ...base, id: 'ev3', chapterId: 'ch2', title: 'The seal breaks', sortOrder: 0, ...(far ? { timelineId: 'far' } : {}) })

    // Corvin recorded at all three scenes. A record says what its scene says: the inventories, for the item half, as a book from before custody listed them; `lastNote`, where the last scene says otherwise.
    const snap = { worldId: id, characterId: 'corvin', createdAt: now, updatedAt: now }
    await db.characterSnapshots.add({ ...snap, id: 's1', eventId: 'ev1', inventoryItemIds: first, sortKey: 1 })
    await db.characterSnapshots.add({ ...snap, id: 's2', eventId: 'ev2', inventoryItemIds: [], sortKey: 1.000001 })
    await db.characterSnapshots.add({ ...snap, id: 's3', eventId: 'ev3', inventoryItemIds: last, sortKey: 2, ...(note ? { statusNotes: note } : {}) })
  }, [worldId, lastInventory, farEra, firstInventory, lastNote] as const)
  return worldId
}

const NOTE = 'Footsore from the road.'
const notes = (page: Page) => page.getByRole('textbox', { name: 'Status Notes' })

/** Open Corvin's Current State at the first moment, as a writer goes back to it. */
async function atFirstScene(page: Page, worldId: string) {
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
}

/** Say Corvin is footsore at the first scene, from the Current State panel. */
async function noteAtFirstScene(page: Page, worldId: string) {
  await atFirstScene(page, worldId)
  await notes(page).fill(NOTE)
  await page.getByRole('button', { name: 'Save State' }).click()
  await expect(notes(page)).toHaveValue(NOTE, { timeout: 15_000 })
}

/** The cursor a moment on, and the note the panel shows there. */
async function nextMoment(page: Page) {
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(700)
}

test.describe('an edit to an earlier scene says where it stops', () => {
  test.describe.configure({ timeout: 240_000 })

  test('reaches the later scenes that did not say otherwise, with nothing to offer', async ({ page }) => {
    const worldId = await threeRecordedScenes(page, [])
    await noteAtFirstScene(page, worldId)
    // Scene two and Ch. 2 were recorded before the change, and say nothing of his state: it is footsore there too.
    await nextMoment(page)
    await expect(notes(page)).toHaveValue(NOTE, { timeout: 15_000 })
    await nextMoment(page)
    await expect(page.getByText('The seal breaks').first()).toBeVisible()
    await expect(notes(page)).toHaveValue(NOTE, { timeout: 15_000 })
    // And nothing was offered: there is nothing to carry.
    await expect(page.getByRole('button', { name: 'Carry it forward' })).toHaveCount(0)
  })

  test('reaches through its own era only', async ({ page }) => {
    // Ch. 2 is centuries on: his state there is another time of his life. The first test is the pair, in one era.
    const worldId = await threeRecordedScenes(page, [], true)
    await noteAtFirstScene(page, worldId)
    await nextMoment(page)
    await expect(notes(page)).toHaveValue(NOTE, { timeout: 15_000 })
    await nextMoment(page)
    await expect(page.getByText('The seal breaks').first()).toBeVisible()
    await expect(notes(page)).toHaveValue('', { timeout: 15_000 })
  })

  test('stops at a scene that says otherwise, and does not overwrite it', async ({ page }) => {
    // The last scene says he rested — a choice, not an inherited blank.
    const worldId = await threeRecordedScenes(page, [], false, [], 'Rested at the inn.')
    await noteAtFirstScene(page, worldId)
    await nextMoment(page)
    await expect(notes(page)).toHaveValue(NOTE, { timeout: 15_000 })
    await nextMoment(page)
    await expect(page.getByText('The seal breaks').first()).toBeVisible()
    await expect(notes(page)).toHaveValue('Rested at the inn.', { timeout: 15_000 })
  })

  test('offers an item held here forward through its own era only', async ({ page }) => {
    const offerAtFirstScene = async (far: boolean) => {
      const worldId = await threeRecordedScenes(page, [], far, ['knife'])
      await atFirstScene(page, worldId)
      const offer = page.getByRole('status').filter({ hasText: `${KNIFE} is not in` })
      await expect(offer).toBeVisible({ timeout: 20_000 })
      return (await offer.textContent()) ?? ''
    }
    // One era: Ch. 1's next scene and Ch. 2's both lack it.
    expect(await offerAtFirstScene(false)).toContain('nor in the 1 after it through Ch. 2')
    // Ch. 2 centuries on: only Ch. 1's next scene.
    const far = await offerAtFirstScene(true)
    expect(far).toContain('at Ch. 1 · Setting out.')
    expect(far).not.toContain('nor in the')
  })
})
