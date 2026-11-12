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
async function sendForEditing(page: Page, manuscript = MANUSCRIPT) {
  await resetDB(page)
  await page.getByRole('button', { name: 'Import Manuscript' }).first().click()
  await page.getByLabel('Manuscript text').fill(manuscript)
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

const bringIn = (page: Page, bytes: Uint8Array, name = 'the-long-road-ana.docx') => page.getByLabel('An edited Word file').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) })

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
  const scene = changes.getByRole('region', { name: /^Changes to / })
  await expect(deletion.getByRole('alert')).toHaveCount(0)
  await expect(scene.getByRole('button', { name: 'Accept all 1' })).toBeEnabled()
  await deletion.getByRole('button', { name: 'Accept' }).click()
  await expect(deletion.getByRole('alert')).toContainText('The scene no longer has these words')
  // Nothing left that can be made: Accept all has nothing to do, and the scene says why (round-trip-plan.md, T1.1).
  await expect(scene.getByRole('button', { name: 'Accept all 0' })).toBeDisabled()
  await expect(scene.getByRole('status')).toHaveText('This change could not be made. Make it by hand, or reject it.')
  await deletion.getByRole('button', { name: 'Reject' }).click()
  await expect(changes).toContainText('No changes waiting.')
  expect(await prose(page)).toEqual(['Mira left before dawn.\n\nThe road belonged to her now.', 'She did not look back at the town.'])
  await expect(main.getByRole('button', { name: /^Changes/ })).toHaveCount(0)
})

test('a paragraph split with tracking on is one change, said as a new paragraph, and made by accepting it (round-trip-plan.md, T1.1)', async ({ page }) => {
  test.setTimeout(120_000)
  const { main, sent } = await sendForEditing(page, [
    '# The Long Road', '', '## Chapter 1: Departure', '', 'Mira left before dawn. The road was long.', '', '## Chapter 2: The Gate', '', 'She did not look back.',
  ].join('\n'))
  const sentence = run('Mira left before dawn. The road was long.')
  await bringIn(page, edit(sent, (swap, doc) => {
    // An edit with tracking off in the other chapter, for the summary to have one to say.
    swap(run('She did not look back.'), run('She never looked back.'))
    // As LibreOffice writes a split: the paragraph's own mark inserted, and the space before the break deleted, both tracked.
    const xml = doc()
    const at = xml.indexOf(sentence)
    const open = xml.lastIndexOf('<w:p', at)
    const close = xml.indexOf('</w:p>', at) + '</w:p>'.length
    const head = xml.slice(open, at) // the paragraph's start, its properties and its scene's bookmark
    const tail = xml.slice(at + sentence.length, close) // anything after the run, and the paragraph's end
    const props = head.match(/<w:pPr>.*<\/w:pPr>/s)?.[0] ?? '<w:pPr></w:pPr>'
    const mark = `<w:ins w:id="95" ${W}/>`
    const marked = props.includes('<w:rPr>') ? props.replace('<w:rPr>', `<w:rPr>${mark}`) : props.replace('</w:pPr>', `<w:rPr>${mark}</w:rPr></w:pPr>`)
    const first = `${head.replace(props, marked)}${run('Mira left before dawn.')}<w:del w:id="96" ${W}><w:r><w:delText xml:space="preserve"> </w:delText></w:r></w:del></w:p>`
    const second = `<w:p>${props}${run('The road was long.')}${tail}`
    return xml.slice(0, open) + first + second + xml.slice(close)
  }, {}))
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  // One change for the split, and one with tracking off: the split is not counted as an edit made with tracking off.
  await expect(brought.getByRole('status')).toContainText('2 changes in 2 scenes from Ana Editor')
  await expect(brought).toContainText('1 change was made with tracking off')
  await brought.getByRole('button', { name: 'Later' }).click()

  // On the Page: a pilcrow where the new paragraph would start.
  await expect(page.locator('.cm-edit-ins', { hasText: '¶' })).toHaveAttribute('title', 'Ana Editor: a new paragraph here')
  await main.getByRole('button', { name: 'Changes · 2' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  const split = changes.getByRole('listitem', { name: 'Tracked change: a new paragraph after “left before dawn.”' })
  await expect(split).toContainText('¶ New paragraph')
  await split.getByRole('button', { name: 'Accept' }).click()
  await expect(split).toHaveCount(0)
  await expect.poll(() => prose(page)).toEqual(['Mira left before dawn.\n\nThe road was long.', 'She did not look back.'])
})

test('a sentence moved with tracking on is one change, marked where it goes from and to, and made whole (round-trip-plan.md, T1.2)', async ({ page }) => {
  test.setTimeout(120_000)
  const { main, sent } = await sendForEditing(page, [
    '# The Long Road', '', '## Chapter 1: Departure', '', 'Mira left before dawn. The road was long. She did not hurry.', '', '## Chapter 2: The Gate', '', 'She did not look back.',
  ].join('\n'))
  // As LibreOffice writes a move: the sentence taken out (w:moveFrom) and put in at the end (w:moveTo), with no name to pair them by.
  await bringIn(page, edit(sent, (swap) => {
    swap(run('Mira left before dawn. The road was long. She did not hurry.'),
      `${run('Mira left before dawn.')}<w:moveFrom w:id="97" ${W}>${run(' The road was long.')}</w:moveFrom>${run(' She did not hurry.')}<w:moveTo w:id="98" ${W}>${run(' The road was long.')}</w:moveTo>`)
  }, {}))
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toContainText('1 change in 1 scene from Ana Editor')
  await brought.getByRole('button', { name: 'Later' }).click()

  // On the Page: struck through where it was, underlined where it goes, each saying so.
  await expect(page.locator('.cm-edit-del.cm-edit-moved')).toHaveAttribute('title', 'Ana Editor: moved from here')
  await expect(page.locator('.cm-edit-ins.cm-edit-moved')).toHaveAttribute('title', 'Ana Editor: moved here')
  await main.getByRole('button', { name: 'Changes · 1' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  // One change, not a deletion and an insertion to decide apart.
  await expect(changes.getByRole('listitem')).toHaveCount(1)
  const move = changes.getByRole('listitem', { name: 'Tracked change: moved “The road was long.”' })
  await expect(move).toContainText('⇄ Moved')
  await expect(move).toContainText('From after “…Mira left before dawn.”, to after “…She did not hurry.”')
  await move.getByRole('button', { name: 'Accept' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await expect.poll(() => prose(page)).toEqual(['Mira left before dawn. She did not hurry. The road was long.', 'She did not look back.'])
})

test('a change to a chapter heading is listed to make by hand, and dismissed; one replacement is one change (round-trip-plan.md, T1.3, T1.4)', async ({ page }) => {
  test.setTimeout(120_000)
  const { sent } = await sendForEditing(page, [
    '# The Long Road', '', '## Chapter 1: Departure', '', 'Mira held a letter in his hand.', '', '## Chapter 2: The Gate', '', 'She did not look back.',
  ].join('\n'))
  await bringIn(page, edit(sent, (swap, doc) => {
    // A word-for-words replacement, as one run of a deletion and an insertion.
    swap(run('Mira held a letter in his hand.'), `${run('Mira held a letter ')}<w:del w:id="91" ${W}><w:r><w:delText xml:space="preserve">in his hand</w:delText></w:r></w:del><w:ins w:id="92" ${W}>${run('under his seal')}</w:ins>${run('.')}`)
    // A tracked insertion at the end of the first chapter's heading.
    const xml = doc()
    const heading = xml.indexOf('<w:pStyle w:val="Heading1"/>')
    const close = xml.indexOf('</w:p>', heading)
    const withIns = xml.slice(0, close) + `<w:ins w:id="93" ${W}>${run(', at Dawn')}</w:ins>` + xml.slice(close)
    // And a comment on the second chapter's heading, which is otherwise unchanged (round-trip-plan-2.md, T7.6; R3-1).
    const second = withIns.indexOf('<w:pStyle w:val="Heading1"/>', withIns.indexOf('<w:pStyle w:val="Heading1"/>') + 1)
    const props = withIns.indexOf('</w:pPr>', second) + '</w:pPr>'.length
    const end = withIns.indexOf('</w:p>', second)
    return withIns.slice(0, props) + '<w:commentRangeStart w:id="94"/>' + withIns.slice(props, end) + '<w:commentRangeEnd w:id="94"/><w:r><w:commentReference w:id="94"/></w:r>' + withIns.slice(end)
  }, { 94: 'House style: spell the chapter numbers out.' }))
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toContainText('2 changes in 1 scene from Ana Editor')
  await expect(brought).toContainText('1 change is outside the scenes, on the title page or a chapter’s heading')
  // The comment on the heading is not "on words that matched no scene": it is brought in, to read in Changes.
  await expect(brought).toContainText('1 comment is on the title page or a chapter’s heading: read it in Changes.')
  await expect(brought).not.toContainText('matched no scene')
  await brought.getByRole('button', { name: 'Review the changes' }).click()

  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  const outside = changes.getByRole('region', { name: 'Changes outside the scenes' })
  const heading = outside.getByRole('listitem', { name: /^On the heading: .*Departure → .*Departure, at Dawn$/ })
  await expect(heading).toBeVisible()
  // The replacement in the scene: one change, not "in" and "hand" apart.
  const scene = changes.getByRole('region', { name: /^Changes to / })
  await expect(scene.getByRole('listitem')).toHaveCount(1)
  await expect(scene.getByRole('listitem', { name: 'Tracked change: in his hand. → under his seal.' })).toBeVisible()
  const comment = outside.getByRole('listitem', { name: 'A comment on the heading: House style: spell the chapter numbers out.' })
  await expect(comment).toContainText('Ana Editor:')
  await expect(comment).toContainText('The Gate')
  await heading.getByRole('button', { name: 'Dismiss' }).click()
  await expect(heading).toHaveCount(0)
  await expect(comment).toBeVisible()
  await comment.getByRole('button', { name: 'Dismiss' }).click()
  await expect(outside).toHaveCount(0)
  await scene.getByRole('button', { name: 'Accept all 1' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await expect.poll(() => prose(page)).toEqual(['Mira held a letter under his seal.', 'She did not look back.'])
})

test('the draft a file went out from says so, warns before it is deleted, and is marked while its changes wait; an italic typed with asterisks goes out as italic (round-trip-plan.md, T2.1, T2.3)', async ({ page }) => {
  test.setTimeout(120_000)
  const { main, sent } = await sendForEditing(page, [
    '# The Long Road', '', '## Chapter 1: Departure', '', 'Mira read the *Gazette* before dawn.', '', '## Chapter 2: The Gate', '', 'She did not look back.',
  ].join('\n'))
  // The asterisks are an italic run in the file, and gone.
  const xml = new TextDecoder().decode(readStoredZip(sent).get('word/document.xml'))
  expect(xml).toContain('<w:t xml:space="preserve">Gazette</w:t>')
  expect(xml).not.toContain('*Gazette*')

  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  const drafts = page.getByRole('dialog', { name: 'Drafts of the book' })
  const sentRow = drafts.getByRole('listitem').filter({ hasText: /^Sent for editing, \d{1,2} \w{3}, \d\d:\d\d/ })
  await expect(sentRow).toContainText(/Sent as .+\.docx/)
  await expect(sentRow).not.toContainText('Changes waiting from this draft')
  await sentRow.getByRole('button', { name: /^Delete/ }).click()
  const confirm = page.getByRole('dialog', { name: 'Delete this draft?' })
  await expect(confirm).toContainText('was made from this draft for an editor')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await page.keyboard.press('Escape')

  await bringIn(page, edit(sent, (swap) => {
    swap(run('She did not look back.'), `${run('She did')}<w:del w:id="92" ${W}><w:r><w:delText xml:space="preserve"> not</w:delText></w:r></w:del>${run(' look back.')}`)
  }, {}))
  // The italic came back as the scene writes it: no edit for it.
  const brought = page.getByRole('dialog', { name: 'Edits brought in' })
  await expect(brought.getByRole('status')).toContainText('1 change in 1 scene from Ana Editor')
  await brought.getByRole('button', { name: 'Later' }).click()
  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(sentRow).toContainText('Changes waiting from this draft')
  // Not the draft saved as the file came in, which nothing was made from.
  const before = drafts.getByRole('listitem').filter({ hasText: /^Before Ana Editor/ })
  await expect(before).not.toContainText('Changes waiting')
  // And deleting it is not warned about: nothing went out from it.
  await before.getByRole('button', { name: /^Delete/ }).click()
  await expect(page.getByRole('dialog', { name: 'Delete this draft?' })).toContainText('The draft is removed from this device. The book itself is not changed.')
  await expect(page.getByRole('dialog', { name: 'Delete this draft?' })).not.toContainText('for an editor')
})

test('a word the editor put in italics is said to be, in Changes, not shown as marks (round-trip-plan-2.md, T7.6; R2-6)', async ({ page }) => {
  test.setTimeout(120_000)
  const { sent } = await sendForEditing(page, [
    '# The Long Road', '', '## Chapter 1: Departure', '', 'The Kestrel sailed at dawn.', '', '## Chapter 2: The Gate', '', 'She did not look back.',
  ].join('\n'))
  await bringIn(page, edit(sent, (swap) => {
    // Italics put on a ship's name in Word, as formatting: no words changed.
    swap(run('The Kestrel sailed at dawn.'), `${run('The ')}<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Kestrel</w:t></w:r>${run(' sailed at dawn.')}`)
  }, {}))
  await page.getByRole('dialog', { name: 'Edits brought in' }).getByRole('button', { name: 'Review the changes' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  const item = changes.getByRole('listitem', { name: /^Untracked edit: italics changed after “The”$/ })
  await expect(item).toBeVisible()
  await expect(item).toContainText('Italics changed')
  await expect(item).not.toContainText('_')
  await item.getByRole('button', { name: 'Accept' }).click()
  await expect.poll(() => prose(page)).toEqual(['She did not look back.', 'The _Kestrel_ sailed at dawn.'])
})

test('the revision goes back marked against the editor’s file, and comes back with one change turned back and the thread answered (round-trip-plan-2.md, T5.3, T5.4)', async ({ page }) => {
  test.setTimeout(180_000)
  const { main, sent } = await sendForEditing(page)
  const exportDialog = page.getByRole('dialog', { name: 'Export manuscript' })
  const openExport = async () => {
    await main.getByRole('button', { name: 'Export', exact: true }).click()
    await exportDialog.getByRole('button', { name: 'Word', exact: true }).click()
    await exportDialog.getByRole('checkbox', { name: /For an editor/ }).check()
  }
  const markBack = exportDialog.getByRole('checkbox', { name: /Show my changes since/ })
  // Nothing has come back yet: nothing to mark against.
  await openExport()
  await expect(exportDialog.getByRole('checkbox', { name: /For an editor/ })).toBeChecked()
  await expect(markBack).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Round one back: a tracked insertion, taken, and a comment.
  await bringIn(page, edit(sent, (swap) => {
    swap(run('Mira left before dawn.'), `${run('Mira left before dawn')}<w:ins w:id="91" ${W}>${run(' in the rain')}</w:ins>${run('.')}`)
    swap(run('The road belonged to her now.'), commented('7', run('The road belonged to her now.')))
  }, { 7: 'Which road?' }))
  await page.getByRole('dialog', { name: 'Edits brought in' }).getByRole('button', { name: 'Later' }).click()
  await main.getByRole('button', { name: 'Changes · 1' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  await changes.getByRole('button', { name: 'Accept all 1' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await page.keyboard.press('Escape')

  // The writer's revision: a line of her own, and her answer to the comment.
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Not once.')
  await expect.poll(() => prose(page), { timeout: 10_000 }).toEqual(['Mira left before dawn in the rain.\n\nThe road belonged to her now.', 'She did not look back. Not once.'])
  await main.getByRole('button', { name: /^Notes/ }).click()
  const card = page.getByRole('complementary', { name: 'Notes' }).getByRole('listitem').filter({ hasText: 'Which road?' })
  await card.getByRole('button', { name: 'Reply' }).click()
  await card.getByRole('textbox', { name: 'Reply' }).fill('The coast road.')
  await card.getByRole('button', { name: 'Reply', exact: true }).last().click()
  await expect(card.getByRole('list', { name: 'Replies' })).toContainText('Me: The coast road.')

  // Sent back marked: offered, said what it holds, and signed with the byline.
  await openExport()
  await exportDialog.getByRole('textbox', { name: 'Author (optional)' }).fill('Nell Garrow')
  await expect(markBack).toBeChecked()
  await expect(exportDialog).toContainText('Show my changes since Ana Editor’s file (the-long-road-ana.docx)')
  await expect(exportDialog).toContainText('1 change and 1 comment thread, signed Nell Garrow')
  const pending = page.waitForEvent('download')
  await exportDialog.getByRole('button', { name: 'Download .docx' }).click()
  const marked = readStoredZip(new Uint8Array(await readFile(await (await pending).path())))
  await page.keyboard.press('Escape')
  const dec = new TextDecoder()
  const doc = dec.decode(marked.get('word/document.xml'))
  // Her line is her change; the editor's own, taken, is no change at all.
  expect(doc.match(/<w:ins [^>]*>(?:(?!<\/w:ins>).)*<\/w:ins>/g)).toEqual([expect.stringMatching(/w:author="Nell Garrow".*Not once\./)])
  expect(doc).toContain('in the rain')
  expect(dec.decode(marked.get('word/comments.xml'))).toMatch(/w:author="Ana Editor"[^>]*>.*Which road\?.*w:author="Nell Garrow"[^>]*>.*The coast road\./)
  await main.getByRole('button', { name: 'Drafts', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Drafts of the book' }).getByRole('list', { name: 'Drafts' })).toContainText('Sent marked')
  await page.keyboard.press('Escape')

  // Round two back: the editor turned her line back, answered her, and resolved the thread.
  const parts = new Map(marked)
  const enc = new TextEncoder()
  parts.set('word/document.xml', enc.encode(doc.replace(/<w:ins [^>]*w:author="Nell Garrow"[^>]*>(?:(?!<\/w:ins>).)*<\/w:ins>/, '')))
  const ex = dec.decode(marked.get('word/commentsExtended.xml'))
  const root = /<w15:commentEx w15:paraId="([0-9A-F]{8})" w15:done="0"\/>/.exec(ex)![1]
  parts.set('word/comments.xml', enc.encode(dec.decode(marked.get('word/comments.xml')).replace('</w:comments>', `<w:comment w:id="50" ${W} w:initials="AE"><w:p w14:paraId="5A000001" w14:textId="77777777">${run('Then say so in chapter 1.')}</w:p></w:comment></w:comments>`)))
  parts.set('word/commentsExtended.xml', enc.encode(ex.replace(/w15:done="0"/g, 'w15:done="1"').replace('</w15:commentsEx>', `<w15:commentEx w15:paraId="5A000001" w15:paraIdParent="${root}" w15:done="1"/></w15:commentsEx>`)))
  await bringIn(page, zipStore([...parts].map(([name, data]) => ({ name, data }))), 'the-long-road-ana-2.docx')
  await page.getByRole('dialog', { name: 'Edits brought in' }).getByRole('button', { name: 'Later' }).click()

  // The line turned back is a change to decide, said to be so; the editor's taken one is nothing.
  await main.getByRole('button', { name: 'Changes · 1' }).click()
  const back = changes.getByRole('listitem', { name: /^Turned back: / })
  // By the editor the file's comments name, though no tracked change of theirs is in the scene.
  await expect(back).toContainText('Ana Editor turned back your change')
  await expect(changes.getByRole('listitem', { name: /^(Tracked change|Untracked edit): / })).toHaveCount(0)
  await back.getByRole('button', { name: 'Accept' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await page.keyboard.press('Escape')
  await expect.poll(() => prose(page)).toEqual(['Mira left before dawn in the rain.\n\nThe road belonged to her now.', 'She did not look back.'])

  // The thread added to, not made again: her answer once, his under it, resolved.
  await expect.poll(() => page.evaluate(async () => {
    const db = (window as { __pwdb?: never }).__pwdb as unknown as Record<string, { toArray: () => Promise<Array<{ body: string; status: string; replies: Array<{ body: string; author: { kind: string } }> }>> }>
    return (await db.proseNotes.toArray()).map((n) => [n.body, n.status, n.replies.map((r) => `${r.author.kind}: ${r.body}`)])
  })).toEqual([['Which road?', 'resolved', ['me: The coast road.', 'editor: Then say so in chapter 1.']]])

  // The next revision goes back against the file that came back last.
  await openExport()
  await expect(exportDialog).toContainText('Show my changes since Ana Editor’s file (the-long-road-ana-2.docx)')
})

test('a submission sent back marked says its new length as a change against the count on the editor’s file (round-trip-plan-3.md, T8.4)', async ({ page }) => {
  test.setTimeout(180_000)
  const { main } = await sendForEditing(page)
  const exportDialog = page.getByRole('dialog', { name: 'Export manuscript' })
  /** The book as a submission, for an editor: the file's document. */
  const sendSubmission = async () => {
    await main.getByRole('button', { name: 'Export', exact: true }).click()
    await exportDialog.getByRole('button', { name: 'Word', exact: true }).click()
    await exportDialog.getByRole('checkbox', { name: /For an editor/ }).check()
    await exportDialog.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Submission', exact: true }).click()
    await exportDialog.getByRole('textbox', { name: 'Name on the byline' }).fill('Nell Garrow')
    const pending = page.waitForEvent('download')
    await exportDialog.getByRole('button', { name: 'Download .docx' }).click()
    const bytes = new Uint8Array(await readFile(await (await pending).path()))
    await page.keyboard.press('Escape')
    return { bytes, doc: new TextDecoder().decode(readStoredZip(bytes).get('word/document.xml')) }
  }

  // As first sent: the title page says the length, and nothing is marked.
  const first = await sendSubmission()
  expect(first.doc).toContain('about 100 words')
  expect(first.doc).not.toMatch(/<w:del |<w:ins /)

  // Back from the editor with one change, taken.
  await bringIn(page, edit(first.bytes, (swap) => {
    swap(run('Mira left before dawn.'), `${run('Mira left before dawn')}<w:ins w:id="91" ${W}>${run(' in the rain')}</w:ins>${run('.')}`)
  }, {}))
  await page.getByRole('dialog', { name: 'Edits brought in' }).getByRole('button', { name: 'Later' }).click()
  await main.getByRole('button', { name: 'Changes · 1' }).click()
  const changes = page.getByRole('dialog', { name: 'Changes from the editor' })
  await changes.getByRole('button', { name: 'Accept all 1' }).click()
  await expect(changes).toContainText('No changes waiting.')
  await page.keyboard.press('Escape')

  // The writer adds enough to change what the title page says: 150 words more.
  const more = Array.from({ length: 150 }, (_, i) => `word${i}`).join(' ')
  await page.locator('.cm-line', { hasText: 'She did not look back.' }).click()
  await page.keyboard.press('End')
  await page.keyboard.insertText(` ${more}`)
  await expect.poll(async () => (await prose(page)).join('|'), { timeout: 15_000 }).toContain('word149')

  // Sent back marked: the count on the editor's file out, the count now in, signed with the byline.
  const second = await sendSubmission()
  expect(second.doc).toMatch(/<w:del [^>]*w:author="Nell Garrow"[^>]*><w:r><w:delText xml:space="preserve">about 100 words<\/w:delText><\/w:r><\/w:del><w:ins [^>]*w:author="Nell Garrow"[^>]*><w:r><w:t xml:space="preserve">about 200 words<\/w:t><\/w:r><\/w:ins>/)
})
