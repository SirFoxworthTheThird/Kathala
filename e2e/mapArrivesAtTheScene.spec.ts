import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'
import { waitForMapReady } from './helpers/map'
import { downloadLibraryBook } from './helpers/library'

/**
 * Opening the map puts a reader where the story is.
 *
 * A reader moves through chapters as they read and then opens the map to see
 * where everyone is — and arrived on whichever layer the map was last left on,
 * which is the book's first root map. Every scene in all 41 shipped books
 * carries a location and every one of those books spreads them over more than
 * one layer, so that is the wrong map most of the time: in *Alice* the root is
 * *Wonderland* while chapter 2 happens in *The Rabbit-Hole and Long Hall*.
 *
 * Moving the cursor from the chapter bar already panned the map — `activateEvent`
 * dispatches `wb:map:focusMarker`. The gap was arriving afterwards: the cursor
 * had moved while the map was not mounted, so nothing was listening.
 */

/**
 * The breadcrumb entry for a named map, as the reader sees it.
 *
 * Exact text, because the world is called *Alice's Adventures in Wonderland*
 * and the root map is called *Wonderland*: a substring match on the banner
 * finds the book's title and reports it as the open map. The first version of
 * this did exactly that and failed claiming the map was the whole novel.
 */
const crumb = (page: Page, name: string) =>
  page.getByRole('banner').getByText(name, { exact: true })

/**
 * A chapter-2 scene, with the map layer its location sits on.
 *
 * Read out of the downloaded book rather than hard-coded: the Library is
 * regenerated, and an id pinned here would rot into a test that silently stops
 * reaching the sub-map it exists to check.
 */
async function sceneInTheSubMap(page: Page) {
  return page.evaluate(async () => {
    const db = (window as unknown as { __pwdb?: Record<string, {
      toArray: () => Promise<Record<string, string | number | null>[]>
    }> }).__pwdb!
    const [events, chapters, markers, layers] = await Promise.all([
      db.events.toArray(), db.chapters.toArray(), db.locationMarkers.toArray(), db.mapLayers.toArray(),
    ])
    const chapterNo = new Map(chapters.map((c) => [c.id as string, c.number as number]))
    const markerById = new Map(markers.map((m) => [m.id as string, m]))
    const layerName = new Map(layers.map((l) => [l.id as string, l.name as string]))
    const ordered = events
      .filter((e) => (chapterNo.get(e.chapterId as string) ?? 0) === 2)
      .sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number))
    for (const e of ordered) {
      const m = markerById.get(e.locationMarkerId as string)
      const name = m ? layerName.get(m.mapLayerId as string) : undefined
      if (name && name !== 'Wonderland') {
        return { eventId: e.id as string, layer: name, place: m!.name as string }
      }
    }
    return null
  })
}

/** Park the cursor on a scene, the way a reader who has read this far would. */
async function readAt(page: Page, eventId: string) {
  await page.evaluate((eid: string) => {
    const raw = localStorage.getItem('plotweave-ui')
    const st = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    st.state.activeEventId = eid
    if (st.state.eventByWorld) for (const k of Object.keys(st.state.eventByWorld)) st.state.eventByWorld[k] = eid
    localStorage.setItem('plotweave-ui', JSON.stringify(st))
  }, eventId)
  await page.reload({ waitUntil: 'load' })
  await settle(page)
  // Verified, not assumed: the store rehydrates on load and writes itself back,
  // so a value written into a running page is clobbered rather than kept.
  const landed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('plotweave-ui') ?? '{}').state?.activeEventId ?? null)
  expect(landed, 'the cursor was actually parked').toBe(eventId)
}

test.beforeEach(async ({ page }) => { await resetDB(page) })

test('a reader opening the map lands on the scene\'s own map', async ({ page }) => {
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)

  const scene = await sceneInTheSubMap(page)
  expect(scene, 'the book has a chapter-2 scene away from the root map').not.toBeNull()
  await readAt(page, scene!.eventId)

  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await waitForMapReady(page)

  await expect(crumb(page, scene!.layer), `the map opened at ${scene!.place}`)
    .toBeVisible({ timeout: 20_000 })
  await expect(crumb(page, 'Wonderland'), 'and not on the root map it would have defaulted to')
    .toHaveCount(0)
})

test('a writer opening the same map is left where they left it', async ({ page }) => {
  /*
    The other half, on the same book at the same cursor. A writer arranging
    markers has a reason for the layer the map is on, and moving it under them
    is the same rudeness in reverse — so the root map stays open, which is also
    the state the reader test would be satisfied by if the focus never ran.
  */
  const worldId = await downloadLibraryBook(page, 'Alice’s Adventures in Wonderland')
  await settle(page)

  const scene = await sceneInTheSubMap(page)
  expect(scene).not.toBeNull()
  await readAt(page, scene!.eventId)

  await page.evaluate(async (id) => {
    const db = (window as unknown as { __pwdb?: {
      worlds: { update: (id: string, changes: Record<string, unknown>) => Promise<number> }
    } }).__pwdb
    await db!.worlds.update(id, { readingMode: false })
  }, worldId)
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await waitForMapReady(page)

  await expect(crumb(page, 'Wonderland'), 'the root map, untouched').toBeVisible({ timeout: 20_000 })
  await expect(crumb(page, scene!.layer), 'and not carried off to the scene').toHaveCount(0)
})
