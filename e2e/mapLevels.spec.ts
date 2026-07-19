import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'

/** Map layers grouped by levelGroupId, with their level info and marker counts. */
function levelSnapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ layers: { id: string; name: string; levelGroupId: string | null; levelIndex: number; levelLabel: string }[]; markerLayerIds: string[] }>((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['mapLayers', 'locationMarkers'], 'readonly')
          const layersReq = tx.objectStore('mapLayers').getAll()
          const markersReq = tx.objectStore('locationMarkers').getAll()
          tx.oncomplete = () => {
            resolve({
              layers: layersReq.result.map((l) => ({ id: l.id, name: l.name, levelGroupId: l.levelGroupId, levelIndex: l.levelIndex, levelLabel: l.levelLabel })),
              markerLayerIds: markersReq.result.map((m) => m.mapLayerId),
            })
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

test('add a level to a map and switch between floors, each with its own locations', async ({ page }) => {
  test.slow() // the maps view mounts a Leaflet canvas

  await page.goto('/')
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Aethel')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  // A flat map with two top-level locations (no sub-maps).
  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  await page.getByRole('textbox', { name: 'locations JSON' }).fill(JSON.stringify({
    locations: [{ name: 'Great Hall' }, { name: 'Courtyard' }],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await expect(page.getByRole('button', { name: 'AI Locations' })).toBeVisible({ timeout: 15_000 })

  const before = await levelSnapshot(page)
  expect(before.layers).toHaveLength(1) // just the ground map
  const groundId = before.layers[0].id
  expect(before.markerLayerIds.every((id) => id === groundId)).toBe(true)

  // Add a "First floor" level, feeding a fresh image.
  await page.getByRole('button', { name: 'Add level' }).click()
  await expect(page.getByLabel('Level name')).toBeVisible()
  await page.getByLabel('Level name').fill('First floor')
  await page.evaluate(async () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 400
    canvas.getContext('2d')!.fillStyle = '#557799'
    canvas.getContext('2d')!.fillRect(0, 0, 500, 400)
    const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/png'))
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'first.png', { type: 'image/png' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.getByRole('button', { name: 'Add Level', exact: true }).click()

  // The group now has two floors; the ground floor keeps all the markers.
  await expect.poll(async () => (await levelSnapshot(page)).layers.length).toBe(2)
  const after = await levelSnapshot(page)
  const group = after.layers.filter((l) => l.levelGroupId)
  expect(group).toHaveLength(2)
  expect(new Set(group.map((l) => l.levelGroupId)).size).toBe(1) // same group
  const ground = group.find((l) => l.levelIndex === 0)!
  const first = group.find((l) => l.levelIndex === 1)!
  expect(ground.levelLabel).toBe('Ground floor')
  expect(first.levelLabel).toBe('First floor')
  // Locations belong to the floor they were placed on — all still on the ground floor.
  expect(after.markerLayerIds.every((id) => id === ground.id)).toBe(true)

  // The floor switcher shows both, with the new First floor active.
  const switcher = page.locator('[aria-current="true"]')
  await expect(page.getByRole('button', { name: 'Ground floor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'First floor' })).toBeVisible()
  await expect(switcher).toHaveText('First floor')

  // Switch to the ground floor.
  await page.getByRole('button', { name: 'Ground floor' }).click()
  await expect(page.locator('[aria-current="true"]')).toHaveText('Ground floor')
})
