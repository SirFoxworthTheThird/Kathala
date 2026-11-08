import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'fs/promises'
import { resetDB } from './helpers/reset'
import { readStoredZip, zipStore } from '../src/lib/zip'

/*
  A round trip through Word (editorial-plan.md, R4): the book exported for an
  editor, the file edited as Word writes an editor's work — a tracked
  insertion and deletion, an edit with tracking off, a comment — and brought
  back: the changes waiting on the Page and in Changes, one accepted, one
  rejected, the untracked edit accepted, the comment the editor's note.
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

const W = 'w:author="Ana Editor" w:date="2026-11-08T10:00:00Z"'
const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`

/** The downloaded file, edited as Word writes an editor's work. */
function edit(bytes: Uint8Array): Uint8Array {
  const zip = readStoredZip(bytes)
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let doc = dec.decode(zip.get('word/document.xml'))
  const swap = (from: string, to: string) => { if (!doc.includes(from)) throw new Error(`not in the file: ${from}`); doc = doc.replace(from, to) }
  // Tracked: " in the rain" inserted.
  swap(run('Mira left before dawn.'), `${run('Mira left before dawn')}<w:ins w:id="91" ${W}>${run(' in the rain')}</w:ins>${run('.')}`)
  // Tracking off, and a comment across the result.
  swap(run('The road belonged to her now.'), `<w:commentRangeStart w:id="7"/>${run('The road was hers now.')}<w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r>`)
  // Tracked: " not" deleted.
  swap(run('She did not look back.'), `${run('She did')}<w:del w:id="92" ${W}><w:r><w:delText xml:space="preserve"> not</w:delText></w:r></w:del>${run(' look back.')}`)
  const comments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="7" ${W} w:initials="AE"><w:p>${run('Since when? Show us.')}</w:p></w:comment></w:comments>`
  const types = dec.decode(zip.get('[Content_Types].xml')).replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>')
  const rels = dec.decode(zip.get('word/_rels/document.xml.rels')).replace('</Relationships>', '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>')
  const parts = new Map(zip)
  parts.set('word/document.xml', enc.encode(doc))
  parts.set('word/comments.xml', enc.encode(comments))
  parts.set('[Content_Types].xml', enc.encode(types))
  parts.set('word/_rels/document.xml.rels', enc.encode(rels))
  return zipStore([...parts].map(([name, data]) => ({ name, data })))
}

async function prose(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
    return (await db.sceneTexts.toArray()).map((t) => t.text).sort()
  })
}

test('exported for an editor, edited as Word does, brought back, and the changes decided', async ({ page }) => {
  test.setTimeout(120_000)
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(MANUSCRIPT)
  await page.getByRole('button', { name: /^Import/ }).last().click()
  await expect(page).toHaveURL(/#\/worlds\//)
  const worldId = page.url().split('/worlds/')[1].split('/')[0]
  await page.goto(`/#/worlds/${worldId}/manuscript`, { waitUntil: 'load' })
  await page.getByRole('button', { name: 'Page', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('She did not look back.')
  const main = page.getByRole('main')

  // Out: Word, for an editor.
  await main.getByRole('button', { name: 'Export', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: 'Export manuscript' })
  await exportDialog.getByRole('button', { name: 'Word', exact: true }).click()
  await exportDialog.getByRole('checkbox', { name: /For an editor/ }).check()
  const pending = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: 'Download .docx' }).click()
  const sent = new Uint8Array(await readFile(await (await pending).path()))
  await page.keyboard.press('Escape')
  // The file is marked, and the book as it went out is a draft.
  expect(new TextDecoder().decode(readStoredZip(sent).get('docProps/custom.xml'))).toContain('KathalaDraft')
  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Drafts of the book' }).getByRole('list', { name: 'Drafts' })).toContainText('Sent for editing')
  await page.keyboard.press('Escape')

  // Back: the edited file brought in. Nothing in the prose has changed yet.
  await page.getByLabel('An edited Word file').setInputFiles({ name: 'the-long-road-ana.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(edit(sent)) })
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toContainText('3 changes in 2 scenes from Ana Editor')
  await expect(brought.getByRole('status')).toContainText('1 comment is now a note')
  await expect(brought).toContainText('1 change was made with tracking off')
  expect(await prose(page)).toEqual(['Mira left before dawn.\n\nThe road belonged to her now.', 'She did not look back.'])

  // On the Page: each change marked where it would go.
  await brought.getByRole('button', { name: 'Later' }).click()
  await expect(page.locator('.cm-edit-del')).toHaveCount(3)
  await expect(page.locator('.cm-edit-ins').filter({ hasText: 'in the rain' })).toHaveCount(1)
  await expect(main.getByRole('button', { name: 'Changes · 3' })).toBeVisible()

  // Decided: the insertion accepted, the deletion rejected, the untracked edit accepted.
  await main.getByRole('button', { name: 'Changes · 3' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  await changes.getByRole('listitem', { name: /Tracked change: dawn\. → dawn in the rain\./ }).getByRole('button', { name: 'Accept' }).click()
  await changes.getByRole('listitem', { name: 'Tracked change: not → (removed)' }).getByRole('button', { name: 'Reject' }).click()
  await changes.getByRole('listitem', { name: /Untracked edit/ }).getByRole('button', { name: 'Accept' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await expect.poll(() => prose(page)).toEqual(['Mira left before dawn in the rain.\n\nThe road was hers now.', 'She did not look back.'])
  await page.keyboard.press('Escape')
  await expect(page.locator('.cm-edit-del')).toHaveCount(0)
  await expect(main.getByRole('button', { name: /^Changes/ })).toHaveCount(0)

  // The comment: a note by the editor, on the words it was made on.
  await expect(page.locator('.cm-prose-note')).toHaveText('The road was hers now.')
  await main.getByRole('button', { name: /^Notes/ }).click()
  const note = page.getByRole('complementary', { name: 'Notes' }).getByRole('listitem').filter({ hasText: 'Since when? Show us.' })
  await expect(note).toContainText('Ana Editor (editor)')
})
