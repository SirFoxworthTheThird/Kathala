import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A character's History lists one row per snapshot, and every snapshot keys on
 * a scene. The rows were headed `Ch. N — <chapter title>`, so a chapter with
 * two scenes produced two rows with the same heading and different contents —
 * on the shipped Monte Cristo, a character reading as being in two places in
 * Ch. 92. The chapter still leads, because that is how a writer finds their
 * place; the scene is what tells the rows apart.
 */

async function twoScenesOneChapter(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('History World')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Reed House', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'c1', worldId: id, name: 'Mira Vasse', description: '', aliases: [], tags: [], imageBlobId: null, birthDate: null, createdAt: now, updatedAt: now })
    await db.mapLayers.add({ id: 'map1', worldId: id, name: 'The Salt Road', parentMapId: null, imageBlobId: null, width: 1000, height: 1000, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk1', worldId: id, mapLayerId: 'map1', name: 'Ferrow Crossing', x: 10, y: 10, linkedMapLayerId: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk2', worldId: id, mapLayerId: 'map1', name: 'Hallowmere Lock', x: 20, y: 20, linkedMapLayerId: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, chapterId: 'ch1', timelineId: 'tl', description: '', tags: [],
      locationMarkerId: null, involvedCharacterIds: ['c1'], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null,
      inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null,
      tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', title: 'Setting out', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', title: 'The seal breaks', sortOrder: 1 })

    // Two states, two scenes, one chapter — the shape that read as a
    // contradiction when both rows were headed by the chapter.
    const snap = {
      worldId: id, characterId: 'c1', isAlive: true, currentMapLayerId: 'map1',
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    }
    await db.characterSnapshots.add({ ...snap, id: 's1', eventId: 'ev1', currentLocationMarkerId: 'mk1', sortKey: 1 })
    await db.characterSnapshots.add({ ...snap, id: 's2', eventId: 'ev2', currentLocationMarkerId: 'mk2', sortKey: 1.000001 })
  }, worldId)
  return worldId
}

test.describe('character history names the scene', () => {
  test.describe.configure({ timeout: 180_000 })

  test('tells two rows in one chapter apart', async ({ page }) => {
    const worldId = await twoScenesOneChapter(page)
    await page.goto(`/#/worlds/${worldId}/characters/c1`, { waitUntil: 'load' })
    await page.waitForTimeout(1500)

    await page.getByRole('tab', { name: /history/i }).click()
    await page.waitForTimeout(900)

    const main = page.getByRole('main')
    // Presence: each row is named by its own scene.
    await expect(main.getByText('Ch. 1 · Setting out')).toBeVisible()
    await expect(main.getByText('Ch. 1 · The seal breaks')).toBeVisible()

    /*
      Absence, in the same test: the old heading, which was identical on both
      rows, is gone. Without this half the assertions above would pass on a
      screen that also still printed the ambiguous label.
    */
    await expect(main.getByText('Ch. 1 — The Reed House')).toHaveCount(0)
  })
})
