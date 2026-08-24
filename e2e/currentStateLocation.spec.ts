import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * Character → Current State offered, and displayed, only the markers on the
 * world's *first root map* — and `useRootMapLayers` returns an unordered
 * `toArray()`, so which map that was had nothing to do with the writer.
 *
 * In the shipped Monte Cristo, 373 of 417 character snapshots point at a marker
 * on some other layer, so this tab read "Unknown / not set" for nine records in
 * ten while the History tab beside it named the place correctly. Saving from it
 * then wrote the first map's id over the marker's real layer, so editing a typo
 * in a status note left the two disagreeing.
 */

const HOME = 'Château d’If'   // on the second map — the one that was invisible
const OTHER = 'Old Port'      // on the first, which was all you could pick

async function twoMapWorld(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Two Maps')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, home, other]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    const layer = (lid: string, name: string) => ({
      id: lid, worldId: id, name, parentMapId: null, imageId: null,
      imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null,
      levelGroupId: null, levelIndex: 0, levelLabel: '', description: '',
      createdAt: now, updatedAt: now,
    })
    await db.mapLayers.add(layer('map-a', 'Europe'))
    await db.mapLayers.add(layer('map-b', 'Marseille'))
    // `mk-a-…` before `mk-z-…` in key order, deliberately: see the note in the
    // layer test about a mutation that survived when the two coincided.
    await db.locationMarkers.add({ id: 'mk-a-other', worldId: id, mapLayerId: 'map-a', name: other, description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk-z-home', worldId: id, mapLayerId: 'map-b', name: home, description: '', x: 2, y: 2, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })

    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'edmond', worldId: id, name: 'Edmond Dantès', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Pharaon Returns',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: ['edmond'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
    // Recorded on the *second* map — the case the picker could not see.
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'edmond', eventId: 'ev1', isAlive: true,
      currentLocationMarkerId: 'mk-z-home', currentMapLayerId: 'map-b', inventoryItemIds: [],
      inventoryNotes: '', statusNotes: 'Mourning Leclère.', travelModeId: null, sortKey: 1,
      createdAt: now, updatedAt: now,
    })
  }, [worldId, HOME, OTHER])
  return worldId
}

const snapshot = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as
    { characterSnapshots: { get: (id: string) => Promise<{ currentLocationMarkerId: string | null; currentMapLayerId: string | null } | undefined> } }
  return db.characterSnapshots.get('s1')
})

async function openState(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/characters/edmond?tab=state`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Next moment' }).click()
  await page.waitForTimeout(900)
}

test.describe('Current State can see every map', () => {
  test.describe.configure({ timeout: 240_000 })

  test('names a location recorded on a map other than the first', async ({ page }) => {
    const worldId = await twoMapWorld(page)
    await openState(page, worldId)

    const main = page.getByRole('main')
    // Presence: the control says where he is…
    await expect(main.getByRole('button', { name: HOME })).toBeVisible({ timeout: 20_000 })
    /*
      …and absence, in the same test: no control is left showing the placeholder.
      Asserted on the *control*, not on the panel's text — a page-wide
      `getByText('Unknown / not set')` also counts the option inside the picker's
      own list, which is not the symptom and is there either way.
    */
    await expect(main.getByRole('button', { name: 'Unknown / not set' })).toHaveCount(0)
  })

  test('offers markers from every map, not just one', async ({ page }) => {
    const worldId = await twoMapWorld(page)
    await openState(page, worldId)

    await page.getByRole('main').getByRole('button', { name: HOME }).click()
    await expect(page.getByRole('option', { name: OTHER })).toBeVisible()
    await expect(page.getByRole('option', { name: HOME })).toBeVisible()
  })

  test('does not rewrite the layer when an unrelated field is edited', async ({ page }) => {
    const worldId = await twoMapWorld(page)
    await openState(page, worldId)

    const before = await snapshot(page)
    expect(before).toMatchObject({ currentLocationMarkerId: 'mk-z-home', currentMapLayerId: 'map-b' })

    // Change nothing but the status note, as a writer fixing a typo would.
    const notes = page.getByPlaceholder('Physical condition, disguise, mood...')
    await notes.fill('Mourning Leclere.')
    await page.getByRole('button', { name: 'Save State' }).click()
    await page.waitForTimeout(1200)

    // The marker and its layer still agree.
    expect(await snapshot(page)).toMatchObject({
      currentLocationMarkerId: 'mk-z-home', currentMapLayerId: 'map-b',
    })
  })
})
