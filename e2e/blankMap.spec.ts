import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A place in Kathala is a pin and a pin needs a map — locations may only be
 * added to maps and sub-maps that already exist. That rule is deliberate and
 * stays. What did not work was everything around it: a writer with no picture of
 * their world had two doors, an image upload whose button stays disabled until
 * you supply an image, and a button labelled AI. So a mapless world simply never
 * offered `+ Setting`, and never said why.
 *
 * This walks the whole loop, because either end alone proves nothing: the
 * setting really is withheld without a map, and really is offered after the
 * blank map exists.
 */

async function worldWithAScene(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Mapless')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'ch1', worldId: id, timelineId: 'tl', number: 1, title: 'The Letter', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'The wreck',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

/**
 * Name a place from inside the prose, and report which map it landed on.
 *
 * This, rather than the card's `+ Setting` chip: that one is gated on there
 * being a marker to pick, so it cannot answer the question. Naming a place in
 * the draft is where a writer meets the rule.
 *
 * **The rule used to be whether a place could be made at all.** A place was a
 * pin, so a world with no map could hold none, and this helper returned a
 * boolean. A place may now exist before it is drawn anywhere — so the question
 * is no longer *whether* but *where*, and a blank map is the difference
 * between "nowhere yet" and "on that one".
 */
async function namePlaceInProse(page: Page, worldId: string, name: string): Promise<string | null | undefined> {
  await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('button', { name: /^Expand/ }).first().click()
  await settle(page)
  await page.getByRole('textbox', { name: 'Scene prose' }).click()
  await page.keyboard.type(` @${name}`)
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: new RegExp(`${name}\\s+new place`) }).click()
  await expect.poll(async () => page.evaluate(async (n: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { locationMarkers: { toArray: () => Promise<Array<{ name: string }>> } }
    return (await db.locationMarkers.toArray()).some((m) => m.name === n)
  }, name), { timeout: 20_000 }).toBe(true)
  return page.evaluate(async (n: string) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      { locationMarkers: { toArray: () => Promise<Array<{ name: string; mapLayerId: string | null }>> } }
    return (await db.locationMarkers.toArray()).find((m) => m.name === n)?.mapLayerId
  }, name)
}

test.describe('a writer with no map image can still place a scene', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the blank map is a door, and a place waits at it until one opens', async ({ page }) => {
    const worldId = await worldWithAScene(page)

    // With no map, a place is still a place — it is simply on none.
    expect(await namePlaceInProse(page, worldId, 'Ferrow Crossing')).toBeNull()

    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await settle(page)
    // The empty state says why a map is worth having at all.
    await expect(page.getByText(/pins on a map/i)).toBeVisible()

    await page.getByRole('button', { name: 'Start a blank map' }).click()
    await expect.poll(async () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { mapLayers: { toArray: () => Promise<Array<{ name: string }>> } }
      return (await db.mapLayers.toArray()).length
    }), { timeout: 20_000 }).toBe(1)

    /*
      The pair: the same typing, in the same box, now lands the pin on that
      map. A place named after a map exists goes onto it rather than waiting —
      which is what makes the first half an assertion about the map's absence
      rather than about places never being placed.
    */
    expect(await namePlaceInProse(page, worldId, 'Wenlock Edge')).toEqual(expect.any(String))
  })
})
