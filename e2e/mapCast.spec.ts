import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * MW-3 and MAP-3 — what the map sidebar says about who is on stage.
 *
 * MW-3: the list put every character at equal weight while only a handful
 * carried a location, so the question the screen exists to answer was a
 * minority of the rows and looked like all the others. The ordering itself is
 * unit-tested in `src/lib/__tests__/mapCast.test.ts`; this drives the sidebar.
 *
 * MAP-3: the sidebar said *"Select a scene from the timeline bar below to
 * place characters onto the map"* while listing characters with their places
 * beneath them. That was real — with no cursor, snapshot resolution falls back
 * to each character's most recently updated snapshot, so the location line had
 * something to show — and it was fixed by the SB-3 change, which gated that
 * line on there being a cursor at all. The second test keeps the two apart.
 */

const CAST = ['Aragorn', 'Boromir', 'Celeborn', 'Denethor']

async function mapWithCast(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Middle Earth')
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

  const seeded = await page.evaluate(async (names) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<
      string,
      {
        toArray: () => Promise<Record<string, string | number>[]>
        add: (v: unknown) => Promise<unknown>
        bulkAdd: (v: unknown[]) => Promise<unknown>
      }
    >
    const layer = (await db.mapLayers.toArray())[0]
    const worldId = layer.worldId as string
    const now = Date.now()
    await db.characters.bulkAdd(names.map((name, i) => ({
      id: `chr-${i}`, worldId, name,
      role: '', description: '', tags: [], portraitImageId: null, createdAt: now, updatedAt: now,
    })))
    await db.locationMarkers.add({
      id: 'loc-riv', worldId, mapLayerId: layer.id, name: 'Rivendell',
      description: '', type: 'landmark',
      x: Number(layer.imageWidth) * 0.3, y: Number(layer.imageHeight) * 0.3,
      factionId: null, linkedMapLayerId: null, iconType: 'city', color: null,
      createdAt: now, updatedAt: now,
    })
    let tl = (await db.timelines.toArray())[0]
    if (!tl) {
      await db.timelines.add({ id: 'tl-1', worldId, name: 'Main', description: '', color: '#60a5fa', createdAt: now })
      tl = { id: 'tl-1' }
    }
    await db.chapters.add({
      id: 'ch-1', worldId, timelineId: tl.id, number: 1, title: 'Landfall',
      synopsis: '', notes: '', wordGoal: null, createdAt: now, updatedAt: now,
    })
    await db.events.add({
      id: 'ev-1', worldId, chapterId: 'ch-1', timelineId: tl.id, title: 'The wreck',
      description: '', locationMarkerId: null, involvedCharacterIds: [],
      mentionedCharacterIds: [], involvedItemIds: [], tags: [], sortOrder: 0,
      travelDays: null, inWorldTime: null, tension: null, structureBeat: null,
      threadIds: [], status: 'idea', povCharacterId: null, isFlashback: false,
      createdAt: now, updatedAt: now,
    })
    // Boromir alone stands somewhere, and he sorts second of four — so "placed
    // first" cannot be satisfied by leaving the list in its original order.
    await db.characterSnapshots.add({
      id: 'snap-1', worldId, characterId: 'chr-1', eventId: 'ev-1',
      isAlive: true, currentLocationMarkerId: 'loc-riv', currentMapLayerId: layer.id,
      inventoryItemIds: [], inventoryNotes: '', statusNotes: '', travelModeId: null,
      createdAt: now, updatedAt: now,
    })
    return true
  }, CAST)
  expect(seeded, 'the seeding seam should be present in an e2e build').toBe(true)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
}

/** The Characters section body, which is where both findings live. */
const castBody = (page: Page) => page.locator('[data-sidebar-section-body="Characters"]')

async function setCursor(page: Page) {
  await page.getByRole('link', { name: /timeline/i }).first().click()
  await settle(page)
  await page.getByTitle('Open chapter detail').first().click()
  await page.waitForTimeout(1000)
  await page.getByRole('link', { name: /maps/i }).first().click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
  await settle(page)
}

test.describe('The map sidebar says who is on stage', () => {
  test.describe.configure({ timeout: 180_000 })

  test('MW-3: the placed characters are their own group, above the rest', async ({ page }) => {
    await mapWithCast(page)
    await setCursor(page)

    const body = castBody(page)
    await expect(body.getByText('On the map (1)')).toBeVisible({ timeout: 20_000 })
    await expect(body.getByText('Not placed (3)')).toBeVisible()

    // The order on screen: the heading, the one placed character, then the
    // other heading. Boromir sorts second alphabetically, so this cannot pass
    // on a list that was simply left alone.
    //
    // Read as leaf text in document order rather than as `p` elements. The
    // name was a `<p>` until the row became a `<button>` under SB-4 — a `p`
    // cannot live inside a button — and this assertion silently found nothing
    // and reported `-1`, which is the failure mode a tag-specific selector has.
    const order = await body.evaluate((el) =>
      Array.from(el.querySelectorAll('p, span'))
        .filter((n) => n.children.length === 0)
        .map((n) => (n.textContent ?? '').trim())
        .filter((t) => t.length > 0),
    )
    const placedHeading = order.indexOf('On the map (1)')
    const boromir = order.indexOf('Boromir')
    const notPlaced = order.indexOf('Not placed (3)')
    const aragorn = order.indexOf('Aragorn')
    expect(placedHeading).toBeGreaterThanOrEqual(0)
    expect(boromir).toBeGreaterThan(placedHeading)
    expect(boromir).toBeLessThan(notPlaced)
    expect(aragorn).toBeGreaterThan(notPlaced)

    // Everyone is still listed — grouping is not filtering.
    for (const name of CAST) await expect(body.getByText(name, { exact: true })).toBeVisible()
  })

  test('MW-3: one group is no group — a cast with nobody placed stays one list', async ({ page }) => {
    await mapWithCast(page)
    await page.evaluate(async () => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as {
        characterSnapshots: { clear: () => Promise<void> }
      }
      await db.characterSnapshots.clear()
    })
    await setCursor(page)

    const body = castBody(page)
    await expect(body.getByText('Aragorn', { exact: true })).toBeVisible({ timeout: 20_000 })
    // A heading over the whole list says nothing, so there is none.
    await expect(body.getByText(/^On the map \(/)).toHaveCount(0)
    await expect(body.getByText(/^Not placed \(/)).toHaveCount(0)
  })

  test('MAP-3: the placement prompt and a placement never appear together', async ({ page }) => {
    await mapWithCast(page)
    // No cursor: the prompt is shown, and no row claims a location. Before the
    // SB-3 change the row printed one anyway, because snapshot resolution falls
    // back to the latest snapshot when there is no event to resolve against.
    const body = castBody(page)
    await expect(body.getByText(/Select a scene from the timeline bar below/))
      .toBeVisible({ timeout: 20_000 })
    await expect(body.getByText('Rivendell')).toHaveCount(0)

    // With a cursor: the placement is shown, and the prompt is gone. Neither
    // half can be satisfied by a sidebar that renders nothing at all.
    await setCursor(page)
    await expect(body.getByText('Rivendell')).toBeVisible({ timeout: 20_000 })
    await expect(body.getByText(/Select a scene from the timeline bar below/)).toHaveCount(0)
  })
})
