import { test, expect } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'

/*
  Part G, writers A1 and A3, driving the app from an automated browser: the
  world backup did nothing. Chromium refuses the "Save as" picker at once under
  automation, with the AbortError a person's Cancel gives, and the export took
  it for one. Playwright's Chromium is such a browser (navigator.webdriver), so
  this runs the export exactly as they did: the picker present, not stubbed.
*/
test('the world backup downloads in an automated browser', async ({ page }) => {
  test.setTimeout(90_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill('# Road\n\n## Chapter 1: Go\n\nMira left before dawn.')
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]

  // The conditions the writers had: a picker the page can call, under automation.
  expect(await page.evaluate(() => [typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker, navigator.webdriver]))
    .toEqual(['function', true])

  await page.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  const download = page.waitForEvent('download', { timeout: 20_000 })
  await page.getByRole('button', { name: 'Export a .pwk copy…' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Road.pwk')
  const world = JSON.parse(await readFile(await file.path(), 'utf8'))
  expect(world.world.name).toBe('Road')
  expect(world.sceneTexts.map((s: { text: string }) => s.text).join('\n')).toContain('Mira left before dawn.')
})
