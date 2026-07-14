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

test.describe('Map layer drag-and-drop re-parenting', () => {
  test('drags a sub-map into another to nest it', async ({ page }) => {
    test.slow() // the maps view mounts a Leaflet canvas

    await page.goto('/')
    await resetDB(page)
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Aethel')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const worldId = page.url().match(/#\/worlds\/([^/]+)/)![1]

    // Generate two top-level places that each have children → two sub-map layers.
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

    // Drag Southvale onto Northshire in the Map Layers tree. Native HTML5 drag
    // isn't reliably driven by Playwright's mouse, so dispatch the drag events
    // with one shared DataTransfer (exactly what the handlers read).
    const rows = page.locator('[title="Drag onto another map to nest it inside"]')
    const northshire = rows.filter({ hasText: 'Northshire' })
    const southvale = rows.filter({ hasText: 'Southvale' })
    await expect(southvale).toBeVisible()
    const src = (await southvale.elementHandle())!
    const tgt = (await northshire.elementHandle())!
    await page.evaluate(([source, target]) => {
      const dt = new DataTransfer()
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
      fire(source, 'dragstart')
      fire(target, 'dragover')
      fire(target, 'drop')
      fire(source, 'dragend')
    }, [src, tgt])

    // Southvale is now nested under Northshire; Northshire stays a root.
    await expect.poll(async () => (await layerParents(page)).Southvale).toBe('Northshire')
    expect((await layerParents(page)).Northshire).toBe('Locations')
  })
})
