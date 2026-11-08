import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readEditedDocx } from '@/lib/docxRead'
import { docScenes, hunks, shownChange } from '@/lib/docxEdits'
import { zipStore } from '@/lib/zip'
import { readZip } from '@/lib/zip'

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, 'fixtures/docx', name)))

/*
  edited-libreoffice.docx is marked.docx (an export marked for editing, draft
  DRAFT123, scenes e1 and e2 as KathalaScene_0 and _1) edited in LibreOffice
  by scripts/docx-fixture-edit.py, as "Ana Editor":
  - tracking off: "He had a ledger" -> "He held a ledger";
  - tracking on: " in the rain" inserted after "at dawn", "twice, and " deleted;
  - a comment, "Which boy? Name him.", across "The boy waited on the quay".
*/
describe('an edited file from LibreOffice', () => {
  it('is read: the draft and book it came from, each scene as it started and as it reads, the comment and who made it', async () => {
    const doc = await readEditedDocx(fixture('edited-libreoffice.docx'))
    expect([doc.draftId, doc.worldId]).toEqual(['DRAFT123', 'W1'])
    const scenes = docScenes(doc)
    expect(scenes.map((s) => s.index)).toEqual([0, 1])
    expect(scenes[0]).toMatchObject({
      original: 'The ferry left at dawn.\n\nMira counted the crates twice, and _twice_ the number came out wrong.',
      edited: 'The ferry left at dawn in the rain.\n\nMira counted the crates _twice_ the number came out wrong.',
      authors: ['Ana Editor'],
    })
    // LibreOffice lost the second scene's bookmark end and opened it again on the next paragraph: still one scene.
    expect(scenes[1].original).toBe('The boy waited on the quay.\n\nHe held a ledger under his arm.')
    expect(scenes[1].edited).toBe(scenes[1].original)
    const [c] = scenes[1].comments
    expect(scenes[1].edited.slice(c.start, c.end)).toBe('The boy waited on the quay')
    expect(doc.comments).toEqual([{ id: c.id, author: 'Ana Editor', text: 'Which boy? Name him.' }])
  })

  it('its tracked changes are hunks, each with words to find and a little text either side', async () => {
    const [s] = docScenes(await readEditedDocx(fixture('edited-libreoffice.docx')))
    const hs = hunks(s.original, s.edited)
    expect(hs.map((h) => [h.before, h.after])).toEqual([
      ['dawn.', 'dawn in the rain.'],
      ['twice, and ', ''],
    ])
    expect(hs[0].prefix.endsWith('The ferry left at ')).toBe(true)
    expect(hs[1].suffix.startsWith('_twice_ the number')).toBe(true)
  })

  it('words changed with only a space between them are one change; words kept between two changes part them', () => {
    expect(hunks('The road belonged to her now.', 'The road was hers now.').map((h) => [h.before, h.after])).toEqual([
      ['belonged to her', 'was hers'],
    ])
    expect(hunks('The road belonged to her now.', 'The path belonged to her then.').map((h) => [h.before, h.after])).toEqual([
      ['road', 'path'],
      ['now.', 'then.'],
    ])
  })

  it('a change is shown without the whole words its sides share, and never cut inside a word', () => {
    expect(shownChange('dawn.', 'dawn in the rain.')).toEqual({ lead: 'dawn', out: '', in: ' in the rain', tail: '.' })
    expect(shownChange('very quietly crying.', 'not crying, not yet.')).toEqual({ lead: '', out: 'very quietly crying', in: 'not crying, not yet', tail: '.' })
    expect(shownChange('was', 'were')).toEqual({ lead: '', out: 'was', in: 'were', tail: '' })
    expect(shownChange('twice, and ', '')).toEqual({ lead: '', out: 'twice, and ', in: '', tail: '' })
  })

  it('the marked export it came from is read the same way, every scene unchanged', async () => {
    const scenes = docScenes(await readEditedDocx(fixture('marked.docx')))
    expect(scenes.map((s) => [s.index, s.original === s.edited])).toEqual([[0, true], [1, true]])
  })
})

/** A Word file of one document part, stored, as a test can write one. */
function wordFile(body: string, extra: Record<string, string> = {}): Uint8Array {
  const enc = new TextEncoder()
  const doc = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>${body}<w:sectPr/></w:body></w:document>`
  return zipStore([{ name: 'word/document.xml', data: enc.encode(doc) }, ...Object.entries(extra).map(([name, xml]) => ({ name, data: enc.encode(xml) }))])
}
const P = (inner: string, style = 'Normal') => `<w:p w:rsidR="00A1"><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inner}</w:p>`
const R = (t: string, italic = false) => `<w:r w:rsidRPr="00B2">${italic ? '<w:rPr><w:i/></w:rPr>' : ''}<w:t xml:space="preserve">${t}</w:t></w:r>`

describe('Word-shaped files', () => {
  it('a bookmark between paragraphs starts its scene; spell-check marks and split runs say nothing; a heading ends a scene', async () => {
    const doc = await readEditedDocx(wordFile(
      P(R('Chapter One'), 'Heading1') +
      '<w:bookmarkStart w:id="0" w:name="KathalaScene_4"/>' +
      P(`${R('She ')}<w:proofErr w:type="spellStart"/>${R('wai')}${R('ted')}<w:proofErr w:type="spellEnd"/>${R(' by the ')}${R('door', true)}${R('.')}`) +
      P(R('* * *'), 'SceneBreak') +
      P(R('No bookmark here.')),
    ))
    expect(docScenes(doc).map((s) => [s.index, s.edited])).toEqual([[4, 'She waited by the _door_.'], [null, 'No bookmark here.']])
  })

  it('a moved paragraph is deleted where it was and inserted where it went; a formatting change alone is not a change', async () => {
    const doc = await readEditedDocx(wordFile(
      '<w:bookmarkStart w:id="0" w:name="KathalaScene_0"/>' +
      P(`<w:moveFrom w:id="1" w:author="Ana">${R('Rain fell.')}</w:moveFrom>`) +
      P(R('She waited.')) +
      P(`<w:moveTo w:id="2" w:author="Ana">${R('Rain fell.')}</w:moveTo>`) +
      P(`<w:r><w:rPr><w:b/><w:rPrChange w:id="3" w:author="Ana"><w:rPr/></w:rPrChange></w:rPr><w:t>Bold now.</w:t></w:r>`),
    ))
    const [s] = docScenes(doc)
    expect(s.original).toBe('Rain fell.\n\nShe waited.\n\nBold now.')
    expect(s.edited).toBe('She waited.\n\nRain fell.\n\nBold now.')
    expect(hunks(s.original, s.edited).map((h) => [h.before, h.after])).toEqual([
      ['Rain fell.', ''],
      ['She waited.', 'She waited.\n\nRain fell.'],
    ])
  })

  it('a reply in Word answers its comment (commentsExtended), and italics added by the editor come back as markup', async () => {
    const comments = `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">` +
      `<w:comment w:id="5" w:author="Ana"><w:p w14:paraId="AAA1"><w:r><w:t>Too long?</w:t></w:r></w:p></w:comment>` +
      `<w:comment w:id="6" w:author="Ines"><w:p w14:paraId="BBB2"><w:r><w:t>Cut in half.</w:t></w:r></w:p></w:comment></w:comments>`
    const extended = `<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w15:commentEx w15:paraId="AAA1" w15:done="0"/><w15:commentEx w15:paraId="BBB2" w15:paraIdParent="AAA1" w15:done="0"/></w15:commentsEx>`
    const doc = await readEditedDocx(wordFile(
      '<w:bookmarkStart w:id="0" w:name="KathalaScene_0"/>' +
      P(`<w:commentRangeStart w:id="5"/>${R('The long night.')}<w:commentRangeEnd w:id="5"/><w:ins w:id="7" w:author="Ana">${R('Endless', true)}${R('.')}</w:ins>`),
      { 'word/comments.xml': comments, 'word/commentsExtended.xml': extended },
    ))
    expect(doc.comments).toEqual([{ id: '5', author: 'Ana', text: 'Too long?' }, { id: '6', author: 'Ines', text: 'Cut in half.', parentId: '5' }])
    const [s] = docScenes(doc)
    expect(s.edited).toBe('The long night._Endless_.')
    expect(s.edited.slice(s.comments[0].start, s.comments[0].end)).toBe('The long night.')
  })

  it('refuses a file that is not a Word document, and reads a deflated archive', async () => {
    await expect(readEditedDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow('not a Word file')
    await expect(readEditedDocx(zipStore([{ name: 'x.txt', data: new Uint8Array([1]) }]))).rejects.toThrow('no document')
    // The LibreOffice file's parts are deflated: read, not refused.
    expect((await readZip(fixture('edited-libreoffice.docx'))).get('word/document.xml')!.length).toBeGreaterThan(1000)
  })
})
