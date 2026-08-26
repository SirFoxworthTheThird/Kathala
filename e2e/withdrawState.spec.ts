import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A recorded state could be written and never taken back.
 *
 * The delta model makes that expensive in a way the writer cannot see: an empty
 * record is an assertion that the character's whereabouts are unknown *at this
 * scene*, not an absence of one, so every later scene reads the emptiness back
 * through it. A blind writer run saved two such records by accident — the panel
 * invites recording state for characters who are not in the scene — and the
 * rest of the book read "Unknown / not set" from then on, with no control
 * anywhere to undo it. `deleteSnapshot` existed and was tested; nothing called
 * it.
 *
 * This spec is the whole shape: the emptiness reaching forward, the record
 * being withdrawn, and the earlier state reaching forward again in its place.
 */

const FOUNDRY = 'Ash Foundry'

async function severedWorld(page: Page): Promise<string> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Bells')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, foundry]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.mapLayers.add({
      id: 'map-a', worldId: id, name: 'Anhalt', parentMapId: null, imageId: null,
      imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null,
      levelGroupId: null, levelIndex: 0, levelLabel: '', description: '',
      createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.add({
      id: 'mk-foundry', worldId: id, mapLayerId: 'map-a', name: foundry, description: '',
      x: 5, y: 5, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [],
      factionId: null, createdAt: now, updatedAt: now,
    })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'ossian', worldId: id, name: 'Ossian Marl', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, chapterId: 'ch1', timelineId: 'tl', description: '', tags: [],
      locationMarkerId: null, involvedCharacterIds: ['ossian'], mentionedCharacterIds: [],
      involvedItemIds: [], threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    await db.events.add({ ...base, id: 'ev1', title: 'The pour', sortOrder: 0 })
    await db.events.add({ ...base, id: 'ev2', title: 'Weighing the ninth', sortOrder: 1 })
    await db.events.add({ ...base, id: 'ev3', title: 'Rain on the tally-house', sortOrder: 2 })

    const snap = {
      worldId: id, characterId: 'ossian', isAlive: true, currentMapLayerId: null,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    }
    // Where he really is…
    await db.characterSnapshots.add({
      ...snap, id: 's1', eventId: 'ev1', sortKey: 1,
      currentLocationMarkerId: 'mk-foundry', currentMapLayerId: 'map-a',
    })
    // …and the record made by accident, which says nobody knows.
    await db.characterSnapshots.add({
      ...snap, id: 's2', eventId: 'ev2', sortKey: 1.000001, currentLocationMarkerId: null,
    })
  }, [worldId, FOUNDRY])
  return worldId
}

/**
 * Open Ossian's state panel with the cursor on a named scene.
 *
 * The cursor is written into the persisted store rather than walked to with
 * "Next moment", because it survives a reload: the second visit to a scene
 * found the cursor already there and the button disabled, and the spec sat on
 * it for the full five minutes.
 */
async function openStateAt(page: Page, worldId: string, eventId: string) {
  await page.goto(`/#/worlds/${worldId}/characters/ossian?tab=state`, { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.evaluate(([world, event]) => {
    const raw = localStorage.getItem('plotweave-ui')
    const stored = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    stored.state = { ...stored.state, activeWorldId: world, activeEventId: event, eventByWorld: { [world]: event } }
    localStorage.setItem('plotweave-ui', JSON.stringify(stored))
  }, [worldId, eventId] as const)
  /*
    A reload, not another `goto`: the URL only differs in its hash, so the
    second visit is a same-document navigation, the running store never re-reads
    localStorage, and it writes its own cursor back over the one just placed.
    The first run of this spec sat on a disabled "Next moment" for five minutes
    because of it.
  */
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(1800)
  // The cursor really is where it was put — otherwise every assertion below is
  // about some other scene.
  await expect(page.getByRole('banner').getByRole('button', { name: SCENE_TITLE[eventId] })).toBeVisible({ timeout: 20_000 })
}

const SCENE_TITLE: Record<string, string> = {
  ev1: 'The pour',
  ev2: 'Weighing the ninth',
  ev3: 'Rain on the tally-house',
}

test.describe('a recorded state can be withdrawn', () => {
  test.describe.configure({ timeout: 300_000 })

  test('the emptiness reaches forward until the record is removed', async ({ page }) => {
    const worldId = await severedWorld(page)
    const main = page.getByRole('main')

    // Scene three has no record of its own, so it reads back through scene two.
    await openStateAt(page, worldId, 'ev3')
    await expect(main.getByRole('button', { name: 'Unknown / not set' })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('button', { name: FOUNDRY })).toHaveCount(0)

    // Withdraw the record at scene two.
    await openStateAt(page, worldId, 'ev2')
    await main.getByRole('button', { name: 'Remove record' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove record' }).click()
    await page.waitForTimeout(1200)

    // Now scene three reads back past it, to the Ash Foundry.
    await openStateAt(page, worldId, 'ev3')
    await expect(main.getByRole('button', { name: FOUNDRY })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('button', { name: 'Unknown / not set' })).toHaveCount(0)
  })

  test('the panel says which of the two a scene has, and the dialog says what it will do', async ({ page }) => {
    const worldId = await severedWorld(page)
    const main = page.getByRole('main')

    // Recorded here: the note says so, and the control is offered.
    await openStateAt(page, worldId, 'ev2')
    await expect(main.getByText('recorded at this scene')).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('carried forward')).toHaveCount(0)

    // And the confirmation names where the state goes back to, and what follows.
    await main.getByRole('button', { name: 'Remove record' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('carried forward from Ch. 1 · The pour')
    await expect(dialog).toContainText('1 later scene currently reads from this record')
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Carried forward: the opposite note, and no control.
    await openStateAt(page, worldId, 'ev3')
    await expect(main.getByText('carried forward')).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText('recorded at this scene')).toHaveCount(0)
    await expect(main.getByRole('button', { name: 'Remove record' })).toHaveCount(0)
  })

  test('the History tab can withdraw a record too', async ({ page }) => {
    const worldId = await severedWorld(page)
    await page.goto(`/#/worlds/${worldId}/characters/ossian?tab=history`, { waitUntil: 'load' })
    await page.waitForTimeout(1800)

    const main = page.getByRole('main')
    // Both records are listed…
    // Anchored: the row's own withdrawal control is named after the row, so an
    // unanchored name matches both and neither assertion would be about the row.
    await expect(main.getByRole('button', { name: /^Ch\. 1 · The pour/ })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByRole('button', { name: /^Ch\. 1 · Weighing the ninth/ })).toBeVisible()

    await main.getByRole('button', { name: 'Remove the recorded state at Ch. 1 · Weighing the ninth' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove record' }).click()
    await page.waitForTimeout(1200)

    // …and one of them is gone, the other untouched.
    await expect(main.getByRole('button', { name: /^Ch\. 1 · Weighing the ninth/ })).toHaveCount(0)
    await expect(main.getByRole('button', { name: /^Ch\. 1 · The pour/ })).toBeVisible()
  })
})
