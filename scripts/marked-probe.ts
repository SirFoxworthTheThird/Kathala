import { test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readEditedDocx } from '../src/lib/docxRead'
import { readZip, zipStore } from '../src/lib/zip'

/*
  What LibreOffice does with a file marked as T5 will mark it (round-trip-plan-2.md, T5.0).

  The export does not write tracked changes or comments yet. This builds, by
  hand, the shape T5.1 and T5.2 mean to write, on the app's own export of the
  loop's book (after T1.6, so its scene bookmarks are points):
  - the writer's tracked changes, signed with her name: a word replaced, and a
    paragraph inserted with its mark;
  - the editor's comments with her replies under them, as Word links them
    (`commentsExtended.xml`, `w15:paraIdParent`), one thread resolved
    (`w15:done="1"`).

  It opens the file in LibreOffice, headless, saves it as Word, and reads
  both the file as made and as saved, with the app's own reader, to see what
  survives: the threads, the done flags, the authors of the changes, and the
  scene bookmarks, which T1.6 found LibreOffice can break.

  A tool, not a test: CI has no LibreOffice. Run by hand:

    npm run probe:marked
*/

const BOOK = join(__dirname, '../src/lib/__tests__/fixtures/docx/run-2026-11-10-loop/round1-from-writer.docx')
const WRITER = 'w:author="Nell Garrow" w:date="2026-11-10T09:00:00Z"'
const W14 = 'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
const W15 = 'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
const WNS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`

/** The editor's two comments, each answered by the writer, the second thread resolved. */
const THREADS = [
  { id: 0, para: '0A000001', author: 'Jonah Pryce', initials: 'JP', text: 'Which hour? Ch. 2 says it lifted at dawn.' },
  { id: 1, para: '0A000002', author: 'Nell Garrow', initials: 'NG', text: 'Before dawn, both places now.', parent: '0A000001' },
  { id: 2, para: '0A000003', author: 'Jonah Pryce', initials: 'JP', text: 'Lovely. Keep.', done: true },
  { id: 3, para: '0A000004', author: 'Nell Garrow', initials: 'NG', text: 'Thank you.', parent: '0A000003', done: true },
]

function marked(source: Uint8Array): Promise<Uint8Array> {
  return readZip(source).then((zip) => {
    const dec = new TextDecoder()
    const enc = new TextEncoder()
    let doc = dec.decode(zip.get('word/document.xml'))
    const swap = (from: string, to: string) => {
      if (!doc.includes(from)) throw new Error(`not in the file: ${from.slice(0, 60)}`)
      doc = doc.replace(from, to)
    }
    // The writer's change: "wet wool" to "sodden wool", tracked, and both comment threads ranged on their words.
    const first = 'The fog came off the estuary in the hour before dawn and lay on the Long Quay like wet wool, and Tamsin Orrey counted hulls by the sound of them.'
    swap(run(first), [
      '<w:commentRangeStart w:id="0"/><w:commentRangeStart w:id="1"/>', run('The fog came off the estuary in the hour before dawn'), '<w:commentRangeEnd w:id="0"/><w:commentRangeEnd w:id="1"/>',
      '<w:r><w:commentReference w:id="0"/></w:r><w:r><w:commentReference w:id="1"/></w:r>',
      run(' and lay on the Long Quay like '),
      `<w:del w:id="101" ${WRITER}><w:r><w:delText xml:space="preserve">wet</w:delText></w:r></w:del>`,
      `<w:ins w:id="102" ${WRITER}>${run('sodden')}</w:ins>`,
      run(' wool, and '),
      '<w:commentRangeStart w:id="2"/><w:commentRangeStart w:id="3"/>', run('Tamsin Orrey counted hulls by the sound of them.'), '<w:commentRangeEnd w:id="2"/><w:commentRangeEnd w:id="3"/>',
      '<w:r><w:commentReference w:id="2"/></w:r><w:r><w:commentReference w:id="3"/></w:r>',
    ].join(''))
    // And a paragraph of hers inserted after the scene's first, its mark tracked too.
    const close = doc.indexOf('</w:p>', doc.indexOf('KathalaScene_0')) + '</w:p>'.length
    doc = doc.slice(0, close) + `<w:p><w:pPr><w:rPr><w:ins w:id="103" ${WRITER}/></w:rPr></w:pPr><w:ins w:id="104" ${WRITER}>${run('Somewhere a bell rang twice.')}</w:ins></w:p>` + doc.slice(close)

    const comments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments ${WNS} ${W14}>${THREADS.map((c) =>
      `<w:comment w:id="${c.id}" w:author="${c.author}" w:date="2026-11-10T09:00:00Z" w:initials="${c.initials}"><w:p w14:paraId="${c.para}" w14:textId="77777777">${run(c.text)}</w:p></w:comment>`).join('')}</w:comments>`
    const extended = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w15:commentsEx ${W15}>${THREADS.map((c) =>
      `<w15:commentEx w15:paraId="${c.para}"${c.parent ? ` w15:paraIdParent="${c.parent}"` : ''} w15:done="${c.done ? 1 : 0}"/>`).join('')}</w15:commentsEx>`
    const types = dec.decode(zip.get('[Content_Types].xml')).replace('</Types>',
      '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' +
      '<Override PartName="/word/commentsExtended.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml"/></Types>')
    const rels = dec.decode(zip.get('word/_rels/document.xml.rels')).replace('</Relationships>',
      '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>' +
      '<Relationship Id="rIdCommentsEx" Type="http://schemas.microsoft.com/office/2011/relationships/commentsExtended" Target="commentsExtended.xml"/></Relationships>')
    const parts = new Map(zip)
    parts.set('word/document.xml', enc.encode(doc))
    parts.set('word/comments.xml', enc.encode(comments))
    parts.set('word/commentsExtended.xml', enc.encode(extended))
    parts.set('[Content_Types].xml', enc.encode(types))
    parts.set('word/_rels/document.xml.rels', enc.encode(rels))
    return zipStore([...parts].map(([name, data]) => ({ name, data })))
  })
}

/** What survives, read from the file: by the app's reader, and from the parts it does not read yet. */
async function measure(bytes: Uint8Array) {
  const doc = await readEditedDocx(bytes)
  const zip = await readZip(bytes)
  const text = (name: string) => (zip.has(name) ? new TextDecoder().decode(zip.get(name)) : '')
  const xml = text('word/document.xml')
  const extended = text('word/commentsExtended.xml')
  const comments = text('word/comments.xml')
  // Done, by comment: its last paragraph's paraId, and that paraId's commentEx. No flag, or no entry, is open: LibreOffice writes none for those.
  const doneOf = new Map<string, string>()
  for (const m of extended.matchAll(/<w15:commentEx [^>]*\/>/g)) {
    const para = /w15:paraId="([^"]+)"/.exec(m[0])?.[1]
    if (para) doneOf.set(para, /w15:done="1"/.test(m[0]) ? '1' : '0')
  }
  const done: Record<string, string> = {}
  for (const m of comments.matchAll(/<w:comment [^>]*w:id="(\d+)"[\s\S]*?<\/w:comment>/g)) {
    const paras = [...m[0].matchAll(/w14:paraId="([^"]+)"/g)].map((p) => p[1])
    done[m[1]] = doneOf.get(paras[paras.length - 1] ?? '') ?? '0'
  }
  const starts = [...xml.matchAll(/<w:bookmarkStart [^>]*w:name="(KathalaScene_\d+)"/g)].map((m) => m[1])
  const ends = (xml.match(/<w:bookmarkEnd /g) ?? []).length
  return {
    comments: doc.comments.map((c) => `${c.id}${c.parentId ? `→${c.parentId}` : ''} ${c.author}: ${c.text}`),
    done,
    changeAuthors: [...new Set([...xml.matchAll(/<w:(?:ins|del) [^>]*w:author="([^"]*)"/g)].map((m) => m[1]))],
    insertions: (xml.match(/<w:ins /g) ?? []).length,
    deletions: (xml.match(/<w:del /g) ?? []).length,
    bookmarks: { starts: starts.length, names: new Set(starts).size, ends },
    parts: [...zip.keys()].filter((n) => /comment|people/.test(n)).sort(),
  }
}

test('a marked file through LibreOffice', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'marked-probe-'))
  const made = await marked(new Uint8Array(readFileSync(BOOK)))
  writeFileSync(join(dir, 'marked.docx'), made)
  execFileSync('soffice', [
    `-env:UserInstallation=file://${join(dir, 'profile')}`, '--headless', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', join(dir, 'out'), join(dir, 'marked.docx'),
  ], { stdio: 'ignore', timeout: 120_000 })
  const saved = new Uint8Array(readFileSync(join(dir, 'out', 'marked.docx')))
  const before = await measure(made)
  const after = await measure(saved)
  process.stdout.write(`\nMARKED-PROBE ${dir}\n${JSON.stringify({ made: before, savedByLibreOffice: after }, null, 2)}\n`)
})

/*
  And the file the export itself now makes (T5.1–T5.2): the loop's revision,
  marked against the editor's round-1 file as he sent it, with two of his
  threads answered, one resolved — through LibreOffice, and read back.
*/
test('the export’s own marked file through LibreOffice', async () => {
  const { compileDocx } = await import('../src/lib/manuscriptExport')
  const { docScenes } = await import('../src/lib/docxEdits')
  const { rendered } = await import('../src/lib/docxImport')
  const loop = join(__dirname, '../src/lib/__tests__/fixtures/docx/run-2026-11-10-loop')
  const draftOf = (r: number) => JSON.parse(readFileSync(join(loop, `draft-round${r}.json`), 'utf8')) as { id: string; book: { chapters: Array<{ id: string; number: number; title: string; scenes: Array<{ id: string; title: string; text: string }> }> } }
  const one = draftOf(1)
  const theirs = await readEditedDocx(new Uint8Array(readFileSync(join(loop, 'round1-from-editor.docx'))))
  const sentBack = new Map(docScenes(theirs).map((s) => [one.book.chapters.flatMap((c) => c.scenes)[s.index!].id, s.edited]))
  const two = draftOf(2)
  const scenes = two.book.chapters.flatMap((c) => c.scenes)
  const index = new Map(scenes.map((s, i) => [s.id, i]))
  const first = scenes[0]
  const bytes = compileDocx({
    totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
    chapters: two.book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
      scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
  }, {
    submission: { name: 'Nell Garrow' },
    forEditing: { draftId: two.id, worldId: 'W', sceneIndex: (id) => index.get(id), marked: {
      author: 'Nell Garrow', date: '2026-11-10T09:00:00Z', base: (id) => sentBack.get(id) ?? null,
      threads: [
        { eventId: first.id, quote: first.text.split(/\s+/).slice(0, 4).join(' '), done: false, comments: [{ author: 'Jonah Pryce', initials: 'JP', text: 'Which hour?' }, { author: 'Nell Garrow', initials: 'NG', text: 'Before dawn, both places.' }] },
        { eventId: first.id, quote: 'words long since rewritten', done: true, comments: [{ author: 'Jonah Pryce', initials: 'JP', text: 'Lovely.' }, { author: 'Nell Garrow', initials: 'NG', text: 'Thank you.' }] },
      ],
    } },
  })
  const dir = mkdtempSync(join(tmpdir(), 'marked-probe-'))
  writeFileSync(join(dir, 'export.docx'), bytes)
  execFileSync('soffice', [`-env:UserInstallation=file://${join(dir, 'profile')}`, '--headless', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', join(dir, 'out'), join(dir, 'export.docx')], { stdio: 'ignore', timeout: 180_000 })
  const saved = new Uint8Array(readFileSync(join(dir, 'out', 'export.docx')))
  const scenesRight = async (b: Uint8Array) => {
    const parts = docScenes(await readEditedDocx(b))
    const plain = (t: string) => rendered(t).replace(/[*_]/g, '')
    return {
      scenes: parts.length,
      unplaced: parts.filter((p) => p.index === null).length,
      rejectedIsHis: parts.filter((p) => p.index !== null && plain(p.original) === plain(sentBack.get(scenes[p.index].id) ?? '')).length,
      acceptedIsHers: parts.filter((p) => p.index !== null && plain(p.edited) === plain(scenes[p.index].text)).length,
    }
  }
  const report = {
    made: { ...(await measure(bytes)), ...(await scenesRight(bytes)) },
    savedByLibreOffice: { ...(await measure(saved)), ...(await scenesRight(saved)) },
  }
  for (const r of Object.values(report)) r.comments = r.comments.map((c) => c.slice(0, 70))
  process.stdout.write(`\nEXPORT-PROBE ${dir}\n${JSON.stringify(report, null, 2)}\n`)
})
