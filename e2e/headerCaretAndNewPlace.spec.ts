import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Two things a fourth writer run lost data to, on the Page:
 * - going to a scene — from the binder, or with Ctrl+Alt+↓ — put the caret on
 *   its header block's first line, and what was typed there turned the header
 *   into prose (W-1);
 * - a place made from the header's note left the scene's people unrecorded
 *   there, and a hand-off typed on the same header left its holder at the place
 *   they came from (W-2).
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Saltmere')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    for (const [cid, name] of [['isolde', 'Isolde Marrow'], ['kell', 'Ambrose Kell']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    await db.locationMarkers.add({ id: 'gull', worldId: id, mapLayerId: null, name: 'The Gull and Anchor', description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    await db.items.add({ id: 'letter', worldId: id, name: "Clara's Letter", description: '', iconType: 'other', tags: [], imageId: null, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [
      ['e1', 'Arrival', 'The boats were in.', 'gull', ['isolde']],
      ['e2', 'The Vicar', 'The bell rang under the water.', null, []],
      ['e3', 'After', 'Nobody spoke of it.', 'gull', ['isolde', 'kell']],
    ] as const
    let i = 0
    for (const [eid, title, text, place, cast] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: place, involvedCharacterIds: [...cast], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 4, updatedAt: now })
    }
    // Isolde at the inn from the first scene, holding the letter.
    await db.characterSnapshots.add({
      id: 's1', worldId: id, characterId: 'isolde', eventId: 'e1', sortKey: 1.000001, isAlive: true,
      currentLocationMarkerId: 'gull', currentMapLayerId: null, inventoryItemIds: ['letter'], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

async function openPage(page: Page, worldId: string) {
  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=page`, { waitUntil: 'load' })
  await settle(page)
  await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
}

/** What each scene stores: its prose, cast and place. */
const stored = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    sceneTexts: { toArray: () => Promise<Array<{ eventId: string; text: string }>> }
    events: { toArray: () => Promise<Array<{ id: string; involvedCharacterIds: string[]; locationMarkerId: string | null }>> }
  }
  const texts = Object.fromEntries((await db.sceneTexts.toArray()).map((t) => [t.eventId, t.text]))
  return Object.fromEntries((await db.events.toArray()).map((e) => [e.id, { text: texts[e.id], cast: e.involvedCharacterIds, place: e.locationMarkerId }]))
})

/** Where each character's state at scene `eventId` says they are, and what they hold. */
const statesAt = (page: Page, eventId: string) => page.evaluate(async (eid) => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; eventId: string; currentLocationMarkerId: string | null; inventoryItemIds: string[] }>> }
    locationMarkers: { toArray: () => Promise<Array<{ id: string; name: string }>> }
  }
  const places = await db.locationMarkers.toArray()
  const name = (id: string | null) => places.find((p) => p.id === id)?.name ?? id
  return (await db.characterSnapshots.toArray()).filter((s) => s.eventId === eid)
    .map((s) => `${s.characterId}@${name(s.currentLocationMarkerId)}${s.inventoryItemIds.length ? `:${s.inventoryItemIds.join(',')}` : ''}`).sort()
}, eventId)

test.describe('a fourth writer run’s data losses on the Page', () => {
  test.describe.configure({ timeout: 150_000 })

  test('W-1: going to a scene puts the caret under its header block, so what is typed is prose — from the binder and by key', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    const tree = page.getByRole('tree', { name: 'Chapters and scenes' })

    await tree.getByRole('treeitem', { name: 'Arrival' }).click()
    // The page takes focus a moment after the click; keys sent before then land on the tree, and are lost.
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeFocused()
    await page.keyboard.type('Rain. ')
    await expect.poll(async () => (await stored(page)).e1, { timeout: 15_000 })
      .toEqual({ text: 'Rain. The boats were in.', cast: ['isolde'], place: 'gull' })

    // By key, into a scene whose header has two lines.
    await page.keyboard.press('Control+Alt+ArrowDown')
    await page.keyboard.press('Control+Alt+ArrowDown')
    await page.keyboard.type('Dusk. ')
    await expect.poll(async () => (await stored(page)).e3, { timeout: 15_000 })
      .toEqual({ text: 'Dusk. Nobody spoke of it.', cast: ['isolde', 'kell'], place: 'gull' })
    // And the header is still the header, drawn as the block.
    await expect(page.locator('.cm-line.cm-draft-header', { hasText: 'Characters: @@Isolde Marrow @@Ambrose Kell' })).toHaveCount(1)
  })

  test('W-2: a place made from the header note records the scene’s people there — the one handed the letter too', async ({ page }) => {
    const worldId = await book(page)
    await openPage(page, worldId)
    await page.locator('.cm-line', { hasText: 'The bell rang under the water.' }).first().click()
    await page.keyboard.press('Home')
    await page.keyboard.type("[#The Vicarage @@Isolde Marrow @@Ambrose Kell ^Clara's Letter:@Ambrose Kell]")
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    const create = page.getByRole('button', { name: 'Create “The Vicarage” as a place', exact: true })
    await expect(create).toBeVisible({ timeout: 15_000 })
    // Before it is made: Isolde's state here exists — the hand-off wrote it — at the inn she came from.
    await expect.poll(() => statesAt(page, 'e2'), { timeout: 15_000 }).toEqual(['isolde@The Gull and Anchor', 'kell@null:letter'])

    await create.click()
    await expect.poll(() => statesAt(page, 'e2'), { timeout: 15_000 }).toEqual(['isolde@The Vicarage', 'kell@The Vicarage:letter'])
  })
})
