import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'
import { waitForMapReady } from './helpers/map'

/**
 * A second blind writer run, after the manuscript: maps and sub-maps, items
 * handed out, pictures linked, and the long lists. Each test is a finding's
 * reproduction, made to pass. The Page's findings are `writerRun2Page.spec.ts`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MAIN_MAP = path.resolve(__dirname, 'map_example/main_map.jpg')

const db = <T,>(page: Page, read: string) => page.evaluate(async (src) => {
  const pwdb = (window as unknown as { __pwdb: unknown }).__pwdb
  return (new Function('db', `return (async () => { ${src} })()`))(pwdb)
}, read) as Promise<T>

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

/** Chapters, scenes, two people and an item; `places` are added by the caller. */
async function seedBook(page: Page, worldId: string) {
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'Sleet']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    for (const [cid, name] of [['ilse', 'Ilse Marrow'], ['wren', 'Wren Halloway']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.items.add({ id: 'key', worldId: id, name: 'The brass key', description: '', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'c1', 'The boats'],
      ['e2', 'c1', 'The ledger is gone'],
      ['e3', 'c2', 'Morning'],
    ] as const
    let i = 0
    for (const [eid, cid, title] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
  }, worldId)
}

/** Put the time cursor at a scene — written before a reload, since a running page writes its own store back. */
async function cursorAt(page: Page, worldId: string, eventId: string) {
  await page.evaluate(([wid, eid]) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}), [wid]: eid }
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, [worldId, eventId] as const)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
}

const snap = (characterId: string, eventId: string, sortKey: number, fields: Record<string, unknown> = {}) => ({
  id: `s-${characterId}-${eventId}`, characterId, eventId, isAlive: true, currentLocationMarkerId: null,
  currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
  sortKey, createdAt: 1, updatedAt: 1, ...fields,
})

test.describe('the rest of the book, from a second writer run', () => {
  test.describe.configure({ timeout: 180_000 })

  test('G-1 and T-1: the scene’s cast placed in one go, and a sub-map that stays put while its pins are edited', async ({ page }) => {
    const worldId = await newWorld(page, 'Vessary')
    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Vessary')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await waitForMapReady(page)
    await seedBook(page, worldId)
    // The Undercroft: a sub-map under the Chantry, on the same picture.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Array<Record<string, unknown>>>; update: (k: string, v: unknown) => Promise<unknown> }>
      const now = Date.now()
      const main = (await db.mapLayers.toArray())[0]
      await db.mapLayers.add({ ...main, id: 'under', name: 'The Undercroft', parentMapId: main.id, createdAt: now, updatedAt: now })
      const pin = (pid: string, name: string, layer: unknown, x: number, y: number, linked: string | null = null) => db.locationMarkers.add({
        id: pid, worldId: id, mapLayerId: layer, linkedMapLayerId: linked, name, description: '', x, y,
        imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now,
      })
      await pin('bell', 'The Drowned Bell', main.id, 300, 300)
      await pin('chantry', 'Chantry of Lamps', main.id, 600, 400, 'under')
      await pin('crypt', 'The Crypt', 'under', 400, 300)
      await db.events.update('e2', { locationMarkerId: 'bell', involvedCharacterIds: ['ilse', 'wren'] })
    }, worldId)

    await cursorAt(page, worldId, 'e2')
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await waitForMapReady(page)

    // G-1: the scene's cast, not recorded where it is set — said, and placed with one press.
    const here = page.getByRole('group', { name: 'In this scene' })
    await expect(here).toContainText('set at The Drowned Bell, but not recorded there: Ilse Marrow, Wren Halloway', { timeout: 20_000 })
    await here.getByRole('button', { name: 'Place all 2 at The Drowned Bell' }).click()
    await expect.poll(() => db(page, `return (await db.characterSnapshots.toArray()).map((s) => [s.characterId, s.eventId, s.currentLocationMarkerId]).sort()`), { timeout: 20_000 })
      .toEqual([['ilse', 'e2', 'bell'], ['wren', 'e2', 'bell']])
    await expect(here).toHaveCount(0)

    // T-1: on the sub-map, a pin edit leaves the map where it is.
    await page.getByRole('main').getByRole('button', { name: 'The Undercroft', exact: true }).click()
    const crypt = page.getByRole('button', { name: 'The Crypt landmark', exact: true })
    await expect(crypt).toBeVisible({ timeout: 20_000 })
    await db(page, `await db.locationMarkers.update('crypt', { x: 450, updatedAt: Date.now() })`)
    await page.waitForTimeout(1500)
    await expect(crypt).toBeVisible()
    await expect(page.getByRole('button', { name: 'The Drowned Bell landmark', exact: true })).toHaveCount(0)
  })

  test('T-2: an item given after the later scenes were recorded is offered forward, up to where it is somewhere else', async ({ page }) => {
    const worldId = await newWorld(page, 'The Ledger')
    await seedBook(page, worldId)
    await page.evaluate(async (s) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      for (const row of s) await db.characterSnapshots.add(row)
    }, [
      { ...snap('ilse', 'e1', 1.000001, { inventoryItemIds: ['key'] }), worldId },
      { ...snap('ilse', 'e2', 1.000002), worldId },
      { ...snap('ilse', 'e3', 2.000003), worldId },
      // Wren has the key by Morning: the run stops there.
      { ...snap('wren', 'e3', 2.000003, { inventoryItemIds: ['key'] }), worldId },
    ])
    await cursorAt(page, worldId, 'e1')
    await page.goto(`/#/worlds/${worldId}/characters/ilse`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('tab', { name: 'Current State' }).click()
    const offer = page.getByRole('status').filter({ hasText: 'The brass key is not in' })
    await expect(offer).toHaveText(/The brass key is not in Ilse Marrow’s next record, at Ch\. 1 · The ledger is gone\.\s*Carry The brass key forward/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Take The brass key out of the inventory' })).toBeVisible()
    await offer.getByRole('button', { name: 'Carry The brass key forward' }).click()
    await expect.poll(() => db(page, `return (await db.characterSnapshots.toArray()).filter((s) => s.inventoryItemIds.includes('key')).map((s) => s.characterId + '@' + s.eventId).sort()`), { timeout: 20_000 })
      .toEqual(['ilse@e1', 'ilse@e2', 'wren@e3'])
    await expect(offer).toHaveCount(0)
  })

  test('T-2: a toast stays while it is being read', async ({ page }) => {
    const worldId = await newWorld(page, 'The Ledger')
    await seedBook(page, worldId)
    await page.evaluate(async (s) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      for (const row of s) await db.characterSnapshots.add(row)
    }, [
      { ...snap('ilse', 'e1', 1.000001, { statusNotes: 'cold' }), worldId },
      { ...snap('ilse', 'e2', 1.000002, { statusNotes: 'cold' }), worldId },
    ])
    await cursorAt(page, worldId, 'e1')
    await page.goto(`/#/worlds/${worldId}/characters/ilse`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('tab', { name: 'Current State' }).click()
    await page.getByLabel('Status Notes').fill('soaked')
    await page.getByRole('button', { name: 'Save State' }).click()
    const toast = page.locator('[data-held], div').filter({ hasText: /recorded again at Ch\. 1 · The ledger is gone/ }).last()
    await expect(toast).toBeVisible({ timeout: 10_000 })
    await toast.hover()
    await page.waitForTimeout(8_500)
    await expect(toast).toBeVisible()
    // Paired: let go of it, and it goes.
    await page.mouse.move(5, 5)
    await expect(toast).toBeHidden({ timeout: 10_000 })
  })

  test('T-3: a picture that cannot load just now is linked anyway and said; a map still needs it to load', async ({ page }) => {
    const worldId = await newWorld(page, 'The Ledger')
    await seedBook(page, worldId)
    await page.route('https://pictures.example/**', (route) => route.abort())
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    await page.route('https://ok.example/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }))

    await page.goto(`/#/worlds/${worldId}/items/key`, { waitUntil: 'load' })
    await settle(page)
    const link = async (url: string) => {
      await page.getByRole('button', { name: 'Link item image by URL' }).click()
      await page.getByPlaceholder('https://…/image.png').fill(url)
      await page.getByRole('button', { name: 'Add linked image' }).click()
    }
    await link('https://pictures.example/key.png')
    await expect(page.getByRole('status').filter({ hasText: 'Linked. The picture could not be loaded just now' })).toBeVisible({ timeout: 20_000 })
    expect(await db(page, `const i = await db.items.get('key'); return (await db.blobs.get(i.imageId))?.url ?? null`)).toBe('https://pictures.example/key.png')
    // Paired: one that loads is linked with nothing to say.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await link('https://ok.example/key.png')
    await expect.poll(() => db(page, `const i = await db.items.get('key'); return (await db.blobs.get(i.imageId))?.url ?? null`), { timeout: 20_000 })
      .toBe('https://ok.example/key.png')
    await expect(page.getByText('Linked. The picture could not be loaded just now')).toHaveCount(0)

    // A map is refused, and told why.
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)
    await page.mouse.move(700, 400)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.getByPlaceholder('https://…/map.jpg').fill('https://pictures.example/map.png')
    await page.getByRole('button', { name: 'Use link' }).click()
    await expect(page.getByText(/A map needs its picture’s size/)).toBeVisible({ timeout: 20_000 })
  })

  test('T-5 and T-6: the controls the run could not reach or name, and a scene list that can be filtered', async ({ page }) => {
    const worldId = await newWorld(page, 'The Ledger')
    await seedBook(page, worldId)
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.lorePages.add({ id: 'lp', worldId: id, categoryId: null, title: 'The Salt Accord', body: '', tags: [], coverImageId: null, visibleFromEventId: null, linkedEntityIds: [], createdAt: now, updatedAt: now })
    }, worldId)

    // The item page: a named way back, and an upload that a keyboard reaches.
    await page.goto(`/#/worlds/${worldId}/items/key`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
    const upload = page.getByLabel('Upload item image')
    await page.getByRole('button', { name: 'Link item image by URL' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(upload).toBeFocused()

    await page.goto(`/#/worlds/${worldId}/lore/lp`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('button', { name: 'Delete this lore page' })).toBeVisible()

    // T-6: "Revealed to be … at" lists every scene, and can be narrowed.
    await page.goto(`/#/worlds/${worldId}/characters/wren`, { waitUntil: 'load' })
    await settle(page)
    const main = page.getByRole('main')
    await main.getByRole('button', { name: 'Edit', exact: true }).click()
    const reveal = main.getByRole('group', { name: 'Revealed to be' })
    await reveal.getByRole('button', { name: /^Revealed to be No one/ }).click()
    await page.getByRole('option', { name: 'Ilse Marrow', exact: true }).click()
    await reveal.getByRole('button', { name: /^at choose the scene/ }).click()
    // Paired: all three before the filter, one after it.
    await expect(page.getByRole('option')).toHaveCount(3)
    await page.getByLabel('Filter scenes…').fill('Morn')
    await expect(page.getByRole('option')).toHaveCount(1)
    await expect(page.getByRole('option', { name: 'Ch. 2 — Morning' })).toBeVisible()
  })
})
