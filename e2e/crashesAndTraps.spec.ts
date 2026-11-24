import { test, expect, type Page, type Locator } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/*
  Crashes, traps and one-click losses (ux-expert-fixes-plan.md, Part 4). Each
  test takes the state the review found and shows the way out of it, beside the
  case it must leave alone.
*/

type Db = Record<string, {
  add: (v: unknown) => Promise<unknown>
  get: (id: string) => Promise<Record<string, unknown> | undefined>
  toArray: () => Promise<Array<Record<string, unknown>>>
  update: (id: string, v: unknown) => Promise<unknown>
}>

/** A 1x1 gif: an image as far as Leaflet is concerned. */
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

async function newWorld(page: Page, name = 'Ithaca'): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  return worldId
}

/**
 * Two timelines of one chapter and one scene each, with prose; a map with its
 * picture, a place on it, and a character standing there at the first scene.
 */
async function seedBook(page: Page, worldId: string, opts: { scale?: boolean; portrait?: 'broken' } = {}) {
  await page.evaluate(async ([id, gif, scale, portrait]) => {
    const db = (window as unknown as { __pwdb: Db }).__pwdb
    const now = Date.now()
    const bytes = Uint8Array.from(atob(gif), (c) => c.charCodeAt(0))
    await db.blobs.add({ id: 'map-img', worldId: id, mimeType: 'image/gif', data: new Blob([bytes], { type: 'image/gif' }), createdAt: now })
    // Not an image at all: a portrait the browser cannot draw.
    if (portrait) await db.blobs.add({ id: 'face', worldId: id, mimeType: 'image/png', data: new Blob(['not a picture'], { type: 'image/png' }), createdAt: now })
    await db.mapLayers.add({
      id: 'ml', worldId: id, parentMapId: null, name: 'The Aegean', description: '', imageId: 'map-img', imageWidth: 2000, imageHeight: 1500,
      scalePixelsPerUnit: scale ? 1 : null, scaleUnit: scale ? 'km' : null, levelGroupId: null, levelIndex: 0, levelLabel: '', createdAt: now, updatedAt: now,
    })
    await db.locationMarkers.add({ id: 'scheria', worldId: id, mapLayerId: 'ml', name: 'Scheria', description: '', iconType: 'city', x: 1000, y: 750, factionId: null, linkedMapLayerId: null, color: null, createdAt: now, updatedAt: now })
    for (const [tl, name, pos] of [['present', 'Present', 0], ['wanderings', 'Wanderings', 1]] as const) {
      await db.timelines.add({ id: tl, worldId: id, name, description: '', color: '#6366f1', dayOffset: 0, position: pos, createdAt: now, updatedAt: now })
      await db.chapters.add({ id: `c-${tl}`, worldId: id, timelineId: tl, number: 1, title: `${name} one`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({
        id: `e-${tl}`, worldId: id, chapterId: `c-${tl}`, timelineId: tl, title: `${name} scene`, description: '', sortOrder: 1,
        tags: [], locationMarkerId: 'scheria', involvedCharacterIds: ['odysseus'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t-${tl}`, worldId: id, eventId: `e-${tl}`, text: 'Poole kept the door. Poole said nothing.', wordCount: 7, updatedAt: now })
    }
    await db.characters.add({ id: 'odysseus', worldId: id, name: 'Odysseus', description: '', aliases: [], tags: [], portraitImageId: portrait ? 'face' : null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characterSnapshots.add({
      id: 'sn', worldId: id, characterId: 'odysseus', eventId: 'e-present', isAlive: true,
      currentLocationMarkerId: 'scheria', currentMapLayerId: 'ml', inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
  }, [worldId, GIF, !!opts.scale, opts.portrait ?? ''] as const)
}

const db = (page: Page) => ({
  get: (table: string, id: string) => page.evaluate(([t, i]) => (window as unknown as { __pwdb: Db }).__pwdb[t].get(i), [table, id] as const),
  all: (table: string) => page.evaluate((t) => (window as unknown as { __pwdb: Db }).__pwdb[t].toArray(), table),
})

const box = async (l: Locator) => (await l.boundingBox())!

test.describe('crashes', () => {
  test.describe.configure({ timeout: 120_000 })

  test('Link Timelines opens on a relationship stored in the Odyssey’s older shape (UX-1-4)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    // As the Odyssey's file stores it: other names, a type of "flashback", no anchors, no sync points.
    await page.evaluate(async (id) => {
      await (window as unknown as { __pwdb: Db }).__pwdb.timelineRelationships.add({
        worldId: id, createdAt: 1, updatedAt: 1, id: 'odyssey-rel',
        fromTimelineId: 'present', toTimelineId: 'wanderings', type: 'flashback',
        label: 'Odysseus recounts his wanderings at Scheria', fromEventId: 'e-present', toEventId: 'e-wanderings',
      })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('button', { name: 'Link Timelines' }).click()
    // The panel, with the book's link in it — not the router's page in place of the app.
    await expect(page.getByText('Odysseus recounts his wanderings at Scheria')).toBeVisible()
    await expect(page.getByText(/Unexpected Application Error/)).toHaveCount(0)
    await expect(page.getByRole('alert').filter({ hasText: 'This screen stopped working' })).toHaveCount(0)
  })

  test('a screen that fails says so plainly, keeps the frame, and gives its details; an address that names nothing says that', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const worldId = await newWorld(page)
    await page.goto(`/#/worlds/${worldId}/__throw`, { waitUntil: 'load' })
    const alert = page.getByRole('alert').filter({ hasText: 'This screen stopped working' })
    await expect(alert).toBeVisible()
    await expect(page.getByText(/Unexpected Application Error|Hey developer/)).toHaveCount(0)
    await expect(alert.getByRole('button', { name: 'Reload' })).toBeVisible()
    await alert.getByRole('button', { name: 'Copy the details' }).click()
    await expect(alert.getByText(/^Copied\./)).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('A screen failed on purpose')
    // The frame is still there, and another screen is a click away.
    await page.goto(`/#/worlds/${worldId}/characters`, { waitUntil: 'load' })
    await expect(alert).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Characters', exact: true })).toBeVisible()

    await page.goto('/#/no/such/screen', { waitUntil: 'load' })
    const missing = page.getByRole('alert').filter({ hasText: 'There is no page here' })
    await expect(missing).toBeVisible()
    await expect(missing.getByRole('button', { name: 'Copy the details' })).toHaveCount(0)
    await missing.getByRole('link', { name: 'Go to your worlds' }).click()
    await expect(page.getByRole('button', { name: 'New World' })).toBeVisible()
  })
})

test.describe('the map', () => {
  test.describe.configure({ timeout: 120_000 })

  test('Help draws over the map’s controls and takes their clicks (UX-3-4)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    const tools = page.getByRole('button', { name: 'Map tools' })
    await expect(tools).toBeVisible({ timeout: 30_000 })
    const t = await box(tools)
    const at = () => page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el?.closest('[role="dialog"]') ? 'a dialog' : el?.closest('button')?.getAttribute('aria-label') ?? null
    }, [t.x + t.width / 2, t.y + t.height / 2] as const)
    // Under Help's closed state, the point is the map's own control.
    expect(await at()).toBe('Map tools')
    await page.getByRole('button', { name: 'Help', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible()
    // The same point is Help's now: it was the map's toolbar, drawn over Help and taking its clicks.
    expect(await at()).toBe('a dialog')
  })

  test('Clear scale is a named item, one step of Undo, and says what it did (UX-3-5)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId, { scale: true })
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.getByRole('button', { name: 'Map tools' }).click()
    const menu = page.getByRole('menu', { name: 'Map tools' })
    await menu.getByRole('menuitem', { name: 'Clear scale' }).click()
    await expect.poll(async () => (await db(page).get('mapLayers', 'ml'))?.scalePixelsPerUnit).toBeNull()
    const toast = page.getByText('Scale cleared from The Aegean.')
    await expect(toast).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
    await expect.poll(async () => (await db(page).get('mapLayers', 'ml'))?.scalePixelsPerUnit).toBe(1)
    expect((await db(page).get('mapLayers', 'ml'))?.scaleUnit).toBe('km')
    // With no scale there is nothing to clear, and the item is not offered.
    await page.getByRole('button', { name: 'Map tools' }).click()
    await menu.getByRole('menuitem', { name: 'Clear scale' }).click()
    await page.getByRole('button', { name: 'Map tools' }).click()
    await expect(menu.getByRole('menuitem', { name: /^Set map scale/ })).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Clear scale' })).toHaveCount(0)
  })

  test('a map can be deleted from the keyboard: its delete is the next stop after its name (UX-3-18)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    const name = page.locator('[data-map-layer]', { hasText: 'The Aegean' })
    await expect(name).toBeVisible({ timeout: 30_000 })
    const del = page.getByRole('button', { name: 'Delete map The Aegean' })
    // Not drawn while nothing points at it, under a mouse…
    await page.mouse.move(5, 5)
    await expect.poll(() => del.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
    // …and the next Tab stop after the name, drawn when it has focus.
    await name.focus()
    await page.keyboard.press('Tab')
    await expect(del).toBeFocused()
    await expect.poll(() => del.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog', { name: /Delete "The Aegean"/ }).or(page.getByRole('dialog', { name: /Delete "The Aegean"/ }))).toBeVisible()
  })

  test('the Alive control says what a press does, and the change comes with Undo (UX-3-21, D-9)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    // At the scene, so the panel has a state to edit.
    await page.getByRole('button', { name: 'Present scene' }).first().click()
    await page.locator('.leaflet-marker-pane').getByText('Odysseus', { exact: true }).first().click({ timeout: 30_000 })
    const alive = page.getByRole('button', { name: 'Alive — mark as dead' })
    await expect(alive).toBeVisible()
    await alive.click()
    await expect(page.getByText('Odysseus marked as dead from this scene.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Deceased — mark as alive' })).toBeVisible()
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
    await expect(page.getByRole('button', { name: 'Alive — mark as dead' })).toBeVisible()
  })

  test('a portrait that cannot load shows the initials, not a broken image (UX-3-25)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId, { portrait: 'broken' })
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    const pins = page.locator('.leaflet-marker-pane')
    await expect(pins.getByText('Odysseus', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
    await expect(pins.locator('[data-pin-portrait]')).toHaveCount(0)
    await expect(pins.getByText('OD', { exact: true }).first()).toBeVisible()
  })
})

test.describe('one-click losses', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a reply typed under a note goes with Resolve, and one Undo takes back both (UX-2-7)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.evaluate(async (id) => {
      await (window as unknown as { __pwdb: Db }).__pwdb.proseNotes.add({
        id: 'n1', worldId: id, eventId: 'e-present', quote: 'Poole said nothing.', prefix: 'Poole kept the door. ', suffix: '',
        kind: 'query', author: { kind: 'me' }, body: 'Is he silent here?', status: 'open', replies: [],
        createdAt: Date.now(), updatedAt: Date.now(),
      })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: /^Notes/ }).click()
    const notes = page.getByRole('complementary', { name: 'Notes' })
    await notes.getByRole('button', { name: 'Reply', exact: true }).first().click()
    await notes.getByRole('textbox', { name: 'Reply' }).fill('Yes, a little.')
    // The button says what it will do with the words waiting.
    const resolve = notes.getByRole('button', { name: 'Reply and resolve' })
    await expect(resolve).toBeVisible()
    await resolve.click()
    await expect.poll(async () => (await db(page).get('proseNotes', 'n1'))?.status).toBe('resolved')
    const replies = (await db(page).get('proseNotes', 'n1'))?.replies as Array<{ body: string }>
    expect(replies.map((r) => r.body)).toEqual(['Yes, a little.'])

    // One act: one Undo takes back the resolve and the reply together.
    await page.getByRole('button', { name: /^Undo/ }).first().click()
    await expect.poll(async () => (await db(page).get('proseNotes', 'n1'))?.status).toBe('open')
    expect((await db(page).get('proseNotes', 'n1'))?.replies).toEqual([])
  })

  test('Also rename is held back, and says why, when the new name is already a character’s (UX-2-8)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.evaluate(async (id) => {
      const d = (window as unknown as { __pwdb: Db }).__pwdb
      const now = Date.now()
      for (const [cid, name] of [['poole', 'Poole'], ['bradshaw', 'Bradshaw']]) {
        await d.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
      }
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=page`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Find & replace' }).click()
    const dialog = page.getByRole('dialog', { name: 'Find & replace in the manuscript' })
    await dialog.getByPlaceholder('Find…').fill('Poole')
    const replaceBox = dialog.getByPlaceholder('Replace with…')
    // A new name: the rename is offered, ticked.
    await replaceBox.fill('Guest')
    const rename = dialog.getByRole('checkbox', { name: /Also rename/ })
    await expect(rename).toBeChecked()
    await expect(rename).toBeEnabled()
    // A name the book already has: unticked, unavailable, and why.
    await replaceBox.fill('Bradshaw')
    await expect(rename).not.toBeChecked()
    await expect(rename).toBeDisabled()
    await expect(dialog.getByText(/“Bradshaw” is already a character in this book/)).toBeVisible()
    await dialog.getByRole('button', { name: /^Replace all/ }).click()
    await expect(dialog.getByText(/^Replaced \d+ occurrences? in \d+ scenes?\.$/)).toBeVisible()
    const names = (await db(page).all('characters')).map((c) => c.name).sort()
    expect(names).toEqual(['Bradshaw', 'Odysseus', 'Poole'])
  })

  test('a timeline tab is one stop with arrow keys; its delete is in its menu, counted, and Undo brings it back (UX-1-16, D-8)', async ({ page }) => {
    const worldId = await newWorld(page)
    await seedBook(page, worldId)
    await page.goto(`/#/worlds/${worldId}/manuscript?view=cards`, { waitUntil: 'load' })
    await settle(page)
    const tabs = page.getByRole('tablist', { name: 'Timelines' })
    const present = tabs.getByRole('tab', { name: 'Present', exact: true })
    const wanderings = tabs.getByRole('tab', { name: 'Wanderings', exact: true })
    // The tab's name is the timeline's, with no delete inside it.
    await expect(present).toBeVisible()
    await expect(tabs.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
    await present.click()
    await expect(present).toHaveAttribute('aria-selected', 'true')
    // One stop for the row: only the chosen tab is in the Tab order.
    await expect(present).toHaveAttribute('tabindex', '0')
    await expect(wanderings).toHaveAttribute('tabindex', '-1')
    await present.focus()
    await page.keyboard.press('ArrowRight')
    await expect(wanderings).toBeFocused()
    await expect(wanderings).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(present).toBeFocused()

    // Its delete, from the menu beside the tabs, says what goes and that Undo brings it back.
    await wanderings.click()
    await page.getByRole('button', { name: 'Actions for Wanderings' }).click()
    await page.getByRole('menuitem', { name: 'Delete timeline…' }).click()
    const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Delete "Wanderings"/ })).first()
    await expect(confirm).toContainText('Its 1 chapter and 1 scene go with it, prose and all. Undo brings them back.')
    await expect(confirm).not.toContainText(/permanently/)
    await confirm.getByRole('button', { name: /^Delete/ }).click()
    await expect(wanderings).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
    await expect(wanderings).toBeVisible()
    await expect.poll(async () => (await db(page).all('chapters')).filter((c) => c.timelineId === 'wanderings').length).toBe(1)
  })
})
