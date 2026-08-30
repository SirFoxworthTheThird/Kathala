import { test, expect } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MT-6: sync points were read in exactly one place — the playback timer — and
 * only when it advanced onto a paired event. A writer who paired nine moments
 * and then scrubbed between them by hand saw no effect at all. The effect they
 * should see is the frame story's cast drawn as **ghost pins** beside the inner
 * story's, so that is what this checks, from scrubbing alone.
 *
 * This test could not be written when MT-6 shipped. A purpose-built frame
 * narrative produced no ghost pins at all, and the reason turned out to be
 * **X-17**: snapshot resolution compared a stored `sortKey` against a computed
 * cursor position, so a seeded snapshot on any other scale was ruled out as
 * "after the cursor". With both sides computed the fixture resolves, and this
 * doubles as the end-to-end evidence for that fix.
 *
 * The ordering logic is unit-tested in `src/lib/__tests__/syncPoints.test.ts`.
 */
test.describe('Sync points follow the cursor, not only the timer', () => {
  test.describe.configure({ timeout: 180_000 })

  test('scrubbing the tale onto a paired moment brings the frame moment with it', async ({ page }) => {
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Frame Scrub')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /maps/i }).first().click()
    await page.mouse.move(900, 500)
    await page.getByRole('button', { name: 'Upload Map' }).first().click()
    await page.locator('form input[type="file"][accept="image/*"]').setInputFiles(MAIN_MAP)
    await page.getByLabel('Map Name').clear()
    await page.getByLabel('Map Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await settle(page)

    const seeded = await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, {
        toArray: () => Promise<{ id: string; worldId?: string }[]>
        add: (v: unknown) => Promise<unknown>
      }>
      if (!db) return false
      const [layer] = await db.mapLayers.toArray()
      const worldId = layer.worldId!
      const now = Date.now()

      await db.locationMarkers.add({
        id: 'mk-bag-end', worldId, mapLayerId: layer.id, linkedMapLayerId: null,
        name: 'Bag End', x: 300, y: 300, iconType: 'city', tags: [],
        factionId: null, imageId: null, createdAt: now, updatedAt: now,
      })
      await db.characters.add({
        id: 'ch-bilbo', worldId, name: 'Old Bilbo', description: '', isAlive: true,
        tags: [], portraitImageId: null, createdAt: now, updatedAt: now,
      })

      await db.timelines.add({ id: 'tl-outer', worldId, name: 'The Attic', description: '', color: '#f59e0b', createdAt: now })
      await db.timelines.add({ id: 'tl-inner', worldId, name: 'The Tale', description: '', color: '#60a5fa', createdAt: now })

      const build = async (timelineId: string, prefix: string, title: string, n: number, number: number) => {
        await db.chapters.add({
          id: `${prefix}-ch`, worldId, timelineId, number, title,
          synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
        })
        for (let j = 0; j < n; j++) {
          await db.events.add({
            id: `${prefix}-e${j}`, worldId, chapterId: `${prefix}-ch`, timelineId,
            title: `${title} ${j + 1}`, description: '', locationMarkerId: null,
            involvedCharacterIds: [], mentionedCharacterIds: [], involvedItemIds: [],
            tags: [], sortOrder: j, travelDays: null, inWorldTime: null, tension: null,
            structureBeat: null, threadIds: [], status: 'idea', povCharacterId: null,
            isFlashback: false, createdAt: now, updatedAt: now,
          })
        }
      }
      await build('tl-outer', 'o', 'Attic', 2, 10)
      await build('tl-inner', 'i', 'Tale', 3, 1)

      // Bilbo is at Bag End at the second moment of the frame story, which is
      // the one paired with the second moment of the tale. No `sortKey`: the
      // resolver computes positions, and inventing one is what sent the first
      // attempt at this test astray (X-17).
      await db.characterSnapshots.add({
        id: 'sn-bilbo', worldId, characterId: 'ch-bilbo', eventId: 'o-e1',
        isAlive: true, currentLocationMarkerId: 'mk-bag-end', currentMapLayerId: layer.id,
        inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
        createdAt: now, updatedAt: now,
      })
      await db.timelineRelationships.add({
        id: 'rel-frame', worldId,
        sourceTimelineId: 'tl-outer', targetTimelineId: 'tl-inner',
        type: 'frame_narrative', anchors: [],
        syncPoints: [{ outerEventId: 'o-e1', innerEventId: 'i-e1', label: '' }],
        createdAt: now, updatedAt: now,
      })
      return true
    })
    expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)

    await page.reload({ waitUntil: 'load' })
    await settle(page)
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })

    const bar = page.locator('[data-chapter-bar]')
    await expect(bar).toBeVisible({ timeout: 15_000 })

    // Make the tale the active track — the frame is active by default. It has
    // to be the track itself: a tick calls `stopPropagation` so that choosing a
    // moment does not also switch tracks, which means clicking one never
    // activates the track it is on.
    await bar.getByText('The Tale', { exact: true }).click()
    await page.waitForTimeout(1200)
    await bar.getByTitle('Tale 1').click()
    await page.waitForTimeout(1200)

    // The ghost pin carries the frame moment in its tooltip, which is the
    // direct read of what the sync point set.
    const ghost = page.locator('.leaflet-marker-icon', { hasText: 'Old Bilbo' })
    await expect(ghost).toHaveCount(1, { timeout: 20_000 })

    const frameMoment = async () => {
      // Move away first: the pin is rebuilt when the frame moment changes, and
      // hovering a marker the pointer is already over does not re-fire, so the
      // tooltip on screen would still be the one bound before the change.
      await page.mouse.move(5, 5)
      await page.waitForTimeout(250)
      await ghost.hover()
      await page.waitForTimeout(450)
      return (await page.locator('.leaflet-tooltip').allInnerTexts()).join(' | ')
    }

    // Before the first pairing there is no frame moment in force...
    const before = await frameMoment()
    expect(before, `tooltip before any pairing: ${JSON.stringify(before)}`).toContain('Old Bilbo')
    expect(before).not.toContain('Attic 2')

    // ...scrubbing — not playing — onto the paired moment brings it in. This is
    // the whole finding.
    await bar.getByTitle(/^Tale 2/).click()
    await expect.poll(frameMoment, { timeout: 20_000 }).toContain('Attic 2')

    // It holds past the pairing rather than flickering off on the next
    // unpaired scene.
    await bar.getByTitle('Tale 3').click()
    await page.waitForTimeout(1200)
    expect(await frameMoment()).toContain('Attic 2')

    // And lets go before it, so the cursor is driving this rather than latching
    // once and staying.
    await bar.getByTitle('Tale 1').click()
    await expect.poll(frameMoment, { timeout: 20_000 }).not.toContain('Attic 2')
  })
})
