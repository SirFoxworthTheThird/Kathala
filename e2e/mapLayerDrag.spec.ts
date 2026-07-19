import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/** Read each map layer's parent *name* straight from IndexedDB. */
function layerParents(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const all = db.transaction('mapLayers', 'readonly').objectStore('mapLayers').getAll()
          all.onsuccess = () => {
            const byId: Record<string, { name: string; parentMapId: string | null }> = {}
            for (const l of all.result) byId[l.id] = l
            const out: Record<string, string | null> = {}
            for (const l of all.result) out[l.name] = l.parentMapId ? byId[l.parentMapId]?.name ?? null : null
            resolve(out)
          }
          all.onerror = () => reject(all.error)
        }
      }),
  )
}

/** New world with two top-level places that each have a child → two sub-maps. */
async function setupTwoSubMaps(page: Page): Promise<void> {
  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [
      { name: 'Northshire', children: [{ name: 'A Hamlet' }] },
      { name: 'Southvale', children: [{ name: 'A Village' }] },
    ],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await expect(page.getByRole('button', { name: 'AI Locations' })).toBeVisible({ timeout: 15_000 })

  // Both sub-maps start under the root "Locations" map.
  await expect.poll(async () => (await layerParents(page)).Southvale).toBe('Locations')
  expect((await layerParents(page)).Northshire).toBe('Locations')
}

test.describe('Map layer drag-and-drop re-parenting', () => {
  test('drags a sub-map into another (and back out) with the mouse', async ({ page }) => {
    test.slow() // the maps view mounts a Leaflet canvas
    await setupTwoSubMaps(page)

    // Drag Southvale onto Northshire in the Map Layers tree. Re-parenting is a
    // pointer-drag (not HTML5 native DnD), so drive it with the real mouse:
    // press on the source row, move past the threshold onto the target, release.
    const rows = page.locator('[data-layer-drop]')
    const northshire = rows.filter({ hasText: 'Northshire' })
    const southvale = rows.filter({ hasText: 'Southvale' })
    await expect(southvale).toBeVisible()
    const src = (await southvale.boundingBox())!
    const tgt = (await northshire.boundingBox())!
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
    await page.mouse.down()
    // First nudge crosses the drag threshold, then land on the target row.
    await page.mouse.move(src.x + src.width / 2 + 8, src.y + src.height / 2 + 8, { steps: 4 })
    await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + tgt.height / 2, { steps: 6 })
    await page.mouse.up()

    // Southvale is now nested under Northshire; Northshire stays a root.
    await expect.poll(async () => (await layerParents(page)).Southvale).toBe('Northshire')
    expect((await layerParents(page)).Northshire).toBe('Locations')

    // Now drag Southvale onto the "top level" drop zone to un-nest it. The zone
    // only appears while a non-root layer is being dragged, so press first, then
    // move onto it and release.
    const southvale2 = page.locator('[data-layer-drop]').filter({ hasText: 'Southvale' })
    const src2 = (await southvale2.boundingBox())!
    await page.mouse.move(src2.x + src2.width / 2, src2.y + src2.height / 2)
    await page.mouse.down()
    await page.mouse.move(src2.x + src2.width / 2 + 8, src2.y + src2.height / 2 + 8, { steps: 4 })
    const rootZone = page.locator('[data-layer-drop="__root__"]')
    await expect(rootZone).toBeVisible()
    const zoneBox = (await rootZone.boundingBox())!
    await page.mouse.move(zoneBox.x + zoneBox.width / 2, zoneBox.y + zoneBox.height / 2, { steps: 6 })
    await page.mouse.up()

    // Southvale is now a top-level map of its own (no parent at all).
    await expect.poll(async () => (await layerParents(page)).Southvale).toBe(null)
  })

  // Touch drag needs a long-press to pick a row up (so a normal swipe still
  // scrolls). Drive real touch through CDP so the browser produces genuine
  // touch → pointer events with pointerType 'touch'.
  test.describe('on touch', () => {
    test.use({ hasTouch: true })

    test('long-presses a sub-map, then drags it into another to nest it', async ({ page }) => {
      test.slow()
      await setupTwoSubMaps(page)

      const rows = page.locator('[data-layer-drop]')
      const southvale = rows.filter({ hasText: 'Southvale' })
      const northshire = rows.filter({ hasText: 'Northshire' })
      await expect(southvale).toBeVisible()
      const src = (await southvale.boundingBox())!
      const tgt = (await northshire.boundingBox())!
      const sx = src.x + src.width / 2
      const sy = src.y + src.height / 2
      const tx = tgt.x + tgt.width / 2
      const ty = tgt.y + tgt.height / 2

      const client = await page.context().newCDPSession(page)
      // Finger down and hold still — a quick move here would scroll instead.
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] })
      await page.waitForTimeout(350) // > the 250ms long-press threshold → armed
      // Now drag onto the target and lift.
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy + 6 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

      // Southvale nested under Northshire via the long-press drag.
      await expect.poll(async () => (await layerParents(page)).Southvale).toBe('Northshire')
      expect((await layerParents(page)).Northshire).toBe('Locations')
    })
  })
})
