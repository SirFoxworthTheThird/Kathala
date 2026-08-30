import { test, expect, type Page } from '@playwright/test'
import { resetDB } from './helpers/reset'
import { waitForMapReady } from './helpers/map'

function levelSnapshot(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ layers: { id: string; name: string; levelGroupId: string | null; levelIndex: number; levelLabel: string }[]; markers: { name: string; mapLayerId: string }[] }>((resolve, reject) => {
        const req = indexedDB.open('PlotWeaveDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['mapLayers', 'locationMarkers'], 'readonly')
          const layersReq = tx.objectStore('mapLayers').getAll()
          const markersReq = tx.objectStore('locationMarkers').getAll()
          tx.oncomplete = () => resolve({
            layers: layersReq.result.map((l) => ({ id: l.id, name: l.name, levelGroupId: l.levelGroupId, levelIndex: l.levelIndex, levelLabel: l.levelLabel })),
            markers: markersReq.result.map((m) => ({ name: m.name, mapLayerId: m.mapLayerId })),
          })
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

test('AI location generation can create a leveled place with per-floor locations', async ({ page }) => {
  test.slow()

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
      { name: 'Hogwarts Castle', type: 'building', levels: [
        { name: 'Ground floor', children: [{ name: 'Great Hall' }] },
        { name: 'First floor', children: [{ name: 'Library' }] },
      ]},
    ],
  }))
  await page.getByRole('button', { name: 'Add locations' }).click()
  await waitForMapReady(page)

  // The map renders as soon as the first layer exists, which is before the
  // generator has written the floors — poll for the level group itself rather
  // than trusting the view being up to mean generation finished.
  await expect
    .poll(async () => (await levelSnapshot(page)).layers.filter((l) => l.levelGroupId).length, {
      timeout: 15_000,
    })
    .toBe(2)

  // The generator built a level group with each floor holding its own location.
  const snap = await levelSnapshot(page)
  const floors = snap.layers.filter((l) => l.levelGroupId)
  expect(floors).toHaveLength(2)
  expect(new Set(floors.map((l) => l.levelGroupId)).size).toBe(1)
  const ground = floors.find((l) => l.levelIndex === 0)!
  const first = floors.find((l) => l.levelIndex === 1)!
  expect(ground.levelLabel).toBe('Ground floor')
  expect(first.levelLabel).toBe('First floor')
  expect(snap.markers.find((m) => m.name === 'Great Hall')!.mapLayerId).toBe(ground.id)
  expect(snap.markers.find((m) => m.name === 'Library')!.mapLayerId).toBe(first.id)

  // Open the castle (its ground floor is the tree representative) and check the switcher.
  await page.locator('[data-layer-drop]').filter({ hasText: 'Hogwarts Castle' }).first().click()
  await expect(page.getByRole('button', { name: 'Ground floor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'First floor' })).toBeVisible()
  await page.getByRole('button', { name: 'First floor' }).click()
  await expect(page.locator('[aria-current="true"]')).toHaveText('First floor')
})

test('a drifted key is named in the preview rather than dropped in silence', async ({ page }) => {
  // The documented shape nests a floor's rooms under `levels[].children`.
  // `levels[].locations` used to import two empty floors and say nothing: the
  // count line was honest about what it was importing, so the only signal was
  // noticing later that the rooms were missing.
  test.slow()
  await resetDB(page)
  await page.getByRole('button', { name: 'New World' }).click()
  await page.getByLabel('Name').fill('Drifted')
  await page.getByRole('button', { name: 'Create World' }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

  await page.goto(`/#/worlds/${worldId}/maps`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Generate locations with AI' }).click()
  const box = page.getByRole('textbox', { name: 'locations JSON' })

  await box.fill(JSON.stringify({
    locations: [
      { name: 'Keep of Ash', levels: [{ name: 'Undercroft', locations: [{ name: 'The Cistern' }] }] },
    ],
  }))
  await expect(page.getByText(/Ready to import/)).toBeVisible()
  await expect(page.getByText(/doesn.t recognise/)).toContainText('locations')

  // The other half: a spec in the documented shape draws no warning, so this
  // cannot pass by warning on every import.
  await box.fill(JSON.stringify({
    locations: [
      { name: 'Keep of Ash', levels: [{ name: 'Undercroft', children: [{ name: 'The Cistern' }] }] },
    ],
  }))
  await expect(page.getByText(/Ready to import/)).toBeVisible()
  await expect(page.getByText(/doesn.t recognise/)).toHaveCount(0)
})
