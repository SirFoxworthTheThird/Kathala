import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Places that share a name (writer run 8): a second "The Beacon" on the main
 * map, nothing said so, and the scene header resolved to whichever came first.
 */

async function newWorld(page: Page, name: string): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  return worldId
}

/** Two maps; two Beacons on one of them, a Kitchen on each, and a yard on none. */
async function book(page: Page): Promise<string> {
  const worldId = await newWorld(page, 'Slack Water')
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    const map = (mid: string, name: string) => ({ id: mid, worldId: id, name, parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.mapLayers.add(map('sands', 'Hollin Sands'))
    await db.mapLayers.add(map('house', 'Scaur House'))
    const place = (pid: string, name: string, mapLayerId: string | null) => ({ id: pid, worldId: id, mapLayerId, name, description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'landmark', color: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add(place('b1', 'The Beacon', 'sands'))
    await db.locationMarkers.add(place('b2', 'The Beacon', 'sands'))
    await db.locationMarkers.add(place('k1', 'The Kitchen', 'house'))
    await db.locationMarkers.add(place('k2', 'The Kitchen', 'sands'))
    await db.locationMarkers.add(place('yard', 'The Yard', null))
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Slack Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The light', 'A lamp on the sands.', 'b2'], ['e2', 'Breakfast', 'Tea, strong.', 'yard']] as const
    let i = 0
    for (const [eid, title, text, at] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: at, involvedCharacterIds: ['nell'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 4, updatedAt: now })
    }
    for (const [cid, name] of [['nell', 'Nell Garrity'], ['kit', 'Kit Fenwick']]) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

const scene = (page: Page, eventId: string) => page.evaluate(async (id) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { get: (id: string) => Promise<{ locationMarkerId: string | null; involvedCharacterIds: string[] }> } }
  const e = await db.events.get(id)
  return { place: e.locationMarkerId, cast: e.involvedCharacterIds }
}, eventId)

test.describe('places that share a name', () => {
  test.describe.configure({ timeout: 150_000 })

  test('a header edit leaves the scene at the place of that name it is set at, not the first one', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await expect(page.locator('.cm-line', { hasText: 'Characters: @@Nell Garrity' })).toHaveCount(2, { timeout: 20_000 })

    // Kit added on the first scene's Characters line, picked with Tab, and the line left.
    await page.locator('.cm-line', { hasText: 'Characters: @@Nell Garrity' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' @@Kit', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Tab')
    await page.locator('.cm-line', { hasText: 'A lamp on the sands.' }).first().click()

    // Applied — Kit is in the scene — and the scene is still at the second Beacon.
    await expect.poll(() => scene(page, 'e1'), { timeout: 15_000 }).toEqual({ place: 'b2', cast: ['nell', 'kit'] })
    await page.waitForTimeout(1000)
    expect((await scene(page, 'e1')).place).toBe('b2')
  })

  test('a name that two maps share is not guessed: the note names both, and picking one sets it and says which', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const placeLine = page.locator('.cm-line', { hasText: 'Place: #The Yard' })
    await expect(placeLine).toHaveCount(1, { timeout: 20_000 })

    // The Yard typed over with the Kitchen, and the line left.
    await placeLine.click()
    await page.keyboard.press('End')
    for (let i = 0; i < 'The Yard'.length; i++) await page.keyboard.press('Backspace')
    await page.keyboard.type('The Kitchen', { delay: 20 })
    await page.locator('.cm-line', { hasText: 'Tea, strong.' }).first().click()

    const note = page.getByText(/More than one place is called “The Kitchen”/)
    await expect(note).toBeVisible({ timeout: 15_000 })
    await expect(note).toContainText('write “The Kitchen (Scaur House)” or “The Kitchen (Hollin Sands)” to say which')
    await expect(note).toContainText('It is still set at The Yard.')
    expect((await scene(page, 'e2')).place).toBe('yard')

    await page.getByRole('button', { name: 'Set at “The Kitchen (Scaur House)”', exact: true }).click()
    await expect.poll(() => scene(page, 'e2'), { timeout: 15_000 }).toEqual({ place: 'k1', cast: ['nell'] })
    await expect(page.locator('.cm-line', { hasText: 'Place: #The Kitchen (Scaur House)' })).toHaveCount(1, { timeout: 15_000 })
    await expect(note).toHaveCount(0)
  })

  test('Maps marks two places of one name, and says so while one is named or renamed', async ({ page }) => {
    const worldId = await newWorld(page, 'Mapless')
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      const place = (pid: string, name: string) => ({ id: pid, worldId: id, mapLayerId: null, name, description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'landmark', color: null, createdAt: now, updatedAt: now })
      await db.locationMarkers.add(place('b1', 'The Beacon'))
      await db.locationMarkers.add(place('b2', 'The Beacon'))
      await db.locationMarkers.add(place('yard', 'The Yard'))
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)

    const waiting = page.getByRole('region', { name: /^Not on a map/ })
    await expect(waiting.getByRole('button', { name: 'The Beacon same name', exact: true })).toHaveCount(2, { timeout: 20_000 })
    await expect(waiting.getByRole('button', { name: 'The Yard', exact: true })).toHaveCount(1)

    // Naming a new place: said for a name taken, and not for one that is not.
    await page.getByRole('button', { name: 'Add a place', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const name = dialog.getByLabel('Name')
    await name.fill('the yard')
    await expect(dialog.getByText('Another place with no map is already called “The Yard”.', { exact: false })).toBeVisible()
    await expect(name).toHaveAccessibleDescription(/already called “The Yard”/)
    await name.fill('The Yards')
    await expect(dialog.getByText(/already called/)).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    // Renaming one: the same, and not of itself.
    await waiting.getByRole('button', { name: 'The Yard', exact: true }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const rename = page.getByRole('textbox', { name: 'Name', exact: true })
    await expect(rename).toHaveValue('The Yard')
    await expect(page.getByText(/already called/)).toHaveCount(0)
    await rename.fill('The Beacon')
    await expect(page.getByText('Another place with no map is already called “The Beacon”.', { exact: false })).toBeVisible()
  })
})
