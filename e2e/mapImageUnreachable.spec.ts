import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { downloadLibraryBook } from './helpers/library'

/**
 * F-7: a map with no picture was indistinguishable from one being withheld or
 * one that failed to load.
 *
 * The Maps screen already told two states apart — a layer with no picture, and
 * one naming a blob that is not in the store. It could not see a third: a blob
 * record that **is** present and holds a `url`. Every image in the Library is
 * stored that way, so on a train the record resolves, the screen draws its
 * whole frame — sidebar, markers, zoom controls — and the canvas behind it is
 * blank with nothing said.
 *
 * Reproduced before it was fixed, on *The Woman in White* with every remote
 * host refused: the `<img>` reported `complete: true, naturalWidth: 0`, the
 * classic dead-link signature, and the screen text mentioned nothing about it.
 *
 * The remote host is **intercepted rather than relied on** in both directions
 * here, so neither half of this spec depends on the sandbox having a network.
 */

/** A 1×1 PNG — enough for `naturalWidth > 0`. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const REMOTE = /^https?:\/\/(?!localhost|127\.0\.0\.1)/

async function libraryMapWithRemote(page: Page, mode: 'refused' | 'served') {
  await page.goto('/')
  await resetDB(page)
  await downloadLibraryBook(page, 'The Woman in White')
  await page.waitForTimeout(2000)
  const worldId = new URL(page.url()).hash.split('/')[2]
  await page.route(REMOTE, (route) =>
    mode === 'refused'
      ? route.abort()
      : route.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.waitForTimeout(5000)
}

async function stopReading(page: Page) {
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as {
      worlds: {
        toArray: () => Promise<Array<{ id: string }>>
        update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
      }
    }
    const w = (await db.worlds.toArray())[0]
    await db.worlds.update(w.id, { readingMode: false })
  })
}

const UNREACHABLE = /This map's picture could not be loaded/

test.describe('A map whose picture lives on the web', () => {
  test.describe.configure({ timeout: 300_000 })

  test('says so when the address does not answer', async ({ page }) => {
    await libraryMapWithRemote(page, 'refused')

    await expect(page.getByText(UNREACHABLE)).toBeVisible()

    /*
      The claim the banner makes has to be true, or it is a worse lie than
      silence: *everything marked on the map is still here.* Two attempts got
      that wrong. Replacing the whole screen took the sidebar away — seven
      reading-mode specs failed, every one opening a character from a sidebar
      that was gone. Replacing only the canvas took the markers, routes and
      regions, which Leaflet draws in pixel space with or without a picture
      behind them.

      So both are checked: the sidebar sections, and the canvas itself.
    */
    await expect(page.locator('.leaflet-container')).toBeVisible()
    // Reached through `main`, because the nav rail carries "Characters",
    // "Locations" and "Maps" too. The section headers read as upper case only
    // through CSS; their accessible names are title case, and each carries its
    // count.
    const panels = page.getByRole('main')
    await expect(panels.getByRole('button', { name: /^Map Layers \d/ })).toBeVisible()
    await expect(panels.getByRole('button', { name: /^Characters \d/ })).toBeVisible()
    await expect(panels.getByRole('button', { name: /^Locations \d/ })).toBeVisible()
    // And the layers themselves are still listed, which is half the claim.
    await expect(panels.getByRole('button', { name: 'London and Its Environs, 1855' })).toBeVisible()
  })

  /**
   * The presence half. Every assertion above is satisfied by a screen that
   * shows this message for *every* map, which would be a worse bug than the
   * one being fixed — so the same book, with the same host serving a real
   * image, must draw the map instead.
   */
  test('and draws the map when it does answer', async ({ page }) => {
    await libraryMapWithRemote(page, 'served')

    await expect(page.getByText(UNREACHABLE)).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const img = document.querySelector('.leaflet-image-layer') as HTMLImageElement | null
      return img ? img.naturalWidth : 0
    }), { timeout: 20_000 }).toBeGreaterThan(0)
  })

  /**
   * A reader is told what happened and offered nothing to do about it, because
   * supplying a picture is an author's action. A writer is offered it — which
   * is what stops the absence above passing on a screen that lost the control
   * for everybody.
   */
  test('offers a picture to a writer and not to a reader', async ({ page }) => {
    await libraryMapWithRemote(page, 'refused')
    await expect(page.getByText(UNREACHABLE)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add map image' })).toHaveCount(0)

    await stopReading(page)
    await page.reload({ waitUntil: 'load' })
    await page.waitForTimeout(5000)

    await expect(page.getByText(UNREACHABLE)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add map image' })).toBeVisible()
  })
})
