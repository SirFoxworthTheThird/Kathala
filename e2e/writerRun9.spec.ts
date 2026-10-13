import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * What writer run 9 noted while writing *Short Weight*, past the four larger
 * fixes that have specs of their own (pasteHeadings, briefFactions, mapCast,
 * and the calendar's unit test): a lore page's Markdown, its Link entities
 * list, the Maps tile, a place's own kind, and a cast member an earlier scene
 * already places.
 */

async function newWorld(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Short Weight')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  return worldId
}

test.describe('writer run 9', () => {
  test.describe.configure({ timeout: 150_000 })

  test('a lore page: bold drawn in the preview, hyphens kept on its card, and Escape closes Link entities', async ({ page }) => {
    const worldId = await newWorld(page)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.lorePages.add({
        id: 'lp', worldId: id, categoryId: null, title: 'Salt-frost', tags: [], coverImageId: null, visibleFromEventId: null, linkedEntityIds: [], createdAt: now, updatedAt: now,
        body: '**Salt-frost** is the *tithe-mark* a working leaves behind.',
      })
      await db.characters.add({ id: 'nell', worldId: id, name: 'Nell Ashdown', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }, worldId)

    // The card: the words with their hyphens, the marks gone.
    await page.goto(`/#/worlds/${worldId}/lore`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await expect(main.getByText('Salt-frost is the tithe-mark a working leaves behind.', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(main.getByText(/saltfrost|tithemark/)).toHaveCount(0)

    // The preview: bold and emphasis drawn, and no asterisk left.
    await page.goto(`/#/worlds/${worldId}/lore/lp`, { waitUntil: 'load' })
    await settle(page)
    await main.getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(main.locator('strong', { hasText: 'Salt-frost' })).toBeVisible()
    await expect(main.locator('em', { hasText: 'tithe-mark' })).toBeVisible()
    await expect(main.getByText(/\*/)).toHaveCount(0)

    // Link entities: open, then Escape from its search box closes it and gives the button the focus.
    const toggle = main.getByRole('button', { name: /Link entities/ })
    await toggle.click()
    const search = main.getByPlaceholder('Search…')
    await expect(search).toBeFocused()
    await expect(main.getByRole('button', { name: 'Nell Ashdown' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(search).toHaveCount(0)
    await expect(toggle).toBeFocused()
  })

  test('the Maps tile counts the sub-maps, and a place keeps the kind as the writer wrote it', async ({ page }) => {
    const worldId = await newWorld(page)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Merrow')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Array<Record<string, unknown>>> }>
      const root = (await db.mapLayers.toArray())[0]
      const now = Date.now()
      for (const [id, name] of [['gull', 'Gull House'], ['saltings', 'The Saltings Estate']]) {
        await db.mapLayers.add({ id, worldId: root.worldId, name, parentMapId: root.id, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
      }
      await db.locationMarkers.add({
        id: 'guildhall', worldId: root.worldId, mapLayerId: root.id, name: 'The Guildhall', description: '', iconType: 'custom', customType: 'government office',
        x: Number(root.imageWidth) * 0.4, y: Number(root.imageHeight) * 0.4, factionId: null, linkedMapLayerId: null, color: null, createdAt: now, updatedAt: now,
      })
    })

    // One map, and the two inside it said beside it rather than left out.
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    const tile = page.getByRole('main').getByRole('button', { name: /^1 Maps\b/ })
    await expect(tile).toHaveAccessibleName(/\b2 sub-maps\b/, { timeout: 20_000 })
    await expect(tile).toHaveAccessibleName(/\b1 places\b/)

    // The place's kind, capitalised and otherwise as written: on its pin and in its panel.
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)
    const pins = page.locator('.leaflet-marker-pane')
    await expect(pins.getByText('Government office', { exact: true })).toBeVisible({ timeout: 20_000 })
    await pins.getByText('The Guildhall', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Close location panel' })).toBeVisible()
    // As drawn: CSS title-casing changes what is on the screen and not the text, so innerText — which applies it — is what is read.
    const shown = () => page.locator('span', { hasText: /^government office$/i }).evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText))
    await expect.poll(async () => (await shown()).length).toBeGreaterThanOrEqual(2)
    expect(new Set(await shown())).toEqual(new Set(['Government office']))
  })

  test('a cast member an earlier scene already places is said to be there, not missing', async ({ page }) => {
    const worldId = await newWorld(page)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.locationMarkers.add({ id: 'exchange', worldId: id, mapLayerId: null, name: 'The Tithe Exchange', description: '', iconType: 'building', x: 0, y: 0, factionId: null, linkedMapLayerId: null, color: null, createdAt: now, updatedAt: now })
      await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Restricted', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      for (const [n, title] of [[1, 'Corn Street'], [2, 'The Counter']] as const) {
        await db.events.add({
          id: `e${n}`, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: n,
          tags: [], locationMarkerId: 'exchange', involvedCharacterIds: n === 1 ? ['priya'] : ['priya', 'tom'], mentionedCharacterIds: [], involvedItemIds: [],
          threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
          povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
        })
      }
      for (const [cid, name] of [['priya', 'Priya Lal'], ['tom', 'Tom Wiśniewski']]) {
        await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      }
      await db.characterSnapshots.add({
        id: 's1', worldId: id, characterId: 'priya', eventId: 'e1', sortKey: 1.000001, isAlive: true, currentLocationMarkerId: 'exchange', currentMapLayerId: null,
        inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const section = page.locator('[data-scene-section="e2"]')
    // Priya: placed by the scene before. Tom: nothing anywhere, and said so.
    await expect(section.getByRole('button', { name: /^Priya Lal at The Tithe Exchange, from an earlier scene/ })).toBeVisible({ timeout: 20_000 })
    await expect(section.getByRole('button', { name: /^Tom Wiśniewski no state recorded/ })).toBeVisible()
  })
})
