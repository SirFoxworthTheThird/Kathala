import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The scene card's fields are an edit buffer seeded once at mount, but the
 * scene's setting is not only set from this card: typing `@somewhere` in the
 * draft and choosing "new place" creates the marker and writes
 * `locationMarkerId` straight to the database, from a child component.
 *
 * The card never heard. It went on offering `+ Setting` and showing no setting
 * for a place the writer had just made, until a reload — and the obvious
 * conclusion from that is that it did not work, so they make the place again.
 *
 * The write is simulated here rather than driven through the mention dropdown,
 * so the test is about the card following the record and not about where a
 * popup lands.
 */

async function chapterWithScene(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Marrow')
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
    await db.mapLayers.add({ id: 'map1', worldId: id, name: 'The Salt Road', parentMapId: null, imageBlobId: null, width: 1000, height: 1000, createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk1', worldId: id, mapLayerId: 'map1', name: 'Marrow House', x: 10, y: 10, linkedMapLayerId: null, createdAt: now, updatedAt: now })
    await db.events.add({
      id: 'ev1', worldId: id, chapterId: 'ch1', timelineId: 'tl', title: 'Twelve Marrow Lane',
      description: '', sortOrder: 0, tags: [], locationMarkerId: null,
      involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    })
  }, worldId)
  return worldId
}

test.describe('the scene card follows the record', () => {
  test.describe.configure({ timeout: 180_000 })

  test('shows a setting written from elsewhere, without a reload', async ({ page }) => {
    const worldId = await chapterWithScene(page)
    await page.goto(`/#/worlds/${worldId}/timeline/ch1`, { waitUntil: 'load' })
    await settle(page)

    await page.getByRole('button', { name: /^Expand/ }).first().click()
    await settle(page)

    const main = page.getByRole('main')
    // Absence first: nothing is set, so the card offers to set it.
    await expect(main.getByRole('button', { name: '+ Setting' })).toBeVisible()

    // What the draft's `@place` handler does, from outside this card.
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { events: { update: (id: string, changes: object) => Promise<unknown> } }
      await db.events.update('ev1', { locationMarkerId: 'mk1' })
    })
    await page.waitForTimeout(1200)

    /*
      Presence, with no reload between: the card now shows the place, and no
      longer offers to add one.

      By role, not by text: the expanded card also renders a Setting picker
      whose list carries an option of the same name, and a bare
      `getByText('Marrow House')` matches both.
    */
    await expect(main.getByRole('button', { name: 'Marrow House' })).toBeVisible()
    await expect(main.getByRole('button', { name: '+ Setting' })).toHaveCount(0)
  })
})
