import { test, expect, type Page } from '@playwright/test'
import { readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetDB } from './helpers/reset'

/*
  Notes from beta readers (editorial-plan.md, R7). The writer's book goes to a
  reader as a .pwk; in their own browser, in reading mode, they react to words
  they choose and to a paragraph they tap, and send their notes. The file holds
  the notes, not the book. The writer brings it in: the notes are on their
  words on the Page, under the reader's name in the Notes panel, and on the
  reactions map with where the reader stopped.
*/

const MANUSCRIPT = [
  '# The Long Road',
  '',
  '## Chapter 1: Departure',
  '',
  'Mira left before dawn.',
  '',
  'The road belonged to her now.',
  '',
  '## Chapter 2: The Gate',
  '',
  'She did not look back.',
].join('\n')

/** Choose words in the book as a reader would, by dragging over them: the selection, then the mouse let go. */
async function chooseWords(page: Page, words: string) {
  await page.evaluate((w) => {
    const walker = document.createTreeWalker(document.querySelector('[data-book-scroller]')!, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const at = n.textContent!.indexOf(w)
      if (at < 0) continue
      const range = document.createRange()
      range.setStart(n, at)
      range.setEnd(n, at + w.length)
      const sel = window.getSelection()!
      sel.removeAllRanges()
      sel.addRange(range)
      n.parentElement!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      return
    }
    throw new Error(`not in the book: ${w}`)
  }, words)
}

test('a reader reacts as they read and sends their notes; the writer finds them on their words, under the reader’s name, and on the map', async ({ page: writer, browser }) => {
  test.setTimeout(150_000)

  // The writer's book, and a copy of it for the reader.
  await resetDB(writer)
  await writer.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await writer.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await writer.getByRole('button', { name: /^Import/ }).last().click()
  await expect(writer).toHaveURL(/#\/worlds\//)
  const worldId = writer.url().split('/worlds/')[1].split('/')[0]
  await writer.goto('/#/', { waitUntil: 'load' })
  await writer.evaluate(() => { (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined })
  const exported = writer.waitForEvent('download')
  await writer.getByTitle('Export world (single file)').click()
  const copy = join(tmpdir(), `beta-copy-${Date.now()}.pwk`)
  await (await exported).saveAs(copy)

  // The reader, in their own browser, opens it in reading mode.
  const readerContext = await browser.newContext()
  const reader = await readerContext.newPage()
  await resetDB(reader)
  await reader.locator('input[type="file"][accept=".pwk,.pwb,application/json"]').setInputFiles(copy)
  await expect(reader).toHaveURL(/#\/worlds\//, { timeout: 30_000 })
  await reader.goto(`/#/worlds/${worldId}/settings`, { waitUntil: 'load' })
  await reader.getByRole('button', { name: 'Turn on reading mode' }).click()
  await reader.goto(`/#/worlds/${worldId}/manuscript?view=read`, { waitUntil: 'load' })
  const reacting = reader.getByRole('button', { name: 'Notes for the author' })
  await reacting.click()
  await expect(reacting).toHaveAttribute('aria-pressed', 'true')

  // Words chosen: lost, and why.
  await chooseWords(reader, 'belonged to her')
  const bar = reader.getByRole('group', { name: 'React to the chosen words' })
  await expect(bar).toContainText('“belonged to her”')
  await bar.getByRole('textbox', { name: 'Why (if you like)' }).fill('Whose road was it before?')
  await bar.getByRole('button', { name: 'Lost' }).click()
  await expect(bar).toHaveCount(0)

  // A paragraph tapped: loved it.
  await reader.getByRole('main').locator('p[data-p]', { hasText: 'She did not look back.' }).click()
  await expect(bar).toContainText('“She did not look back.”')
  await bar.getByRole('button', { name: 'Loved it' }).click()

  // Read over, and sent: a file of the notes, not the book.
  await reader.getByRole('button', { name: 'Your notes · 2' }).click()
  const yours = reader.getByRole('dialog', { name: 'Your notes for the author' })
  await expect(yours.getByRole('listitem')).toHaveCount(2)
  await expect(yours.getByRole('listitem', { name: 'Lost: belonged to her' })).toContainText('Whose road was it before?')
  await yours.getByRole('textbox', { name: 'Your name' }).fill('Ines')
  const sent = reader.waitForEvent('download')
  await yours.getByRole('button', { name: 'Send to the author' }).click()
  const download = await sent
  expect(download.suggestedFilename()).toBe('the-long-road-notes-from-ines.json')
  const text = await readFile(await download.path(), 'utf8')
  const file = JSON.parse(text)
  expect(file).toMatchObject({ kind: 'kathala-reader-notes', worldId, reader: 'Ines' })
  expect(file.notes.map((n: { quote: string; reaction: string }) => [n.quote, n.reaction])).toEqual([['belonged to her', 'lost'], ['She did not look back.', 'loved']])
  expect(text).not.toContain('Mira left before dawn')
  const notesFile = join(tmpdir(), `beta-notes-${Date.now()}.json`)
  await writeFile(notesFile, text)
  await readerContext.close()

  // The writer brings them in.
  await writer.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await writer.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(writer.locator('.cm-content')).toContainText('She did not look back.')
  await writer.getByLabel('A reader’s notes file').setInputFiles(notesFile)
  const brought = writer.getByRole('dialog', { name: 'A reader’s notes brought in' })
  await expect(brought.getByRole('status')).toContainText('2 notes from Ines')
  await writer.keyboard.press('Escape')

  // On their words on the Page, and under the reader's name in the Notes panel.
  await expect(writer.locator('.cm-prose-note')).toHaveText(['belonged to her', 'She did not look back.'])
  await writer.getByRole('button', { name: /^Notes · 2/ }).click()
  const panel = writer.getByRole('complementary', { name: 'Notes' })
  await panel.getByRole('button', { name: /^From/ }).click()
  await writer.getByRole('option', { name: 'Ines', exact: true }).click()
  await expect(panel.getByRole('listitem', { name: 'Lost: belonged to her' })).toContainText('Ines (reader)')
  await expect(panel.getByRole('listitem', { name: 'Loved it: She did not look back.' })).toBeVisible()

  // And on the map: chapter by chapter, and where Ines stopped.
  await writer.getByRole('button', { name: 'Readers · 1' }).click()
  const map = writer.getByRole('table', { name: 'Reactions by chapter' })
  const ch1 = map.getByRole('row', { name: 'Ch. 1' })
  const ch2 = map.getByRole('row', { name: 'Ch. 2' })
  await expect(ch1.getByRole('cell').nth(1)).toHaveText('1')
  await expect(ch2.getByRole('cell').nth(3)).toHaveText('1')
  await expect(map.getByRole('row').filter({ hasText: 'Ines' })).toHaveCount(1)
})
