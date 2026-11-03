import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * The scene panel's two selects (writer run 11, W-9). Each was named by its
 * value alone — `button "Isotta Ferro"` — with "Point of View" a span beside
 * it, so a screen reader heard a name with no hint that it was the POV. They
 * are named by their label and their value now, as `Field` names a select.
 */

async function book(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Slack Water')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)
  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'The Causeway', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'studio', worldId: id, mapLayerId: null, name: 'The Studio', description: '', type: 'landmark', x: 0, y: 0, factionId: null, linkedMapLayerId: null, iconType: 'building', color: null, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'nell', worldId: id, name: 'Nell Garrity', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'e1', worldId: id, chapterId: 'c1', timelineId: 'tl', title: 'Arrival', description: '', sortOrder: 1,
      tags: [], locationMarkerId: 'studio', involvedCharacterIds: ['nell'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
      povCharacterId: 'nell', tension: null, isFlashback: false, createdAt: now, updatedAt: now,
    })
    await db.sceneTexts.add({ id: 't1', worldId: id, eventId: 'e1', text: 'The road ran out at the shore.', wordCount: 7, updatedAt: now })
  }, worldId)
  return worldId
}

test('the scene panel names its Setting and Point of View selects by label and value', async ({ page }) => {
  test.setTimeout(120_000)
  const worldId = await book(page)
  await page.goto(`/#/worlds/${worldId}/manuscript/c1`, { waitUntil: 'load' })
  await settle(page)
  await page.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Page', exact: true }).click()
  await page.locator('.cm-line', { hasText: 'The road ran out at the shore.' }).first().click({ timeout: 20_000 })
  const scene = page.getByRole('region', { name: 'This scene' })

  await expect(scene.getByRole('button', { name: 'Setting The Studio', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(scene.getByRole('button', { name: 'Point of View Nell Garrity', exact: true })).toBeVisible()
  // Named by the value alone, as they were, they are not.
  await expect(scene.getByRole('button', { name: 'The Studio', exact: true })).toHaveCount(0)
  await expect(scene.getByRole('button', { name: 'Nell Garrity', exact: true })).toHaveCount(0)
  // And the name follows the value.
  await scene.getByRole('button', { name: 'Point of View Nell Garrity', exact: true }).click()
  await page.getByRole('option', { name: 'No POV character' }).click()
  await expect(scene.getByRole('button', { name: 'Point of View No POV character', exact: true })).toBeVisible()
})
