import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * A scene's header names where it happens and who is in it, and that now puts
 * them there: each of the cast recorded at the scene's place, at that scene —
 * except somebody the writer recorded elsewhere at that scene, and the dead.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Ash Ledger')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    for (const [cid, name] of [['sab', 'Sabine Varro'], ['pell', 'Pell Okonjo'], ['idris', 'Idris Quell'], ['dask', 'Corwen Dask']] as const) {
      await db.characters.add({ id: cid, worldId: id, name, description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    }
    for (const [mid, name] of [['chapel', 'The Drowned Chapel'], ['quay', 'The Quay']] as const) {
      await db.locationMarkers.add({ id: mid, worldId: id, mapLayerId: null, name, description: '', x: 0, y: 0, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })
    }
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Low Water', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    const scenes = [['e1', 'The quay', 'The boats were in.'], ['e2', 'The chapel', 'The bell rang under the water.']] as const
    let i = 0
    for (const [eid, title, text] of scenes) {
      i++
      await db.events.add({
        id: eid, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: i,
        tags: [], locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
      await db.sceneTexts.add({ id: `t${i}`, worldId: id, eventId: eid, text, wordCount: 5, updatedAt: now })
    }
    const snap = (sid: string, cid: string, eid: string, key: number, place: string, alive = true) => ({
      id: sid, worldId: id, characterId: cid, eventId: eid, sortKey: key, isAlive: alive, currentLocationMarkerId: place,
      currentMapLayerId: null, inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
    // Sabine was at the quay; Dask died there; Idris is recorded on the quay at the chapel scene itself — the writer's word.
    await db.characterSnapshots.add(snap('s1', 'sab', 'e1', 1.000001, 'quay'))
    await db.characterSnapshots.add(snap('s2', 'dask', 'e1', 1.000001, 'quay', false))
    await db.characterSnapshots.add(snap('s3', 'idris', 'e2', 1.000002, 'quay'))
  }, worldId)
  return worldId
}

/** Where each state at the chapel scene says its character is — one entry per row, so a duplicate shows. */
const atChapelScene = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    characterSnapshots: { toArray: () => Promise<Array<{ characterId: string; eventId: string; currentLocationMarkerId: string | null; isAlive: boolean }>> }
  }
  return (await db.characterSnapshots.toArray()).filter((s) => s.eventId === 'e2').map((s) => `${s.characterId}:${s.currentLocationMarkerId}`).sort()
})

const line = (page: Page, text: string | RegExp) => page.locator('.cm-line', { hasText: text }).first()

test.describe('the cast, recorded where the header says', () => {
  test.describe.configure({ timeout: 150_000 })

  test('on the Page: each recorded at the scene’s place but the one recorded elsewhere and the dead, and they follow when the place changes', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    expect(await atChapelScene(page)).toEqual(['idris:quay'])

    await line(page, 'The bell rang').click()
    await page.keyboard.press('Home')
    await page.keyboard.type('[#The Drowned Chapel @@Sabine Varro @@Pell Okonjo @@Idris Quell @@Corwen Dask]')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    await expect.poll(() => atChapelScene(page), { timeout: 20_000 }).toEqual(['idris:quay', 'pell:chapel', 'sab:chapel'])

    // The scene moved to the quay: those it put at the chapel go with it; Idris was already the writer's.
    await line(page, 'Place: #The Drowned Chapel').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Shift+Home')
    await page.keyboard.type('Place: #The Quay')
    await page.keyboard.press('Escape')
    await line(page, 'The bell rang').click()
    await expect.poll(() => atChapelScene(page), { timeout: 20_000 }).toEqual(['idris:quay', 'pell:quay', 'sab:quay'])
  })

  test('on a scene card: the same', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('The bell rang under the water.', { timeout: 20_000 })
    await draft.fill('[#The Drowned Chapel @@Sabine Varro @@Corwen Dask]\n\nThe bell rang under the water.')
    await draft.blur()
    await expect.poll(() => atChapelScene(page), { timeout: 20_000 }).toEqual(['idris:quay', 'sab:chapel'])
  })

  test('on a scene card: two applies at once record each of the cast once', async ({ page }) => {
    const worldId = await book(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The chapel', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toHaveValue('The bell rang under the water.', { timeout: 20_000 })
    await draft.fill('[#The Drowned Chapel @@Sabine Varro @@Pell Okonjo]\n\nThe bell rang under the water.')
    // The autosave's apply can still be writing when the blur's starts; two blurs in one turn make that overlap certain.
    await draft.evaluate((el: HTMLTextAreaElement) => { el.blur(); el.focus(); el.blur() })
    await expect.poll(() => atChapelScene(page), { timeout: 20_000 }).toEqual(['idris:quay', 'pell:chapel', 'sab:chapel'])
    // And stays so: nothing still writing adds a second.
    await page.waitForTimeout(1500)
    expect(await atChapelScene(page)).toEqual(['idris:quay', 'pell:chapel', 'sab:chapel'])
  })
})
