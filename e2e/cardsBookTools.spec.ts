import { test, expect } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { readStoredZip } from '../src/lib/zip'

/*
  The book's own tools on Cards (round-trip-plan-3.md, T12.3; writer run F9).
  Export, Drafts, Find & replace and Bring in edits were offered on Page and
  Read only, and the writer, on Cards, went looking for them. They are done to
  the book, not to a view of it, so they are offered wherever the book is in
  its own order — and not in chronological order, which is not the book.
*/

const MANUSCRIPT = ['# The Long Road', '', '## Chapter 1: Departure', '', 'Mira left before dawn.', '', '## Chapter 2: The Gate', '', 'She did not look back.'].join('\n')

test('on Cards: Find & replace, Export, Drafts and Bring in edits, each doing what it does on the Page; not in chronological order', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  const main = page.getByRole('main')
  await main.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true }).click()
  await expect(main.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Each tool, on Cards.
  for (const name of ['Find & replace', 'Export', 'Drafts']) await expect(main.getByRole('button', { name, exact: true })).toBeEnabled()
  await expect(main.getByRole('button', { name: 'Bring in edits…' })).toBeVisible()

  // Export: the book, compiled for it, as a Word file with its prose.
  await main.getByRole('button', { name: 'Export', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: 'Export manuscript' })
  await exportDialog.getByRole('button', { name: 'Word', exact: true }).click()
  const pending = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: 'Download .docx' }).click()
  const xml = new TextDecoder().decode(readStoredZip(new Uint8Array(await readFile(await (await pending).path()))).get('word/document.xml'))
  expect(xml).toContain('Mira left before dawn.')
  expect(xml).toContain('She did not look back.')
  await page.keyboard.press('Escape')
  await expect(exportDialog).toHaveCount(0)

  // Find & replace and Drafts open as they do on the Page.
  await main.getByRole('button', { name: 'Find & replace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Find & replace in the manuscript' })).toBeVisible()
  await page.keyboard.press('Escape')
  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Drafts of the book' })).toBeVisible()
  await page.keyboard.press('Escape')
  // Still on Cards.
  await expect(main.getByRole('group', { name: 'Layout', exact: true }).getByRole('button', { name: 'Cards', exact: true })).toHaveAttribute('aria-pressed', 'true')

  // In chronological order the book is not in its own order: the tools are not offered.
  await page.getByRole('button', { name: 'Chronological' }).click()
  await expect(main.getByRole('button', { name: 'Export', exact: true })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Bring in edits…' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Narrative' }).click()
  await expect(main.getByRole('button', { name: 'Export', exact: true })).toBeVisible()
})
