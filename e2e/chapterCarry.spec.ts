import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { dismissFirstRunGuide } from './helpers/nav'
import { settle } from './helpers/settle'

/**
 * Part C: the chapter panel reads everybody's last known state once for the
 * chapter, rather than once per scene row — and each row still gets its own
 * scene's. Priya is placed at the chapter's second scene and is in the cast of
 * the first and the third: the third has her there from an earlier scene, the
 * first has nothing for her yet. A row read at the wrong scene of the chapter
 * gets one of the two wrong.
 */

test('each scene in a chapter has the cast as last known by that scene', async ({ page }) => {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Carried')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.locationMarkers.add({ id: 'exchange', worldId: id, mapLayerId: null, name: 'The Tithe Exchange', description: '', iconType: 'building', x: 0, y: 0, factionId: null, linkedMapLayerId: null, color: null, createdAt: now, updatedAt: now })
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.chapters.add({ id: 'c1', worldId: id, timelineId: 'tl', number: 1, title: 'Restricted', synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
    for (const [n, title] of [[1, 'Corn Street'], [2, 'The Counter'], [3, 'The Vault']] as const) {
      await db.events.add({
        id: `e${n}`, worldId: id, chapterId: 'c1', timelineId: 'tl', title, description: '', sortOrder: n,
        tags: [], locationMarkerId: null, involvedCharacterIds: n === 2 ? [] : ['priya'], mentionedCharacterIds: [], involvedItemIds: [],
        threadIds: [], motifIds: [], travelDays: null, inWorldTime: null, structureBeat: null, status: 'draft',
        povCharacterId: null, tension: null, isFlashback: false, createdAt: now, updatedAt: now,
      })
    }
    await db.characters.add({ id: 'priya', worldId: id, name: 'Priya Lal', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.characterSnapshots.add({
      id: 's2', worldId: id, characterId: 'priya', eventId: 'e2', sortKey: 1.000002, isAlive: true, currentLocationMarkerId: 'exchange', currentMapLayerId: null,
      inventoryNotes: '', statusNotes: '', travelModeId: null, createdAt: now, updatedAt: now,
    })
  }, worldId)

  await page.goto(`/#/worlds/${worldId}/manuscript/c1?view=cards`, { waitUntil: 'load' })
  await settle(page)
  // After the scene that places her: there, from an earlier scene.
  await expect(page.locator('[data-scene-section="e3"]').getByRole('button', { name: /^Priya Lal at The Tithe Exchange, from an earlier scene/ })).toBeVisible({ timeout: 20_000 })
  // Before it: nothing yet.
  await expect(page.locator('[data-scene-section="e1"]').getByRole('button', { name: /^Priya Lal no state recorded/ })).toBeVisible()
})
