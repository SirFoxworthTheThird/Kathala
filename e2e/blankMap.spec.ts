import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * A place in PlotWeave is a pin and a pin needs a map — locations may only be
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
  await page.goto('/')
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
 * Can a place be made from inside the prose?
 *
 * This, rather than the card's `+ Setting` chip: that one is gated on there
 * being a marker to pick, so a map alone does not bring it back. Naming a place
 * in the draft is the thing a map makes possible, and it is where a writer meets
 * the rule.
 */
async function canNamePlaceInProse(page: Page, worldId: string): Promise<boolean> {
  await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
  await page.waitForTimeout(1400)
  await page.getByRole('button', { name: /^Expand/ }).first().click()
  await page.waitForTimeout(700)
  await page.getByRole('textbox', { name: 'Scene prose' }).click()
  await page.keyboard.type(' @Ferrow Crossing')
  await page.waitForTimeout(600)
  const offered = (await page.getByRole('button', { name: /new place/ }).count()) > 0
  await page.keyboard.press('Escape')
  return offered
}

test.describe('a writer with no map image can still place a scene', () => {
  test.describe.configure({ timeout: 240_000 })

  test('the blank map is a door, and it opens the setting', async ({ page }) => {
    const worldId = await worldWithAScene(page)

    // Absence: no map, so no place can be named — the rule, working.
    expect(await canNamePlaceInProse(page, worldId)).toBe(false)

    await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
    await page.waitForTimeout(1200)
    // The empty state says why a map is needed at all, which is what was missing.
    await expect(page.getByText(/pins on a map/i)).toBeVisible()

    await page.getByRole('button', { name: 'Start a blank map' }).click()
    await expect.poll(async () => page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { mapLayers: { toArray: () => Promise<Array<{ name: string }>> } }
      return (await db.mapLayers.toArray()).length
    }), { timeout: 20_000 }).toBe(1)

    // Presence: the same box now offers it, from the same typing.
    expect(await canNamePlaceInProse(page, worldId)).toBe(true)
  })
})
