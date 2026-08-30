import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { openMapTools, waitForMapReady } from './helpers/map'

/** Read all map layers and markers straight from IndexedDB. */
function dbSnapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ layers: Record<string, { imageId: string; imageWidth: number; parentMapId: string | null }>; markers: { id: string; mapLayerId: string; x: number; y: number }[] }>((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['mapLayers', 'locationMarkers'], 'readonly')
          const layersReq = tx.objectStore('mapLayers').getAll()
          const markersReq = tx.objectStore('locationMarkers').getAll()
          tx.oncomplete = () => {
            const layers: Record<string, { imageId: string; imageWidth: number; parentMapId: string | null }> = {}
            for (const l of layersReq.result) layers[l.id] = { imageId: l.imageId, imageWidth: l.imageWidth, parentMapId: l.parentMapId }
            resolve({ layers, markers: markersReq.result.map((m) => ({ id: m.id, mapLayerId: m.mapLayerId, x: m.x, y: m.y })) })
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

test('replace an existing map image and rescale its locations', async ({ page }) => {
  test.slow() // the maps view mounts a Leaflet canvas

  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [{ name: 'Northshire' }, { name: 'Southvale' }],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await waitForMapReady(page)

  // The active (root) map and a marker on it, before replacing.
  const before = await dbSnapshot(page)
  const rootId = Object.keys(before.layers).find((id) => before.layers[id].parentMapId === null)!
  const oldWidth = before.layers[rootId].imageWidth
  const oldImageId = before.layers[rootId].imageId
  const marker = before.markers.find((m) => m.mapLayerId === rootId)!
  expect(oldWidth).toBeGreaterThan(0)

  // Open the replace dialog and feed it a fresh 640×480 image.
  await openMapTools(page)
  await page.getByRole('button', { name: 'Replace image' }).click()
  await expect(page.getByText('Replace Map Image')).toBeVisible()
  await page.evaluate(async () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const canvas = document.createElement('canvas')
    canvas.width = 640; canvas.height = 480
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3366aa'; ctx.fillRect(0, 0, 640, 480)
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'))
    const file = new File([blob], 'newmap.png', { type: 'image/png' })
    const dt = new DataTransfer(); dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // "Reposition existing locations" is checked by default.
  const replaceBtn = page.getByRole('button', { name: 'Replace', exact: true })
  await expect(replaceBtn).toBeEnabled()
  await replaceBtn.click()
  await expect(page.getByText('Replace Map Image')).toBeHidden()

  // The image swapped to 640 wide and the marker moved proportionally.
  await expect.poll(async () => (await dbSnapshot(page)).layers[rootId].imageWidth).toBe(640)
  const after = await dbSnapshot(page)
  expect(after.layers[rootId].imageId).not.toBe(oldImageId)
  const movedMarker = after.markers.find((m) => m.id === marker.id)!
  const sx = 640 / oldWidth
  expect(movedMarker.x).toBeCloseTo(marker.x * sx, 3)
})
