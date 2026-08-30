import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * The checks added for fields the app already wrote and no check had read: the
 * scene's own place, and a location's status history.
 *
 * The findings themselves are unit-tested in
 * `src/lib/__tests__/computeIssues.test.ts`. What is driven here is the part
 * that only exists in the browser — the **Move to …** button writing a snapshot
 * and the panel noticing, and the new **Places & time** heading appearing when
 * it has something to say and staying away when it does not.
 */

interface Seed {
  /** Where Maren is recorded before the scene. Null records nothing at all. */
  recordedAt: string | null
  /** Location status history for Trebon, in chapter order. */
  trebon?: string[]
}

async function checkerFor(page: Page, seed: Seed) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt Gate')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ id, seed }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl1', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.bulkAdd([1, 2, 3].map((n) => ({
      id: `ch${n}`, worldId: id, timelineId: 'tl1', number: n, title: `Chapter ${n}`,
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })))
    await db.mapLayers.add({
      id: 'map1', worldId: id, parentMapId: null, name: 'Salt Gate', description: '',
      imageId: null, imageWidth: 1600, imageHeight: 1000, scalePixelsPerUnit: null,
      scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.bulkAdd([
      { id: 'ledger', name: 'The Ledger Room' },
      { id: 'flats', name: 'The Flats' },
      { id: 'trebon', name: 'Trebon' },
    ].map((m, i) => ({
      id: m.id, worldId: id, mapLayerId: 'map1', linkedMapLayerId: null, name: m.name,
      description: '', x: 200 + i * 400, y: 400, imageId: null, iconType: 'building',
      tags: [], factionId: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.add({
      id: 'maren', worldId: id, name: 'Maren Vale', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    await db.events.bulkAdd([1, 2, 3].map((n) => ({
      id: `ev${n}`, worldId: id, chapterId: `ch${n}`, timelineId: 'tl1',
      title: `Scene ${n}`, description: '', sortOrder: 0, tags: [],
      // Only the second scene declares a place, and Maren is in it.
      locationMarkerId: n === 2 ? 'ledger' : null,
      involvedCharacterIds: n === 2 ? ['maren'] : [],
      mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })))
    if (seed.recordedAt) {
      await db.characterSnapshots.add({
        id: 'cs1', worldId: id, characterId: 'maren', eventId: 'ev1', sortKey: 10_000,
        isAlive: true, currentLocationMarkerId: seed.recordedAt, currentMapLayerId: 'map1',
        inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
        createdAt: now, updatedAt: now,
      })
    }
    if (seed.trebon) {
      await db.locationSnapshots.bulkAdd(seed.trebon.map((status, i) => ({
        id: `ls${i}`, worldId: id, locationMarkerId: 'trebon', eventId: `ev${i + 1}`,
        sortKey: (i + 1) * 10_000, status, notes: '', createdAt: now, updatedAt: now,
      })))
    }
  }, { id: worldId, seed })

  await page.goto(`/#/worlds/${worldId}`)
  await settle(page)
  await page.getByTitle('Continuity Checker').click()
  const dialog = page.getByRole('dialog').first()
  await expect(dialog.getByText('Continuity Checker')).toBeVisible()
  return dialog
}

/** Where Maren is recorded at the scene, straight from the store. */
const marenAt = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; eventId: string; currentLocationMarkerId: string | null }>> }
  }
  const snaps = await db.characterSnapshots.toArray()
  return snaps.find((s) => s.characterId === 'maren' && s.eventId === 'ev2')?.currentLocationMarkerId ?? null
})

test.describe('The scene’s own place, and the world’s', () => {
  test.describe.configure({ timeout: 180_000 })

  test('a cast member recorded elsewhere can be moved to the scene in one click', async ({ page }) => {
    const dialog = await checkerFor(page, { recordedAt: 'flats' })

    await expect(dialog.getByText(/recorded at "The Flats"/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Move to The Ledger Room' }).first().click()

    // The store is the assertion — a button that cleared the row without
    // writing anything would satisfy the screen and nothing else.
    await expect.poll(async () => await marenAt(page), { timeout: 15_000 }).toBe('ledger')
    await expect(dialog.getByText(/recorded at "The Flats"/)).toHaveCount(0)
  })

  test('and nothing is said when the scene and the record agree', async ({ page }) => {
    // The presence half of the test above: same world, same scene, one field
    // different. Without it, "no warning" would pass on a check that never runs.
    const dialog = await checkerFor(page, { recordedAt: 'ledger' })
    await expect(dialog.getByText(/recorded at/)).toHaveCount(0)
    await expect(await marenAt(page)).toBeNull()
  })

  test('Places & time appears for a razed town standing again, and not otherwise', async ({ page }) => {
    const dialog = await checkerFor(page, { recordedAt: 'ledger', trebon: ['destroyed', 'destroyed', 'active'] })
    await expect(dialog.getByText('Places & time')).toBeVisible()
    await expect(dialog.getByText(/"Trebon" is "active" again/)).toBeVisible()
  })

  test('and stays away when the town stays destroyed', async ({ page }) => {
    const dialog = await checkerFor(page, { recordedAt: 'ledger', trebon: ['destroyed', 'destroyed', 'destroyed'] })
    await expect(dialog.getByText(/again after being destroyed/)).toHaveCount(0)
    await expect(dialog.getByText('Places & time')).toHaveCount(0)
  })
})
