import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/**
 * W19-4. The Writer's Brief listed where every character was and never said
 * where the *scene* was. Every one of the 149 events in *The Name of the Wind*
 * carries a `locationMarkerId`, and the only place it ever surfaced was as
 * somebody's snapshot location — so a setting the writer had recorded could not
 * be read back on the screen whose whole job is briefing them on the moment.
 * Nothing noticed the mismatch either: a scene set in The Ledger Room with a
 * cast member recorded at The Flats drew no comment from the checker.
 *
 * The seed is that exact shape, so "Setting: The Ledger Room" cannot be
 * satisfied by the character row underneath it, which says The Flats.
 */

async function briefFor(page: Page, opts: { withSetting: boolean }) {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt Gate')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async ({ id, withSetting }) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; bulkAdd: (v: unknown[]) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.mapLayers.add({
      id: 'map1', worldId: id, parentMapId: null, name: 'Salt Gate', description: '',
      imageId: null, imageWidth: 1600, imageHeight: 1000, scalePixelsPerUnit: null,
      scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.bulkAdd([
      { id: 'ledger', name: 'The Ledger Room', x: 400, y: 400 },
      { id: 'flats', name: 'The Flats', x: 900, y: 600 },
    ].map((m) => ({
      id: m.id, worldId: id, mapLayerId: 'map1', linkedMapLayerId: null, name: m.name,
      description: '', x: m.x, y: m.y, imageId: null, iconType: 'building', tags: [],
      factionId: null, createdAt: now, updatedAt: now,
    })))
    await db.characters.add({
      id: 'maren', worldId: id, name: 'Maren Vale', aliases: [], description: '',
      portraitImageId: null, tags: [], isAlive: true, color: null, createdAt: now, updatedAt: now,
    })
    // Recorded at The Flats — deliberately *not* where the scene is set.
    await db.characterSnapshots.add({
      id: 'cs1', worldId: id, characterId: 'maren', eventId: 'ev1', sortKey: 10_000,
      isAlive: true, currentLocationMarkerId: 'flats', currentMapLayerId: 'map1',
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl',
      title: 'A letter under the door', description: '', sortOrder: 0, tags: [],
      locationMarkerId: withSetting ? 'ledger' : null,
      involvedCharacterIds: ['maren'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, { id: worldId, withSetting: opts.withSetting })

  await page.goto(`/#/worlds/${worldId}/timeline/ch1`)
  await page.waitForTimeout(2000)
  await page.getByTitle("Writer's Brief").click()

  const dialog = page.getByRole('dialog', { name: "Writer's Brief" })
  await expect(dialog).toBeVisible()
  const pick = dialog.getByRole('button', { name: 'A letter under the door' })
  if (await pick.count()) await pick.first().click()
  await expect(dialog.getByText('A letter under the door').first()).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(800)
  return dialog
}

test.describe("The Writer's Brief and the scene's own setting", () => {
  test.describe.configure({ timeout: 180_000 })

  test('names the place the scene is set in', async ({ page }) => {
    const dialog = await briefFor(page, { withSetting: true })

    await expect(dialog.getByText('Setting:')).toBeVisible()
    await expect(dialog.getByText('The Ledger Room')).toBeVisible()

    // The character row is still the other fact, and still says The Flats —
    // which is what stops "The Ledger Room is on screen" being satisfiable by
    // the cast list underneath.
    await expect(dialog.getByText('The Flats')).toBeVisible()
  })

  test('and says nothing when the scene has no place recorded', async ({ page }) => {
    const dialog = await briefFor(page, { withSetting: false })

    await expect(dialog.getByText('Setting:')).toHaveCount(0)
    await expect(dialog.getByText('The Ledger Room')).toHaveCount(0)

    // The presence half: the brief is otherwise the same brief. Without this,
    // a panel that had stopped rendering entirely would pass.
    await expect(dialog.getByText('A letter under the door').first()).toBeVisible()
    await expect(dialog.getByText('The Flats')).toBeVisible()
  })
})
