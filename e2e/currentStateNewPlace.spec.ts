import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/*
  A place made from Current State's location picker (round-trip-plan.md, T6,
  W-D). Saying where a person off stage was took six steps: out to Maps, a
  place added there, back to the person, Current State, the place picked,
  Save. Now it is the picker's last choice, New place…, and the place has no
  map, as a place need not.
*/

async function seed(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Salt')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'One', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'tomas', worldId: id, name: 'Tomas Varga', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'quay', worldId: id, mapLayerId: null, name: 'The Quay', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'landmark', color: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The letter is gone', description: '', sortOrder: 0, tags: [],
      locationMarkerId: null, involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [], threadIds: [], motifIds: [],
      travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft', povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

const places = (page: Page) => page.evaluate(async () => {
  const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ name: string; mapLayerId: string | null }>> }>
  return (await db.locationMarkers.toArray()).map((m) => [m.name, m.mapLayerId]).sort()
})

test('New place… makes a place with no map, picks it, and it is saved as where they are; a name the book has picks that one', async ({ page }) => {
  test.setTimeout(150_000)
  const worldId = await seed(page)
  const open = async () => {
    await page.goto(`/#/worlds/${worldId}/characters/tomas?tab=state`, { waitUntil: 'load' })
    await settle(page)
  }
  await open()
  await page.getByRole('button', { name: 'Next moment' }).click()
  await settle(page)
  const main = page.getByRole('main')

  await main.getByRole('button', { name: /^Current Location Unknown \/ not set/ }).click()
  await page.getByRole('option', { name: 'New place…' }).click()
  await main.getByRole('textbox', { name: 'The new place’s name' }).fill('The Pans')
  await main.getByRole('button', { name: 'Make it' }).click()
  await expect(main.getByRole('button', { name: /^Current Location The Pans/ })).toBeVisible()
  await expect.poll(() => places(page)).toEqual([['The Pans', null], ['The Quay', null]])
  await main.getByRole('button', { name: 'Save State' }).click()

  // Kept: opened again, that is where he is.
  await open()
  await expect(main.getByRole('button', { name: /^Current Location The Pans/ })).toBeVisible({ timeout: 15_000 })

  // A name the book already has, in another case: that place, not a second one.
  await main.getByRole('button', { name: /^Current Location The Pans/ }).click()
  await page.getByRole('option', { name: 'New place…' }).click()
  await main.getByRole('textbox', { name: 'The new place’s name' }).fill('the quay')
  await main.getByRole('button', { name: 'Make it' }).click()
  await expect(main.getByRole('button', { name: /^Current Location The Quay/ })).toBeVisible()
  expect(await places(page)).toEqual([['The Pans', null], ['The Quay', null]])
})
