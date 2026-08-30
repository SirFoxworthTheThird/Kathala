import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { resetDB } from './helpers/reset'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const V1_FIXTURE = path.resolve(__dirname, 'fixtures/v1_world.pwk')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate home (world selector). */
async function goHome(page: Parameters<typeof resetDB>[0]) {
  await page.getByText('PlotWeave').click()
  await expect(page).toHaveURL('/#/')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Import / Export', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  // ── v1 fixture import ────────────────────────────────────────────────────────

  test('imports a v1 .pwk file and migrates to v2 structure', async ({ page }) => {
    // The file input is hidden; set it directly
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(V1_FIXTURE)

    // Import navigates straight into the new world; its name is the page heading.
    await expect(page.getByRole('heading', { name: 'V1 Migration World' })).toBeVisible()

    // Check characters survived the migration
    await page.getByRole('link', { name: /characters/i }).click()
    await expect(page.getByText('Gandalf')).toBeVisible()
    await expect(page.getByText('Frodo')).toBeVisible()
  })

  test('v1 import: snapshots are re-keyed to eventId', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(V1_FIXTURE)
    await expect(page.getByRole('heading', { name: 'V1 Migration World' })).toBeVisible()

    // Read IndexedDB to confirm no chapterId remains on characterSnapshots
    const hasChapterId = await page.evaluate(async () => {
      const request = indexedDB.open('PlotWeaveDB')
      return new Promise<boolean>((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('characterSnapshots', 'readonly')
          const store = tx.objectStore('characterSnapshots')
          const all = store.getAll()
          all.onsuccess = () => {
            const records = all.result as Record<string, unknown>[]
            resolve(records.some((r) => 'chapterId' in r))
          }
          all.onerror = () => reject(all.error)
        }
        request.onerror = () => reject(request.error)
      })
    })
    expect(hasChapterId).toBe(false)
  })

  test('v1 import: relationship startChapterId is migrated to startEventId', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(V1_FIXTURE)
    await expect(page.getByRole('heading', { name: 'V1 Migration World' })).toBeVisible()

    const hasStartChapterId = await page.evaluate(async () => {
      const request = indexedDB.open('PlotWeaveDB')
      return new Promise<boolean>((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('relationships', 'readonly')
          const store = tx.objectStore('relationships')
          const all = store.getAll()
          all.onsuccess = () => {
            const records = all.result as Record<string, unknown>[]
            resolve(records.some((r) => 'startChapterId' in r))
          }
          all.onerror = () => reject(all.error)
        }
        request.onerror = () => reject(request.error)
      })
    })
    expect(hasStartChapterId).toBe(false)
  })

  // ── Export / re-import round-trip ────────────────────────────────────────────

  test('exports a world and re-imports it', async ({ page }) => {
    // Create a world with a character
    await page.getByRole('button', { name: 'New World' }).click()
    await page.getByLabel('Name').fill('Export Test World')
    await page.getByRole('button', { name: 'Create World' }).last().click()
    await expect(page).toHaveURL(/#\/worlds\//)

    await page.getByRole('link', { name: /characters/i }).click()
    await page.getByRole('button', { name: 'Add Character' }).first().click()
    await page.getByPlaceholder('Character name').fill('Aragorn')
    await page.getByRole('button', { name: 'Add Character' }).last().click()
    await expect(page.getByText('Aragorn')).toBeVisible()

    // Go to world selector and export
    await goHome(page)

    // Force the download fallback: with the File System Access API present,
    // export writes via showSaveFilePicker and fires no 'download' event.
    await page.evaluate(() => {
      ;(window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByTitle('Export world (single file)').click()
    const download = await downloadPromise

    // Save the downloaded file to a temp path
    const tmpPath = path.join(os.tmpdir(), `export-test-${Date.now()}.pwk`)
    await download.saveAs(tmpPath)
    expect(fs.existsSync(tmpPath)).toBe(true)

    // Reset the DB, then re-import the downloaded file
    await resetDB(page)
    await expect(page.getByText('Export Test World')).not.toBeVisible()

    const fileInput = page.locator('input[type="file"][accept=".pwk,.pwb,application/json"]')
    await fileInput.setInputFiles(tmpPath)

    // World and character should be restored (import navigates into the world).
    //
    // Don't look for the dashboard heading. This world has a character but no
    // timeline and no events, so its dashboard is the setup wizard — the
    // heading is only on screen for the instant before the event count loads
    // and the wizard latches, which is a race this test used to win by luck.
    // Landing in the world and finding the character back is the actual claim.
    await expect(page).toHaveURL(/#\/worlds\/[^/]+/, { timeout: 30_000 })
    await page.getByRole('link', { name: /characters/i }).click()
    await expect(page.getByText('Aragorn')).toBeVisible({ timeout: 15_000 })

    // Cleanup
    fs.unlinkSync(tmpPath)
  })
})
