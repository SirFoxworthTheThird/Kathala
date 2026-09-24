import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The Items screen promises "objects characters carry, use, or lose over time",
 * and the item's own page gave a name, a description, an image slot and an empty
 * lore panel. The roster row already showed the current holder, so the fact was
 * computed — it just was not on the item, and the *sequence* was nowhere at all.
 *
 * The reading half is asserted too: this is a new body of text on a screen a
 * reader can open, which is exactly where a spoiler leak would appear.
 */

async function letterChangingHands(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Custody')
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
    await db.characters.add({ id: 'mira', worldId: id, name: 'Mira Vasse', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'corvin', worldId: id, name: 'Corvin Ashe', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'letter', worldId: id, name: 'The sealed letter', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.mapLayers.add({ id: 'map1', worldId: id, name: 'Road', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk1', worldId: id, mapLayerId: 'map1', name: 'The Reed House', description: '', x: 10, y: 10, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk2', worldId: id, mapLayerId: 'map1', name: 'Ferrow Crossing', description: '', x: 20, y: 20, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', chapterId: 'ch1', title: 'The letter arrives', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', chapterId: 'ch2', title: 'The seal breaks', sortOrder: 0 })

    const snap = { worldId: id, isAlive: true, currentMapLayerId: 'map1', inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now }
    await db.characterSnapshots.add({ ...snap, id: 's1', characterId: 'mira', eventId: 'ev1', inventoryItemIds: ['letter'], currentLocationMarkerId: 'mk1', sortKey: 1 })
    await db.characterSnapshots.add({ ...snap, id: 's2', characterId: 'corvin', eventId: 'ev2', inventoryItemIds: ['letter'], currentLocationMarkerId: 'mk2', sortKey: 2 })
  }, worldId)
  return worldId
}

/**
 * Park the time cursor on a scene, through the app.
 *
 * Not through `localStorage`: `eventByWorld` is in-memory and opening a world
 * sets the cursor from it, so a value written into storage is gone by the time
 * the page has finished loading. The Timeline's own **View from here** is the
 * act a writer performs, and it is the one control that does this per scene.
 */
async function viewFromScene(page: Page, worldId: string, sceneTitle: string, eventId: string) {
  await page.goto(`/#/worlds/${worldId}/timeline`, { waitUntil: 'load' })
  await settle(page)
  const main = page.getByRole('main')
  /*
    Chapters arrive collapsed, so the scene rows are not on screen yet — and the
    scene may be in any of them, so every collapsed chapter is opened rather
    than the first one guessed at. Only chapter rows carry `aria-expanded`.
  */
  const collapsed = main.getByRole('button', { expanded: false })
  for (let i = await collapsed.count(); i > 0; i = await collapsed.count()) {
    await collapsed.first().click()
    if (await collapsed.count() === i) break
  }
  const scene = main.getByRole('button', { name: sceneTitle, exact: true })
  await scene.click()
  // The scene's own View from here, not a chapter's: the chapter rows carry one
  // too, and theirs goes to the chapter's first moment.
  await scene.locator('xpath=ancestor::div[2]').getByRole('button', { name: 'View from here' }).click()

  // Asserted on the stored cursor rather than on chrome, because which element
  // shows it differs by screen and by width.
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null,
  ), { timeout: 15_000 }).toBe(eventId)
}

test.describe("an item's own page tells its story", () => {
  test.describe.configure({ timeout: 240_000 })

  test('lists who had it, in order', async ({ page }) => {
    const worldId = await letterChangingHands(page)
    await page.goto(`/#/worlds/${worldId}/items/letter`, { waitUntil: 'load' })
    await settle(page)

    const main = page.getByRole('main')
    await expect(main.getByText('Whereabouts')).toBeVisible()

    const rows = main.locator('ol > li')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('The letter arrives')
    await expect(rows.nth(0)).toContainText('carried by Mira Vasse · The Reed House')
    await expect(rows.nth(1)).toContainText('The seal breaks')
    await expect(rows.nth(1)).toContainText('carried by Corvin Ashe · Ferrow Crossing')
  })

  test('does not tell a reader what happens after where they are', async ({ page }) => {
    const worldId = await letterChangingHands(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/items/letter`, { waitUntil: 'load' })
    await settle(page)

    const main = page.getByRole('main')
    // Presence: the scene the reader is in is there…
    await expect(main.getByText('carried by Mira Vasse · The Reed House')).toBeVisible()

    /*
      …and absence: the chapter-two hand-off is not. Asserted on the row and on
      the scene's own title, not on "Corvin Ashe" — `useCharacters` is gated
      too, so an unmet character's *name* is missing whether or not the row is
      there, and the first version of this assertion passed with every gate in
      the chain disabled. A leak here would show as a second row reading
      "left at Ferrow Crossing", which names no character at all.
    */
    await expect(main.locator('ol > li')).toHaveCount(1)
    await expect(main.getByText('The seal breaks')).toHaveCount(0)
    await expect(main.getByText(/Ferrow Crossing/)).toHaveCount(0)
  })
})

/**
 * **W-3.** The Items section could not say where an item was.
 *
 * A writer with six props went Maps → the pin → its Location panel, or
 * Characters → Current State, every time they put something down — neither of
 * which is where you are when you are thinking about the object. The roster had
 * three controls and the item's own page four, and none of them touched a
 * placement.
 */
test.describe('putting an item down from its own page', () => {
  test.describe.configure({ timeout: 240_000 })

  test('records it at the scene the cursor is on, and the chain shows it', async ({ page }) => {
    const worldId = await letterChangingHands(page)

    await viewFromScene(page, worldId, 'The seal breaks', 'ev2')
    await page.goto(`/#/worlds/${worldId}/items/letter`, { waitUntil: 'load' })
    await settle(page)

    const main = page.getByRole('main')
    await main.getByRole('button', { name: /^Where it is/ }).click()
    await page.getByRole('option', { name: 'The Reed House' }).click()

    // Written where the cursor is — not at the scene the resolved state came from.
    await expect.poll(async () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { itemPlacements: { toArray: () => Promise<Array<{ eventId: string; locationMarkerId: string }>> } }
      return (await db.itemPlacements.toArray()).map((p) => `${p.eventId}:${p.locationMarkerId}`)
    }), { timeout: 15_000 }).toEqual(['ev2:mk1'])

    // And the chain says it in the active voice, because the writer did place it.
    await expect(main.getByText('left at The Reed House')).toBeVisible({ timeout: 15_000 })
  })

  /*
    The pair. A reader has no business placing anything, and the section is the
    kind of edit control reading mode exists to take away.
  */
  test('is not offered to a reader', async ({ page }) => {
    const worldId = await letterChangingHands(page)
    await page.evaluate(async (id: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { worlds: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.worlds.update(id, { readingMode: true })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/items/letter`, { waitUntil: 'load' })
    await settle(page)

    await expect(page.getByRole('main').getByText('Whereabouts')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Where it is/ })).toHaveCount(0)
  })
})
