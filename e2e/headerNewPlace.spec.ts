import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * `[#The Larder]` over a world that has no larder: the header says so and
 * leaves the setting alone — the likeliest reason is a typo — and now offers to
 * make the place, without a map, and set the scene there.
 *
 * Driven on both of the header's homes, a scene card and the Page, because each
 * keeps its own warning and its own idea of when the line is drawn from the
 * records again. The write itself is pinned in `src/db/hooks/__tests__/mentions.test.ts`.
 */

async function world(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('The Salt Kitchen')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'wren', worldId: id, name: 'Wren Halloway', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({
      id: 'quay', worldId: id, mapLayerId: null, linkedMapLayerId: null, name: 'The Quay', description: '',
      x: 0, y: 0, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The Kettle', description: '',
      locationMarkerId: 'quay', involvedCharacterIds: ['wren'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], tags: [], sortOrder: 0, travelDays: null, inWorldTime: null,
      tension: null, structureBeat: null, status: 'draft', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'ev1', text: 'She put the kettle on.', wordCount: 5, updatedAt: now })
  }, worldId)
  return worldId
}

/** The scene's setting and cast, and every place in the world with the map it is on. */
const state = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as {
    events: { get: (id: string) => Promise<{ locationMarkerId: string | null; involvedCharacterIds: string[] }> }
    locationMarkers: { toArray: () => Promise<Array<{ id: string; name: string; mapLayerId: string | null }>> }
  }
  const ev = await db.events.get('ev1')
  const places = await db.locationMarkers.toArray()
  const at = places.find((p) => p.id === ev.locationMarkerId)
  return {
    setting: at?.name ?? null,
    cast: ev.involvedCharacterIds,
    places: places.map((p) => `${p.name}${p.mapLayerId ? ' (mapped)' : ''}`).sort(),
  }
})

/** A change made somewhere other than the line: it reaches the line only if the line is drawn from the records again. */
const leaveTheRoom = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as { events: { update: (k: string, v: unknown) => Promise<unknown> } }
  await db.events.update('ev1', { involvedCharacterIds: [] })
})

const create = (page: Page, name: string) => page.getByRole('button', { name: `Create “${name}” as a place`, exact: true })

test.describe('a place the header names that the world has not got', () => {
  test.describe.configure({ timeout: 180_000 })

  test('on a scene card: offered, made without a map, and the scene set there', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/manuscript/ch1?view=cards`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('main').getByRole('button', { name: 'The Kettle', exact: true }).click()
    const draft = page.getByRole('textbox', { name: 'Scene prose' })
    await expect(draft).toBeVisible({ timeout: 20_000 })

    // A misspelled person: said, and nothing offered — the place is the only thing the note makes.
    await draft.fill('[#The Quay @@Wren Haloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect(page.getByText(/Nothing in this world is called “Wren Haloway”/)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^Create “.*” as a place$/ })).toHaveCount(0)

    // A new place: said, and offered. Until it is pressed, nothing is made and the setting stays.
    await draft.fill('[#The Larder @@Wren Halloway]\n\nShe put the kettle on.')
    await draft.blur()
    await expect(create(page, 'The Larder')).toBeVisible({ timeout: 20_000 })
    expect(await state(page)).toEqual({ setting: 'The Quay', cast: ['wren'], places: ['The Quay'] })

    await create(page, 'The Larder').click()
    await expect.poll(() => state(page), { timeout: 20_000 })
      .toEqual({ setting: 'The Larder', cast: ['wren'], places: ['The Larder', 'The Quay'] })
    await expect(page.getByText(/Nothing in this world is called/)).toBeHidden()
    await expect(create(page, 'The Larder')).toHaveCount(0)
    await expect(draft).toHaveValue(/^\[#The Larder @@Wren Halloway\]\n\nShe put the kettle on\.$/)

    // And the line is the records' again, not the text that was typed.
    await leaveTheRoom(page)
    await expect(draft).toHaveValue(/^\[#The Larder\]\n\nShe put the kettle on\.$/, { timeout: 20_000 })

    // And it is where a place with no map waits: on the Maps screen, which in a
    // world without a map lists every place there is.
    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)
    const waiting = page.getByRole('region', { name: /^Not on a map/ })
    await expect(waiting.getByRole('button', { name: 'The Larder', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(waiting.getByRole('button', { name: 'The Quay', exact: true })).toBeVisible()
  })

  test('on the Page: the same, and a misspelled name on the same line is still said', async ({ page }) => {
    const worldId = await world(page)
    await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
    await settle(page)
    await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'The book, as one page' })).toBeVisible({ timeout: 20_000 })
    const header = page.locator('.cm-draft-header')
    await expect(header).toHaveText('[#The Quay @@Wren Halloway]', { timeout: 20_000 })

    const retype = async (typed: string) => {
      await header.click()
      await page.keyboard.press('End')
      await page.keyboard.press('Shift+Home')
      await page.keyboard.type(typed)
      await page.keyboard.press('ArrowDown')
    }
    const status = page.getByRole('status').filter({ hasText: 'Nothing in this world is called' })

    await retype('[#The Larder @@Wren Halloway]')
    await expect(status).toContainText('“The Larder”')
    expect(await state(page)).toEqual({ setting: 'The Quay', cast: ['wren'], places: ['The Quay'] })
    await create(page, 'The Larder').click()
    await expect.poll(() => state(page), { timeout: 20_000 })
      .toEqual({ setting: 'The Larder', cast: ['wren'], places: ['The Larder', 'The Quay'] })
    await expect(status).toHaveCount(0)
    await expect(header).toHaveText('[#The Larder @@Wren Halloway]')
    // Drawn from the records again: a change made elsewhere arrives on it. (Off the line first — the one being typed on is left alone.)
    await page.locator('.cm-line', { hasText: 'She put the kettle on.' }).click()
    await leaveTheRoom(page)
    await expect(header).toHaveText('[#The Larder]', { timeout: 20_000 })

    // A new place and a misspelled person on one line: the place can be made; the person is still said.
    await retype('[#The Cellar @@Wren Haloway]')
    await expect(status).toContainText('“Wren Haloway” or “The Cellar”')
    await create(page, 'The Cellar').click()
    await expect.poll(() => state(page), { timeout: 20_000 })
      // The cast is the one it had (emptied above): a misspelled name changes nobody.
      .toEqual({ setting: 'The Cellar', cast: [], places: ['The Cellar', 'The Larder', 'The Quay'] })
    await expect(status).toContainText('“Wren Haloway”')
    await expect(status).not.toContainText('The Cellar')
    await expect(page.getByRole('button', { name: /^Create “.*” as a place$/ })).toHaveCount(0)
  })
})
