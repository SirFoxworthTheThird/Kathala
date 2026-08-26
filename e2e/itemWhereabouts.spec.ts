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
