import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The rest of a blind writer run's findings (the Page's retitle, save and
 * notice row are `pageRetitleAndSave.spec.ts`). Each test is the finding's own
 * reproduction, made to pass: what the writer did, and the record or the
 * screen it should have left.
 */

/** A book with no map: two places, two people, Tobin last recorded on the road. */
async function world(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Saltmarsh')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    for (const [cid, n, title] of [['c1', 1, 'Low Water'], ['c2', 2, 'Sleet']] as const) {
      await db.chapters.add({ id: cid, worldId: id, timelineId: 'tl', number: n, title, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    }
    for (const [cid, name] of [['wren', 'Wren Halloway'], ['tobin', 'Tobin Marsh']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    for (const [pid, name] of [['quay', 'The Quay'], ['road', 'Saltmarsh Road']] as const) {
      await db.locationMarkers.add({ id: pid, worldId: id, mapLayerId: null, linkedMapLayerId: null, name, description: '', x: 0, y: 0, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    await db.items.add({ id: 'letter', worldId: id, name: 'The letter', description: 'Sealed in green wax.', iconType: 'misc', tags: [], imageId: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'c1', 'The boats', 'The boats came in.', ['tobin'], 'road'],
      ['e2', 'c1', 'The ledger is gone', 'Nobody had seen it.', ['wren', 'tobin'], 'quay'],
      ['e3', 'c2', 'Morning', 'The tide was out.', [], null],
      ['e4', 'c2', 'That night', '', [], null],
    ] as const
    let i = 0
    for (const [eid, cid, title, text, cast, place] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: cid, timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: place, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      if (text) await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: text.split(' ').length, updatedAt: now })
    }
    await db.characterSnapshots.add({
      id: 'snap-tobin', worldId: id, characterId: 'tobin', eventId: 'e1', isAlive: true, currentLocationMarkerId: 'road',
      currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      sortKey: 1 + 1 / 1_000_000, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

/** Put the time cursor at a scene — written before a reload, since a running page writes its own store back. */
async function cursorAt(page: Page, worldId: string, eventId: string) {
  await page.evaluate(([wid, eid]) => {
    const raw = localStorage.getItem('kathala-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    // The cursor is kept per world: this world's entry is the one that is read.
    st.state.eventByWorld = { ...(st.state.eventByWorld ?? {}), [wid]: eid }
    localStorage.setItem('kathala-ui', JSON.stringify(st))
  }, [worldId, eventId] as const)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kathala-ui') ?? '{}').state?.activeEventId ?? null)).toBe(eventId)
}

const db = <T,>(page: Page, read: string) => page.evaluate(async (src) => {
  const pwdb = (window as unknown as { __pwdb: unknown }).__pwdb
  return (new Function('db', `return (async () => { ${src} })()`))(pwdb)
}, read) as Promise<T>

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

test.describe('a writer run’s findings', () => {
  test.describe.configure({ timeout: 150_000 })

  test('W-4: Current State edits are kept when the tab is left without Save', async ({ page }) => {
    const worldId = await world(page)
    await cursorAt(page, worldId, 'e2')
    await page.goto(`/#/worlds/${worldId}/characters/wren`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('tab', { name: 'Current State' }).click()
    const hint = page.getByText('Not saved yet — leaving this tab saves it too.')
    // Nothing unsaved, nothing said…
    await expect(hint).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Status Notes' }).fill('Soaked to the knee')
    // …and said once there is.
    await expect(hint).toBeVisible()

    await page.getByRole('tab', { name: /History/ }).click()
    await expect.poll(() => db<string[]>(page,
      "return (await db.characterSnapshots.toArray()).filter((s) => s.characterId === 'wren' && s.eventId === 'e2').map((s) => s.statusNotes)"),
    { timeout: 20_000 }).toEqual(['Soaked to the knee'])
    await page.getByRole('tab', { name: 'Current State' }).click()
    await expect(page.getByRole('textbox', { name: 'Status Notes' })).toHaveValue('Soaked to the knee')
  })

  test('W-2: recording somebody in a scene’s cast starts from where the scene is set', async ({ page }) => {
    const worldId = await world(page)
    await cursorAt(page, worldId, 'e2')
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    // Scoped to the scene: until his record at The boats has loaded, Tobin shows as unrecorded in both.
    const row = page.locator('[data-cast-without-state="tobin"][title*="The ledger is gone"]')
    await row.click()
    // The scene is on the quay; Tobin's last record is the road. The form says which it used.
    await expect(page.getByText('Placed where this scene is set', { exact: false })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Record state' }).click()
    await expect.poll(() => db<Array<[string, string | null]>>(page,
      "return (await db.characterSnapshots.toArray()).filter((s) => s.characterId === 'tobin').map((s) => [s.eventId, s.currentLocationMarkerId]).sort()"),
    { timeout: 20_000 }).toEqual([['e1', 'road'], ['e2', 'quay']])
  })

  test('W-5: a last scene with no prose has a line to write on', async ({ page }) => {
    const worldId = await world(page)
    await openPage(page, worldId)
    // Below the book's last heading, which is where a writer clicks to start the scene.
    await page.getByRole('textbox', { name: 'The book, as one page' }).click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type('Rain all night.')
    await expect.poll(() => db<[string, string | undefined]>(page,
      "const e = await db.events.get('e4'); const t = await db.sceneTexts.where('eventId').equals('e4').first(); return [e.title, t?.text]"),
    { timeout: 20_000 }).toEqual(['That night', 'Rain all night.'])
  })

  test('S-1: a new scene’s ## is not saved as prose while its title is being typed', async ({ page }) => {
    const worldId = await world(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'The tide was out.' }).first().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Control+Enter')
    // Longer than the page's one-second save.
    await page.waitForTimeout(1800)
    expect(await db<string>(page, "return (await db.sceneTexts.where('eventId').equals('e3').first()).text")).toBe('The tide was out.')
  })

  test('W-7: a header line naming an unknown place, and its warning, outlast a reload', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c2?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Morning', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await draft.fill('[#The Larder]\n\nThe tide was out.')
    await draft.blur()
    const warning = page.getByText(/Nothing in this world is called “The Larder”/)
    await expect(warning).toBeVisible({ timeout: 20_000 })

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'Morning', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Scene prose' })).toHaveValue(/^\[#The Larder\]/, { timeout: 20_000 })
    await expect(warning).toBeVisible()
    // And it can still be answered.
    await page.getByRole('button', { name: 'Create “The Larder” as a place', exact: true }).click()
    await expect.poll(() => db<string | null>(page,
      "const e = await db.events.get('e3'); return e.locationMarkerId ? (await db.locationMarkers.get(e.locationMarkerId))?.name ?? null : null"),
    { timeout: 20_000 }).toBe('The Larder')
    await expect(warning).toHaveCount(0)
  })

  test('W-8: New scene in a closed chapter goes after the scene the cursor is on', async ({ page }) => {
    const worldId = await world(page)
    await cursorAt(page, worldId, 'e2')
    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Manuscript', exact: true }).click()
    // Off the navigation rail, which opens over the binder while the pointer rests on it.
    await page.mouse.move(800, 400)
    await settle(page)
    const binder = page.getByRole('navigation', { name: 'Binder' })
    await binder.getByRole('button', { name: 'New scene' }).click()
    await page.keyboard.type('After the ledger')
    await page.keyboard.press('Enter')
    await expect.poll(() => db<string[]>(page,
      "return (await db.events.where('chapterId').equals('c1').toArray()).sort((a, b) => a.sortOrder - b.sortOrder).map((e) => e.title)"),
    { timeout: 20_000 }).toEqual(['The boats', 'The ledger is gone', 'After the ledger'])
  })

  test('W-9: a scene with everybody in it says so, rather than that there is nobody', async ({ page }) => {
    const worldId = await world(page)
    await cursorAt(page, worldId, 'e2')
    await openPage(page, worldId)
    // Into the scene, which opens its chapter's panel and the block for the scene being written.
    await page.locator('.cm-line', { hasText: 'Nobody had seen it.' }).first().click()
    // That block, where Mentioned is always shown.
    const scene = page.getByRole('region', { name: 'This scene' })
    await expect(scene.getByText('Everyone in this world is in the scene.')).toBeVisible({ timeout: 20_000 })
    await expect(scene.getByText('No characters in this world yet.')).toHaveCount(0)
  })

  test('W-10: the undo button names a join as a join, not a field list', async ({ page }) => {
    const worldId = await world(page)
    await openPage(page, worldId)
    // Backspace at the start of a scene's title joins it to the scene before.
    await page.locator('.cm-line', { hasText: '## The ledger is gone' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Backspace')
    await expect(page.getByRole('button', { name: 'Undo', exact: true }))
      .toHaveAttribute('title', /^Undo: Joined “The ledger is gone” into “The boats”/, { timeout: 20_000 })
  })

  test('W-10: an item’s name once, and the Maps tile in a writer’s words', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/items/letter`, { waitUntil: 'load' })
    await settle(page)
    await expect(page.getByRole('main').getByText('Sealed in green wax.')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('main').getByText('The letter', { exact: true })).toHaveCount(1)

    await page.goto(`/#/worlds/${worldId}`, { waitUntil: 'load' })
    await settle(page)
    // Named by its count first: "0 Maps no map yet 2 places".
    const tile = page.getByRole('main').getByRole('button', { name: /^\d+ Maps\b/ })
    await expect(tile).toContainText('no map yet', { timeout: 20_000 })
    await expect(tile).toContainText('places')
    await expect(tile).not.toContainText('root map layers')
  })
})
