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

  test('says what is missing and why, rather than spinning', async ({ page }) => {
    await worldWithBrokenMap(page)

    await expect(page.getByText("This map's image isn't here")).toBeVisible()
    await expect(page.getByText(/separate file/)).toBeVisible()
    // The way out is named, and it is the one that exists: there is no longer a
    // second Library button to press, so an instruction to include images would
    // send a reader looking for a control that is not there.
    await expect(page.getByText(/Download the world again from the Library/)).toBeVisible()
    // The layer is still named, so the writer knows which map this is about.
    await expect(page.getByText('Image not downloaded')).toBeVisible()

    // And there is a way out that does not require going back to the Library.
    await expect(page.getByRole('button', { name: 'Add map image' })).toBeVisible()
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

    await expect(page.getByText('This map needs an image')).toBeVisible()
    await expect(page.getByText("This map's image isn't here")).toHaveCount(0)
  })

  test('a layer whose image is present still draws the map', async ({ page }) => {
    // The third state, so "says it is missing" cannot be reached by a screen
    // that has simply stopped rendering maps.
    const worldId = await worldWithBrokenMap(page)
    await expect(page.getByText("This map's image isn't here")).toBeVisible()

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
    await expect(page.getByText("This map's image isn't here")).toHaveCount(0)
  })
})
