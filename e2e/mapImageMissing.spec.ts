import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { settle } from './helpers/settle'

/**
 * A map whose picture is not in the store says so, instead of spinning.
 *
 * Worlds from the Library keep their images in a separate `.pwb` file. That
 * file now comes down with the book, so this state is reached by a world
 * downloaded before it did, or by an image fetch that failed — either way the
 * map layers carry an `imageId` pointing at blobs nobody has. Measured on the
 * shipped *Fellowship*: 16 layers, 0 of their images in the store, and the Maps
 * screen rendered an empty `main` forever.
 *
 * The cause is that `useBlobUrl` returns `undefined` for *loading* and for
 * *absent* alike, so the screen could not tell a slow map from a missing one
 * and picked the spinner. `useBlobUrlState` resolves a miss to `null`.
 *
 * Seeded rather than downloaded: the condition is "a layer names a blob that is
 * not there", which is one row, and driving a 15MB bundle to prove it would
 * test the network instead of the screen.
 */

async function worldWithBrokenMap(page: Page) {
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Middle Earth')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  await page.evaluate(async (id) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown> }>
    const now = Date.now()
    await db.mapLayers.add({
      id: 'ml1', worldId: id, parentMapId: null, name: 'Middle Earth',
      description: '', imageId: 'blob-that-never-arrived',
      imageWidth: 2048, imageHeight: 1536, createdAt: now, updatedAt: now,
    })
  }, worldId)

  await page.goto(`/#/worlds/${worldId}/maps`)
  await settle(page)
  return worldId
}

test.describe('A map layer whose image never arrived', () => {
  test.describe.configure({ timeout: 180_000 })

  test('says what is missing and why, rather than spinning, and keeps the rest of the map', async ({ page }) => {
    await worldWithBrokenMap(page)

    const note = page.getByRole('note', { name: "About this map's picture" })
    await expect(note).toContainText("This map's picture is not here")
    await expect(note).toContainText(/separate file/)
    // The way out is named, and it is the one that exists: there is no longer a
    // second Library button to press, so an instruction to include images would
    // send a reader looking for a control that is not there.
    await expect(note).toContainText(/Download the world again from the Library/)
    // And there is a way out that does not require going back to the Library.
    await expect(page.getByRole('button', { name: 'Add map image' })).toBeVisible()

    // The rest of the screen is still there (UX-3-1): the layers, by name, and the canvas…
    await expect(page.locator('[data-map-layer]', { hasText: 'Middle Earth' })).toBeVisible()
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    // …with no picture in it, so no broken-image mark in its corner (UX-3-25).
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(0)
  })

  test('a layer with no image at all keeps its own, different message', async ({ page }) => {
    // Paired with the test above: two states that used to be one, so neither
    // can pass by rendering the other.
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]

    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      await db.mapLayers.add({
        id: 'ml1', worldId: id, parentMapId: null, name: 'Unset',
        description: '', imageId: null,
        imageWidth: 0, imageHeight: 0, createdAt: now, updatedAt: now,
      })
    }, worldId)

    await page.goto(`/#/worlds/${worldId}/maps`)
    await settle(page)

    // No size to draw on, so the empty state is where the picture goes, and the layers stay beside it.
    await expect(page.getByText('This map needs a picture')).toBeVisible()
    await expect(page.getByText("This map's picture isn't here")).toHaveCount(0)
    await expect(page.locator('[data-map-layer]', { hasText: 'Unset' })).toBeVisible()
    // A root map is not called a sub-map.
    await expect(page.getByText(/sub-map/i)).toHaveCount(0)
  })

  test('a layer whose image is present still draws the map', async ({ page }) => {
    // The third state, so "says it is missing" cannot be reached by a screen
    // that has simply stopped rendering maps.
    const worldId = await worldWithBrokenMap(page)
    const note = page.getByRole('note', { name: "About this map's picture" })
    await expect(note).toBeVisible()

    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      // A 1x1 gif is an image as far as Leaflet is concerned.
      const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0))
      await db.blobs.add({
        id: 'blob-that-never-arrived', worldId: id, mimeType: 'image/gif',
        data: new Blob([bytes], { type: 'image/gif' }), createdAt: Date.now(),
      })
    }, worldId)

    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(1)
    await expect(note).toHaveCount(0)
  })

  test('a picture linked from the web that does not answer: the banner, the map drawn bare, no broken-image mark (UX-3-25)', async ({ page }) => {
    await page.route(/^https:\/\/maps\.example\.org\//, (route) => route.abort())
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Middle Earth')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().split('/worlds/')[1].split('/')[0]
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      // The record is here, and it points at the web: as every Library picture does.
      await db.blobs.add({ id: 'linked', worldId: id, mimeType: 'image/png', url: 'https://maps.example.org/middle-earth.png', createdAt: now })
      await db.mapLayers.add({
        id: 'ml1', worldId: id, parentMapId: null, name: 'Middle Earth',
        description: '', imageId: 'linked', imageWidth: 2048, imageHeight: 1536, createdAt: now, updatedAt: now,
      })
    }, worldId)
    await page.goto(`/#/worlds/${worldId}/maps`)
    await settle(page)
    await expect(page.getByRole('note', { name: "About this map's picture" })).toContainText('could not be loaded', { timeout: 30_000 })
    await expect(page.locator('.leaflet-container')).toBeVisible()
    // The address that failed is not handed to the canvas, so there is no image in it to break.
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(0)
  })

  test('a sub-map without its picture is not a trap: the root map is a click away (UX-3-1)', async ({ page }) => {
    const worldId = await worldWithBrokenMap(page)
    // The root map has its picture; the Shire, nested in it, does not.
    await page.evaluate(async (id) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        Record<string, { add: (v: unknown) => Promise<unknown> }>
      const now = Date.now()
      const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0))
      await db.blobs.add({
        id: 'blob-that-never-arrived', worldId: id, mimeType: 'image/gif',
        data: new Blob([bytes], { type: 'image/gif' }), createdAt: now,
      })
      await db.mapLayers.add({
        id: 'shire', worldId: id, parentMapId: 'ml1', name: 'Shire',
        description: '', imageId: 'shire-blob-never-arrived',
        imageWidth: 1024, imageHeight: 768, createdAt: now, updatedAt: now,
      })
    }, worldId)
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(1, { timeout: 30_000 })

    // Into the Shire, from the layers.
    const branch = page.getByRole('button', { name: 'Middle Earth’s maps' })
    if (await branch.getAttribute('aria-expanded') !== 'true') await branch.click()
    await page.locator('[data-map-layer]', { hasText: 'Shire' }).click()
    const note = page.getByRole('note', { name: "About this map's picture" })
    await expect(note).toContainText("This map's picture is not here")
    // It was the whole screen: no layers, no sections, no canvas.
    await expect(page.locator('.leaflet-container')).toBeVisible()
    const root = page.locator('[data-map-layer]', { hasText: 'Middle Earth' })
    await expect(root).toBeVisible()

    // And back out of it, to the root map and its picture.
    await root.click()
    await expect(root).toHaveAttribute('aria-current', 'true')
    await expect(note).toHaveCount(0)
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(1)
  })
})
