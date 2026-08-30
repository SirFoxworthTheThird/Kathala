import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import path from 'path'
import { fileURLToPath } from 'url'
import { settle } from './helpers/settle'

const MAIN_MAP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'map_example/main_map.jpg')

/**
 * SB-6, the last row in the map sidebar that was not a control.
 *
 * **SB-4** made the character, item, route and region rows real buttons and
 * left this one open on purpose, because the obvious fix breaks the feature:
 * a Map Layers row's whole activation is a pointer gesture — `pointerup`
 * without movement selects the layer, `pointerup` after movement re-parents it
 * — and the row's `onPointerDown` bails on any press that starts inside a
 * `button`, so wrapping the name in one would have meant a drag could only
 * start from the padding.
 *
 * The name is the activator and the drag stays on the row around it; the bail
 * excludes the activator by name. Both halves are driven here, because either
 * one alone can be had by breaking the other: `e2e/mapLayerDrag.spec.ts` presses
 * at the centre of the row, which is over the name.
 */

async function twoLayers(page: Page) {
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
  await page.getByLabel('Map Name').fill('Eriador')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await settle(page)

  // A second root layer, so selecting one is a visible change rather than a
  // no-op on the only map there is.
  await page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as
      Record<string, { add: (v: unknown) => Promise<unknown>; toArray: () => Promise<Record<string, unknown>[]> }>
    const [first] = await db.mapLayers.toArray()
    await db.mapLayers.add({
      ...first, id: 'ml2', name: 'Rhovanion', parentMapId: null,
      createdAt: Date.now(), updatedAt: Date.now(),
    })
  })
  await page.reload()
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 60_000 })
  await settle(page)

  // *Which* of the two the app opens on load is not this spec's business, and
  // it is not stable: with no active layer `MapExplorerView` takes
  // `rootLayers[0]`, and `useRootMapLayers` gets its order from Dexie, which
  // means the generated primary key of the uploaded layer decides it. Read the
  // answer instead of assuming one, and drive the *other* layer — every test
  // here is about a layer that is not currently open, so the pair is all it
  // needs. Asserting 'Eriador' here cost a flake before this returned a pair.
  const open = await pollOpen(page)
  return { open, other: open === 'Eriador' ? 'Rhovanion' : 'Eriador' }
}

/**
 * Which layer is open, read from the breadcrumb — the answer the writer sees.
 * `activeMapLayerId` is not persisted, so localStorage says nothing about it.
 *
 * Both names are checked and joined rather than returning the first hit, so a
 * breadcrumb showing both would read as `Eriador+Rhovanion` and fail an
 * assertion instead of quietly resolving to whichever was looked for first.
 */
const openLayer = async (page: Page) => {
  const banner = page.getByRole('banner')
  const found: string[] = []
  for (const name of ['Eriador', 'Rhovanion']) {
    if (await banner.getByText(name, { exact: true }).count()) found.push(name)
  }
  return found.join('+') || null
}

/** `openLayer`, once it settles. */
async function pollOpen(page: Page): Promise<string> {
  let last: string | null = null
  await expect
    .poll(async () => (last = await openLayer(page)))
    .toMatch(/^(Eriador|Rhovanion)$/)
  return last!
}

/** Give a control focus from the keyboard alone, never clicking it. */
async function tabTo(page: Page, name: string, limit = 90): Promise<boolean> {
  const target = page.getByRole('button', { name, exact: true })
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return true
  }
  return false
}

test.describe('A map layer can be opened from the keyboard', () => {
  test.describe.configure({ timeout: 180_000 })

  test('the row is a control, and Enter on it opens that map', async ({ page }) => {
    const { open, other } = await twoLayers(page)

    const row = page.getByRole('button', { name: other, exact: true })
    await expect(row).toHaveCount(1)

    // Absence first: the other layer is the one open.
    expect(open).not.toBe(other)

    await page.locator('body').press('Tab')
    const reached = await tabTo(page, other)
    expect(reached, 'the layer row should be a tab stop').toBe(true)
    await page.keyboard.press('Enter')

    await expect.poll(() => openLayer(page)).toBe(other)
  })

  test('a press on the name still starts a drag, which is why this was left open', async ({ page }) => {
    const { open, other } = await twoLayers(page)

    // Press at the centre of the row — over the name, now a button — and move
    // past the drag threshold. If the pointer-down bail skipped the activator,
    // no drag would arm and the row would simply be selected instead.
    const rows = page.locator('[data-layer-drop]')
    const src = (await rows.filter({ hasText: other }).boundingBox())!
    const tgt = (await rows.filter({ hasText: open }).first().boundingBox())!
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
    await page.mouse.down()
    await page.mouse.move(src.x + src.width / 2 + 8, src.y + src.height / 2 + 8, { steps: 4 })
    await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height / 2, { steps: 6 })
    await page.mouse.up()

    await expect.poll(async () => page.evaluate(async (dragged: string) => {
      const db = (window as { __pwdb?: never }).__pwdb as unknown as
        { mapLayers: { toArray: () => Promise<{ id: string; name: string; parentMapId: string | null }[]> } }
      const layers = await db.mapLayers.toArray()
      const child = layers.find((l) => l.name === dragged)
      return layers.find((l) => l.id === child?.parentMapId)?.name ?? null
    }, other)).toBe(open)
  })

  test('a tap on the row beside the name selects it too', async ({ page }) => {
    const { open, other } = await twoLayers(page)
    expect(open).not.toBe(other)

    // The activator is the name; the rest of the row — its padding and the
    // little map icon — is still the drag surface, and a tap there has always
    // selected the layer. That path lives in the gesture handler's `pointerup`,
    // and removing it left every test in this file passing, which is how it
    // came to be written.
    const row = page.locator('[data-layer-drop]').filter({ hasText: other })
    const box = (await row.boundingBox())!
    await page.mouse.click(box.x + 3, box.y + box.height / 2)

    await expect.poll(() => openLayer(page)).toBe(other)
  })

  test('a plain click on the name still selects, as it always did', async ({ page }) => {
    const { open, other } = await twoLayers(page)
    expect(open).not.toBe(other)

    // The pointer path used to run entirely through the row's `pointerup`; the
    // click now goes through the button. Both must end in the same place, or
    // the keyboard fix would have cost the mouse.
    await page.getByRole('button', { name: other, exact: true }).click()
    await expect.poll(() => openLayer(page)).toBe(other)
  })
})
