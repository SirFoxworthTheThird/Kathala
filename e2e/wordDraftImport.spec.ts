import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resetDB } from './helpers/reset'
import { zipStore } from '../src/lib/zip'

/*
  Import Manuscript from a Word draft (issue #697): chosen with the picker or
  dropped on the dialog, previewed with what it holds and what it leaves out,
  and brought in with its parts in its chapters' notes and its comments as
  notes on their words.
*/

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/__tests__/fixtures/docx/import')
const fixture = (name: string) => path.join(FIXTURES, name)

async function openDialog(page: Page) {
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Import a Manuscript' })
  await expect(dialog).toBeVisible()
  return dialog
}

type Row = Record<string, unknown>
const table = (page: Page, name: string, worldId: string) =>
  page.evaluate(async ([t, w]) => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Row[]> } } }>
    return db[t].where('worldId').equals(w).toArray()
  }, [name, worldId] as const)

const worldOf = (page: Page) => /#\/worlds\/([^/]+)/.exec(page.url())![1]

test.describe('Import Manuscript from Word', () => {
  test.beforeEach(async ({ page }) => {
    await resetDB(page)
  })

  test('a draft written in Word: the heading under "Chapter One" is its first scene’s, and the preview lists the scenes’ titles (UX-1-9, D-2)', async ({ page }) => {
    // The review's Salt Road: Title, Heading 1 "Chapter One", Heading 2 "The Wreck" and "The Shore", Heading 1 "Chapter Two".
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    const r = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`
    const p = (t: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${r(t)}</w:p>`
    const styles = `<w:styles ${NS}>${[['Title', 'Title'], ['Heading1', 'heading 1'], ['Heading2', 'heading 2']].map(([id, name]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/></w:style>`).join('')}</w:styles>`
    const body = p('The Salt Road', 'Title') + p('Chapter One', 'Heading1') + p('The Wreck', 'Heading2') + p('The ship struck the bar at dusk.') +
      p('The Shore', 'Heading2') + p('She woke on the sand.') + p('Chapter Two', 'Heading1') + p('They walked inland.')
    const enc = new TextEncoder()
    const bytes = zipStore([
      { name: 'word/document.xml', data: enc.encode(`<w:document ${NS}><w:body>${body}</w:body></w:document>`) },
      { name: 'word/styles.xml', data: enc.encode(styles) },
    ])
    const dialog = await openDialog(page)
    await dialog.getByLabel('Choose manuscript file').setInputFiles({ name: 'salt-road.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) })
    await expect(dialog.getByText(/^2 chapters · 3 scenes · /)).toBeVisible()
    // Each chapter's scenes, by title, where any has one; a chapter whose scene has none lists nothing.
    await expect(dialog.locator('[data-preview-scenes]')).toHaveText(['The Wreck · The Shore'])

    await dialog.getByRole('button', { name: 'Import 2 chapters' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const w = worldOf(page)
    const chapters = (await table(page, 'chapters', w)).sort((a, b) => (a.number as number) - (b.number as number))
    const events = await table(page, 'events', w)
    const titles = (chapterId: unknown) => events.filter((e) => e.chapterId === chapterId).sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number)).map((e) => e.title)
    // Not "The Wreck" as the chapter, with its scene left "Scene 1".
    expect(chapters[0].title).not.toBe('The Wreck')
    expect(titles(chapters[0].id)).toEqual(['The Wreck', 'The Shore'])
  })

  test('a draft chosen with the picker: its chapters under its parts, each part in the notes of the chapter it begins', async ({ page }) => {
    const dialog = await openDialog(page)
    await dialog.getByLabel('Choose manuscript file').setInputFiles(fixture('05-parts-and-chapters.docx'))

    // The draft stands in for the text: the box is gone, the file is named, and the preview counts what it holds.
    await expect(dialog.getByText('05-parts-and-chapters.docx')).toBeVisible()
    await expect(dialog.getByLabel('Manuscript text')).toHaveCount(0)
    await expect(dialog.getByText(/^6 chapters · \d+ scenes · [\d,]+ words$/)).toBeVisible()
    const from = dialog.getByRole('list', { name: 'From the Word draft' })
    await expect(from).toContainText('2 parts (Part One, Part Two): each named in the notes of the chapter it begins.')
    await expect(dialog.getByText('Letter I', { exact: true })).toBeVisible()
    // A part is not a chapter.
    await expect(dialog.getByText('Part One', { exact: true })).toHaveCount(0)
    // No title in the file: the world is named after it.
    await expect(dialog.getByLabel('World name')).toHaveValue('05-parts-and-chapters')

    await dialog.getByRole('button', { name: 'Import 6 chapters' }).click()
    await expect(page).toHaveURL(/#\/worlds\//)
    const chapters = (await table(page, 'chapters', worldOf(page))).sort((a, b) => (a.number as number) - (b.number as number))
    expect(chapters.map((c) => c.title).slice(0, 4)).toEqual(['Letter I', 'Letter II', 'Letter III', 'Letter IV'])
    expect(chapters.map((c) => c.notes)).toEqual(['Begins Part One', '', '', 'Begins Part Two', '', ''])
  })

  test('a draft dropped on the dialog: its tracked changes accepted, its comments notes on their words', async ({ page }) => {
    const dialog = await openDialog(page)
    const bytes = readFileSync(fixture('08-tracked-and-comments.docx')).toString('base64')
    await dialog.getByLabel('Manuscript text').evaluate((el, b64) => {
      const data = new DataTransfer()
      const raw = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
      data.items.add(new File([raw], 'Pride and Prejudice.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
      el.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }))
      el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
    }, bytes)

    await expect(dialog.getByText('Pride and Prejudice.docx')).toBeVisible()
    const from = dialog.getByRole('list', { name: 'From the Word draft' })
    await expect(from).toContainText('12 tracked changes taken as accepted.')
    await expect(from).toContainText('6 comments brought in as notes on their words.')

    // Put back, the text box returns, and the preview with it goes.
    await dialog.getByRole('button', { name: 'Put Pride and Prejudice.docx back' }).click()
    await expect(dialog.getByLabel('Manuscript text')).toBeVisible()
    await expect(from).toHaveCount(0)

    await dialog.getByLabel('Choose manuscript file').setInputFiles(fixture('08-tracked-and-comments.docx'))
    await expect(from).toContainText('6 comments')
    await dialog.getByRole('button', { name: /^Import 4 chapters$/ }).click()
    await expect(page).toHaveURL(/#\/worlds\//)

    const worldId = worldOf(page)
    const notes = await table(page, 'proseNotes', worldId)
    const texts = await table(page, 'sceneTexts', worldId)
    expect(notes).toHaveLength(6)
    for (const n of notes) {
      const scene = texts.find((t) => t.eventId === n.eventId)!
      expect(scene.text as string).toContain(`${n.prefix as string}${n.quote as string}`)
    }
  })

  test('a file that is not a draft is turned away and says what is read; a text file still comes in as text', async ({ page }) => {
    const dialog = await openDialog(page)
    await dialog.getByLabel('Choose manuscript file').setInputFiles({ name: 'draft.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    await expect(dialog.getByRole('alert')).toHaveText('That file is not one Import Manuscript reads: choose a .docx, .md or .txt file.')
    await expect(dialog.getByLabel('Manuscript text')).toHaveValue('')

    // A Word file that is not a zip is not read either, and says so.
    await dialog.getByLabel('Choose manuscript file').setInputFiles({ name: 'broken.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a zip') })
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'From the Word draft' })).toHaveCount(0)

    await dialog.getByLabel('Choose manuscript file').setInputFiles({ name: 'novel.md', mimeType: 'text/markdown', buffer: Buffer.from('# Chapter 1\n\nShe rode north.') })
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByLabel('Manuscript text')).toHaveValue('# Chapter 1\n\nShe rode north.')
  })
})
