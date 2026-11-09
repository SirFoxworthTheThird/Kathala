import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { readStoredZip } from '../src/lib/zip'

/*
  A submission from the export dialog (editorial-plan.md, R2): Word, in
  standard manuscript format, with the writer's details — downloaded and read
  back part by part — and the details remembered for the next export of the
  same book.
*/

const MANUSCRIPT = [
  '# The Salt Ledger',
  '',
  '## Chapter 1: The Weighing House',
  '',
  'The weighing house opened before the tide turned.',
  '',
  '## Chapter 2: The Quay',
  '',
  'The first cart came up the quay at six.',
].join('\n')

async function openExport(page: Page) {
  await page.getByRole('main').getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export manuscript' })
  await dialog.getByRole('button', { name: 'Word', exact: true }).click()
  return dialog
}

test('a submission downloads in standard manuscript format, and the writer’s details are kept for the next one', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  await expect(page.getByRole('main').getByText('The first cart came up the quay at six.')).toBeVisible()

  let dialog = await openExport(page)
  const download = dialog.getByRole('button', { name: 'Download .docx' })
  // A book needs no name; a submission does, and says so.
  await expect(download).toBeEnabled()
  await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Submission' }).click()
  await expect(download).toBeDisabled()
  await expect(dialog.getByText('A submission needs the name on its byline.')).toBeVisible()

  await dialog.getByRole('textbox', { name: 'Name on the byline' }).fill('Ines Varga')
  await dialog.getByRole('textbox', { name: 'Contact details' }).fill('12 Quay Lane\nines@example.com')
  await dialog.getByRole('button', { name: /^Font/ }).click()
  await page.getByRole('option', { name: 'Courier New' }).click()
  await expect(download).toBeEnabled()

  const pending = page.waitForEvent('download')
  await download.click()
  const file = await pending
  expect(file.suggestedFilename()).toMatch(/\.docx$/)
  const zip = readStoredZip(new Uint8Array(await readFile(await file.path())))
  const text = (name: string) => new TextDecoder().decode(zip.get(name))
  expect(text('word/header1.xml')).toContain('Varga / THE SALT LEDGER / ')
  const doc = text('word/document.xml')
  expect(doc).toContain('Ines Varga</w:t><w:tab/><w:t xml:space="preserve">about 100 words')
  expect(doc).toContain('>12 Quay Lane</w:t>')
  expect(doc).toContain('by Ines Varga</w:t>')
  expect(doc).toContain('>END</w:t>')
  expect(text('word/styles.xml')).toContain('w:ascii="Courier New"')

  // Closed and opened again, on the same book: the layout and the details are as they were left.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  dialog = await openExport(page)
  await expect(dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Submission' })).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('textbox', { name: 'Name on the byline' })).toHaveValue('Ines Varga')
  await expect(dialog.getByRole('textbox', { name: 'Contact details' })).toHaveValue('12 Quay Lane\nines@example.com')

  // Back to Book: the book's layout, with the same name as its author line.
  await dialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Book' }).click()
  await expect(dialog.getByRole('textbox', { name: 'Author (optional)' })).toHaveValue('Ines Varga')
  await expect(dialog.getByRole('textbox', { name: 'Contact details' })).toHaveCount(0)
  const again = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download .docx' }).click()
  const book = readStoredZip(new Uint8Array(await readFile(await (await again).path())))
  expect(book.has('word/header1.xml')).toBe(false)
  expect(new TextDecoder().decode(book.get('word/document.xml'))).toContain('Ines Varga</w:t>')
})
