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

/** The downloaded file, edited as Word writes an editor's work: its document rewritten by `change`, with comments. */
function edit(bytes: Uint8Array, change: (swap: (from: string, to: string) => void, doc: () => string) => string | void, comments: Record<string, string>): Uint8Array {
  const zip = readStoredZip(bytes)
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let doc = dec.decode(zip.get('word/document.xml'))
  const swap = (from: string, to: string) => { if (!doc.includes(from)) throw new Error(`not in the file: ${from}`); doc = doc.replace(from, to) }
  doc = change(swap, () => doc) ?? doc
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${Object.entries(comments).map(([id, text]) => `<w:comment w:id="${id}" ${W} w:initials="AE"><w:p>${run(text)}</w:p></w:comment>`).join('')}</w:comments>`
  const types = dec.decode(zip.get('[Content_Types].xml')).replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>')
  const rels = dec.decode(zip.get('word/_rels/document.xml.rels')).replace('</Relationships>', '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>')
  const parts = new Map(zip)
  parts.set('word/document.xml', enc.encode(doc))
  parts.set('word/comments.xml', enc.encode(xml))
  parts.set('[Content_Types].xml', enc.encode(types))
  parts.set('word/_rels/document.xml.rels', enc.encode(rels))
  return zipStore([...parts].map(([name, data]) => ({ name, data })))
}

const commented = (id: string, inner: string) => `<w:commentRangeStart w:id="${id}"/>${inner}<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`

/** The manuscript imported, on the Page, and sent out as Word for an editor. */
async function sendForEditing(page: Page) {
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
  await main.getByRole('button', { name: 'Export', exact: true }).click()
  const exportDialog = page.getByRole('dialog', { name: 'Export manuscript' })
  await exportDialog.getByRole('button', { name: 'Word', exact: true }).click()
  await exportDialog.getByRole('checkbox', { name: /For an editor/ }).check()
  const pending = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: 'Download .docx' }).click()
  const sent = new Uint8Array(await readFile(await (await pending).path()))
  await page.keyboard.press('Escape')
  return { main, sent }
}

const bringIn = (page: Page, bytes: Uint8Array) => page.getByLabel('An edited Word file').setInputFiles({ name: 'the-long-road-ana.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) })

async function prose(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ text: string }>> }>
    return (await db.sceneTexts.toArray()).map((t) => t.text).sort()
  })
}

test('exported for an editor, edited as Word does, brought back, and the changes decided', async ({ page }) => {
  test.setTimeout(120_000)
  const { main, sent } = await sendForEditing(page)
  // The file is marked, and the book as it went out is a draft.
  expect(new TextDecoder().decode(readStoredZip(sent).get('docProps/custom.xml'))).toContain('KathalaDraft')
  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Drafts of the book' }).getByRole('list', { name: 'Drafts' })).toContainText('Sent for editing')
  await page.keyboard.press('Escape')

  // Back: the edited file brought in. Nothing in the prose has changed yet.
  await bringIn(page, edit(sent, (swap) => {
    // Tracked: " in the rain" inserted.
    swap(run('Mira left before dawn.'), `${run('Mira left before dawn')}<w:ins w:id="91" ${W}>${run(' in the rain')}</w:ins>${run('.')}`)
    // Tracking off, and a comment across the result.
    swap(run('The road belonged to her now.'), commented('7', run('The road was hers now.')))
    // Tracked: " not" deleted.
    swap(run('She did not look back.'), `${run('She did')}<w:del w:id="92" ${W}><w:r><w:delText xml:space="preserve"> not</w:delText></w:r></w:del>${run(' look back.')}`)
  }, { 7: 'Since when? Show us.' }))
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toContainText('3 changes in 2 scenes from Ana Editor')
  await expect(brought.getByRole('status')).toContainText('1 comment is now a note')
  await expect(brought).toContainText('1 change was made with tracking off')
  expect(await prose(page)).toEqual(['Mira left before dawn.\n\nThe road belonged to her now.', 'She did not look back.'])

  // On the Page: each change marked where it would go.
  await brought.getByRole('button', { name: 'Later' }).click()
  // Words going are struck through; the insertion strikes nothing, and puts in only what it adds.
  await expect(page.locator('.cm-edit-del')).toHaveText(['belonged to her', 'not '])
  await expect(page.locator('.cm-edit-ins')).toHaveText([' in the rain', 'was hers'])
  await expect(main.getByRole('button', { name: 'Changes · 3' })).toBeVisible()

  // A change clicked on the Page opens with it picked out, and the deletion is rejected there.
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  await page.locator('.cm-edit-del', { hasText: 'not' }).click()
  const deletion = changes.getByRole('listitem', { name: 'Tracked change: not → (removed)' })
  await expect(deletion).toHaveAttribute('aria-current', 'true')
  await expect(changes.getByRole('listitem', { name: /Untracked edit/ })).not.toHaveAttribute('aria-current')
  await deletion.getByRole('button', { name: 'Reject' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.cm-edit-del')).toHaveText(['belonged to her'])

  // The rest decided from the book's tools: the insertion accepted, then the scene's last change with Accept all.
  await main.getByRole('button', { name: 'Changes · 2' }).click()
  await changes.getByRole('listitem', { name: /Tracked change: dawn\. → dawn in the rain\./ }).getByRole('button', { name: 'Accept' }).click()
  await expect(changes.getByRole('listitem')).toHaveCount(1)
  await changes.getByRole('button', { name: 'Accept all 1' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await expect.poll(() => prose(page)).toEqual(['Mira left before dawn in the rain.\n\nThe road was hers now.', 'She did not look back.'])
  await page.keyboard.press('Escape')
  await expect(page.locator('.cm-edit-del, .cm-edit-ins')).toHaveCount(0)
  await expect(main.getByRole('button', { name: /^Changes/ })).toHaveCount(0)

  // The comment: a note by the editor, on the words it was made on.
  await expect(page.locator('.cm-prose-note')).toHaveText('The road was hers now.')
  await main.getByRole('button', { name: /^Notes/ }).click()
  const note = page.getByRole('complementary', { name: 'Notes' }).getByRole('listitem').filter({ hasText: 'Since when? Show us.' })
  await expect(note).toContainText('Ana Editor (editor)')
})

test('a passage of the file no scene matches is placed by the writer; a comment on it is said not to be brought in', async ({ page }) => {
  test.setTimeout(120_000)
  const { main, sent } = await sendForEditing(page)
  // The second chapter's bookmark lost, and its sentence rewritten past recognising, with a tracked insertion and a comment.
  await bringIn(page, edit(sent, (swap, doc) => {
    swap(run('She did not look back.'), commented('8', `${run('She never')}<w:del w:id="94" ${W}><w:r><w:delText xml:space="preserve"> once</w:delText></w:r></w:del>${run(' looked back')}<w:ins w:id="93" ${W}>${run(' at the town')}</w:ins>${run('.')}`))
    return doc().replace(/<w:bookmarkStart w:id="\d+" w:name="KathalaScene_1"\/>/, '')
  }, { 8: 'Good.' }))
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toHaveText(/^2 changes, waiting for you to accept or reject\./)
  await expect(brought).toContainText('1 passage of the file matched no scene: you can say which scene in Changes.')
  await expect(brought).toContainText('1 comment was on words that matched no scene, and is not brought in')
  await brought.getByRole('button', { name: 'Review the changes' }).click()

  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  const passage = changes.getByRole('region', { name: 'A passage no scene matched' })
  await expect(passage).toContainText('She never looked back at the town.')
  await passage.getByRole('button', { name: /^Its scene/ }).click()
  await page.getByRole('option', { name: /^Ch\. 2/ }).click()
  await expect(passage).toHaveCount(0)
  // Placed: its changes are that scene's, each applied where its words are in the scene's prose.
  const insertion = changes.getByRole('listitem', { name: 'Tracked change: back. → back at the town.' })
  await insertion.getByRole('button', { name: 'Accept' }).click()
  await expect(insertion).toHaveCount(0)
  // "once" is not in the scene: that change cannot be accepted, and says so.
  const deletion = changes.getByRole('listitem', { name: 'Tracked change: once → (removed)' })
  await expect(deletion.getByRole('alert')).toHaveCount(0)
  await deletion.getByRole('button', { name: 'Accept' }).click()
  await expect(deletion.getByRole('alert')).toContainText('The scene no longer has these words')
  await deletion.getByRole('button', { name: 'Reject' }).click()
  await expect(changes).toContainText('No changes waiting.')
  expect(await prose(page)).toEqual(['Mira left before dawn.\n\nThe road belonged to her now.', 'She did not look back at the town.'])
  await expect(main.getByRole('button', { name: /^Changes/ })).toHaveCount(0)
})
