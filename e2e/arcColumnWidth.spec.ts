import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { dismissFirstRunGuide } from './helpers/nav'

/**
 * The Arc grid's column width was a constant applied as both `minWidth` and
 * `maxWidth`, so columns never took space that was going spare. Measured on a
 * three-chapter world at 1440px: a 512px table inside a 1440px main, every
 * location string clipped — "Hallowmere Lock" needing 85px in a 79px box — and
 * 928px of empty screen beside it.
 *
 * The constant is right for a 117-chapter book, which has to scroll. It was
 * applied unconditionally, which was the finding, so it is a floor now.
 */

const PLACE = 'Hallowmere Lock'

async function threeChapterWorld(page: Page): Promise<string> {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Arc')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await dismissFirstRunGuide(page)

  await page.evaluate(async ([id, place]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.timelines.add({ id: 'tl', worldId: id, name: 'Main', description: '', color: '#6366f1', dayOffset: 0, createdAt: now, updatedAt: now })
    await db.characters.add({ id: 'mira', worldId: id, name: 'Mira Vasse', description: '', aliases: [], tags: [], portraitImageId: null, isAlive: true, color: null, createdAt: now, updatedAt: now })
    await db.mapLayers.add({ id: 'map1', worldId: id, name: 'Road', parentMapId: null, imageId: null, imageWidth: 1000, imageHeight: 1000, scalePixelsPerUnit: null, scaleUnit: null, levelGroupId: null, levelIndex: 0, levelLabel: '', description: '', createdAt: now, updatedAt: now })
    await db.locationMarkers.add({ id: 'mk1', worldId: id, mapLayerId: 'map1', name: place, description: '', x: 1, y: 1, linkedMapLayerId: null, imageId: null, iconType: 'landmark', tags: [], factionId: null, createdAt: now, updatedAt: now })

    const base = {
      worldId: id, timelineId: 'tl', description: '', tags: [], locationMarkerId: null,
      involvedCharacterIds: ['mira'], mentionedCharacterIds: [], involvedItemIds: [],
      threadIds: [], motifIds: [], travelDays: null, inWorldTime: null,
      structureBeat: null, status: 'draft', povCharacterId: null, tension: null,
      isFlashback: false, createdAt: now, updatedAt: now,
    }
    for (const n of [1, 2, 3]) {
      await db.chapters.add({ id: `ch${n}`, worldId: id, timelineId: 'tl', number: n, title: `Chapter ${n}`, synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now })
      await db.events.add({ ...base, id: `ev${n}`, chapterId: `ch${n}`, title: `Scene ${n}`, sortOrder: 0 })
      await db.characterSnapshots.add({
        id: `s${n}`, worldId: id, characterId: 'mira', eventId: `ev${n}`, isAlive: true,
        currentLocationMarkerId: 'mk1', currentMapLayerId: 'map1', inventoryItemIds: [],
        inventoryNotes: '', statusNotes: '', travelModeId: null, sortKey: n,
        createdAt: now, updatedAt: now,
      })
    }
  }, [worldId, PLACE])
  return worldId
}

test.describe('the Arc grid uses the room it has', () => {
  test.describe.configure({ timeout: 240_000 })

  test('does not clip a place name while the screen sits empty', async ({ page }) => {
    // The width the finding was measured at.
    await page.setViewportSize({ width: 1440, height: 900 })
    const worldId = await threeChapterWorld(page)
    await page.goto(`/#/worlds/${worldId}/arc`, { waitUntil: 'load' })
    await settle(page)

    const cell = page.getByRole('main').getByText(PLACE).first()
    await expect(cell).toBeVisible({ timeout: 20_000 })

    const { scrollWidth, clientWidth } = await cell.evaluate((el) => ({
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    }))
    expect(scrollWidth, `"${PLACE}" clipped: ${scrollWidth}px of text in a ${clientWidth}px box`)
      .toBeLessThanOrEqual(clientWidth + 1)
  })
})
