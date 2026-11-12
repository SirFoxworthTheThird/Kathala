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

  The third test, at the end, asks LibreOffice itself to accept and to reject
  every change (round-trip-plan-3.md, T8.0). It needs LibreOffice's Python
  bridge as well (python3-uno), for `scripts/lo-views.py`.
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

/*
  LibreOffice's own accept-all and reject-all (round-trip-plan-3.md, T8.0):
  what the second loop's editor did to check a marked revision, and where two
  of its eight new paragraphs came back as empty ones (editor-run-2026-11-10-loop2.md, E-6).

  The tests above read a LibreOffice-saved file with the app's reader, which
  is kinder: it never found this. Here LibreOffice reads the file as made,
  makes every change or none (`scripts/lo-views.py`), and its text is compared
  with the same book unmarked, through the same LibreOffice: rejected against
  the base, accepted against the book.
  - The run's two marked files, remade from the drafts in the fixtures.
  - One-case books, a scene or two of a few paragraphs, to find which form
    of a new paragraph's mark it is.
*/
test('LibreOffice’s own reject-all and accept-all of a marked file', async () => {
  const { compileDocx } = await import('../src/lib/manuscriptExport')
  const dir = mkdtempSync(join(tmpdir(), 'marked-views-'))
  type Book = { chapters: Array<{ id: string; number: number; title: string; scenes: Array<{ id: string; title: string; text: string }> }> }
  const built = (book: Book) => {
    const scenes = book.chapters.flatMap((c) => c.scenes)
    return {
      totalWords: 0, totalScenes: scenes.length, writtenScenes: scenes.length,
      chapters: book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: c.scenes.length,
        scenes: c.scenes.map((s) => ({ eventId: s.id, title: s.title, text: s.text, wordCount: 0, written: true, status: 'draft' as const })) })),
    }
  }
  type Thread = { eventId: string; quote: string; done: boolean; comments: Array<{ author: string; initials: string; text: string }> }
  const thread = (quote: string, eventId = 'e1'): Thread => ({ eventId, quote, done: false, comments: [{ author: 'Ines Marlowe', initials: 'IM', text: 'Which stair?' }, { author: 'Elin Ashgrove', initials: 'EA', text: 'The back one.' }] })
  /** `book` unmarked, and marked against `base`, with the editor's threads if any: the three files of a case. */
  const files = (name: string, base: Book, book: Book, threads: Thread[] = [], layout: { submission?: { name: string; contact: string; wordCount?: string } } = {}, titleCount?: string) => {
    const index = new Map(book.chapters.flatMap((c) => c.scenes).map((s, i) => [s.id, i]))
    const was = new Map(base.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.text]))
    const editing = { draftId: 'D', worldId: 'W', sceneIndex: (id: string) => index.get(id) }
    // The base says its own length on its title page, where the case gives one: what the marked file's count is a change against.
    writeFileSync(join(dir, `${name}-base.docx`), compileDocx(built(base), titleCount && layout.submission ? { submission: { ...layout.submission, wordCount: titleCount } } : layout))
    writeFileSync(join(dir, `${name}-book.docx`), compileDocx(built(book), layout))
    writeFileSync(join(dir, `${name}-marked.docx`), compileDocx(built(book), { ...layout, forEditing: { ...editing, marked: { author: 'Elin Ashgrove', date: '2026-11-12T09:00:00Z', base: (id) => was.get(id) ?? null, threads, ...(titleCount ? { titleCount } : {}) } } }))
    return name
  }

  const loop = join(__dirname, '../src/lib/__tests__/fixtures/docx/run-2026-11-12-loop2')
  const draft = (n: string) => (JSON.parse(readFileSync(join(loop, `draft-${n}.json`), 'utf8')) as { book: Book }).book
  const A = 'The ninth bell had already gone when she climbed the back stair of the Customs House.'
  const A2 = 'The ninth bell had long gone when she climbed the back stair of the Customs House.'
  const B = 'Somewhere below, a door was shut with more care than a door needs.'
  const B2 = 'Nobody on the stair said anything about it, then or afterwards.'
  const C = 'Low water was at a quarter past, and the whole city knew it.'
  // A paragraph whose last sentence is made a paragraph of its own: the one before then ends in words put in.
  const SPLIT = `${A.slice(0, -1)}, and she said, without turning round, "There is someone on the stair."`
  const SPLIT1 = `${A.slice(0, -1)}, and she said, without turning round:`
  const SPLIT2 = '"There is someone on the stair."'
  const one = (...paras: string[]): Book => ({ chapters: [{ id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: paras.join('\n\n') }] }] })
  const two = (first: string[], second: string[], chapters = 1): Book => (chapters === 1
    ? { chapters: [{ id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: first.join('\n\n') }, { id: 'e2', title: 'Two', text: second.join('\n\n') }] }] }
    : { chapters: [{ id: 'c1', number: 1, title: 'The Ninth Bell', scenes: [{ id: 'e1', title: 'One', text: first.join('\n\n') }] }, { id: 'c2', number: 2, title: 'Low Water', scenes: [{ id: 'e2', title: 'Two', text: second.join('\n\n') }] }] })
  const SUBMISSION = { submission: { name: 'Elin Ashgrove', contact: 'elin.ashgrove@example.com' } }
  const { markedParagraphs } = await import('../src/lib/markedDocx')
  /** A thread on each paragraph that stands and has a new paragraph after it: on the first words of its longest kept stretch. */
  const threadsBeforeNew = (base: Book, book: Book): Thread[] => {
    const was = new Map(base.chapters.flatMap((c) => c.scenes).map((sc) => [sc.id, sc.text]))
    const out: Thread[] = []
    for (const sc of book.chapters.flatMap((c) => c.scenes)) {
      const ps = markedParagraphs(was.get(sc.id) ?? null, sc.text)
      ps.forEach((p, k) => {
        if (p.mark !== 'same' || ps[k + 1]?.mark !== 'ins') return
        const kept = p.runs.filter((r) => r.kind === 'same').map((r) => r.text).sort((x, y) => y.length - x.length)[0] ?? ''
        const quote = kept.trim().split(/\s+/).slice(0, 4).join(' ')
        if (quote) out.push(thread(quote, sc.id))
      })
    }
    return out
  }
  const cases = [
    // As the run sent them: a submission, so that its scene breaks and its last line are the same lines.
    files('round2', draft('back-1'), draft('marked-2'), [], SUBMISSION),
    files('round3', draft('back-2'), draft('marked-3'), [], SUBMISSION),
    files('new-after-unchanged', one(A, C), one(A, B, C)),
    files('new-after-changed', one(A, C), one(A2, B, C)),
    files('new-at-scene-start', one(A, C), one(B, A, C)),
    files('new-at-scene-end', one(A, C), one(A, C, B)),
    files('two-new-after-unchanged', one(A, C), one(A, B, B2, C)),
    files('new-at-end-before-a-scene', two([A, C], [C]), two([A, C, B], [C])),
    files('new-at-end-before-a-chapter', two([A, C], [C], 2), two([A, C, B], [C], 2)),
    files('taken-out', one(A, B, C), one(A, C)),
    // With a thread: on the paragraph before the new one, in its middle and at its end; on the one after; and with nothing new.
    files('commented-nothing-new', one(A, C), one(A, C), [thread('climbed the back stair')]),
    files('new-after-commented-middle', one(A, C), one(A, B, C), [thread('climbed the back stair')]),
    files('new-after-commented-end', one(A, C), one(A, B, C), [thread('the Customs House.')]),
    files('new-after-commented-changed', one(A, C), one(A2, B, C), [thread('climbed the back stair')]),
    files('new-before-commented', one(A, C), one(A, B, C), [thread('the whole city knew it')]),
    files('new-itself-commented', one(A, C), one(A, B, C), [thread('with more care')]),
    files('two-new-after-commented', one(A, C), one(A, B, B2, C), [thread('climbed the back stair')]),
    files('taken-out-after-commented', one(A, B, C), one(A, C), [thread('climbed the back stair')]),
    // A thread whose words are gone, at the scene's start, and a new paragraph after the first.
    files('new-after-rewritten-thread', one(A, C), one(A, B, C), [thread('words long since rewritten')]),
    // The paragraph before ends in a change, right against its break: with a thread, and without.
    files('ends-put-in', one(A, C), one(`${A} She counted them twice.`, B, C)),
    files('ends-put-in-commented', one(A, C), one(`${A} She counted them twice.`, B, C), [thread('climbed the back stair')]),
    files('ends-taken-out', one(`${A} She counted them twice.`, C), one(A, B, C)),
    files('ends-taken-out-commented', one(`${A} She counted them twice.`, C), one(A, B, C), [thread('climbed the back stair')]),
    files('ends-replaced', one(SPLIT, C), one(SPLIT1, SPLIT2, C)),
    files('ends-replaced-commented', one(SPLIT, C), one(SPLIT1, SPLIT2, C), [thread('climbed the back stair')]),
    files('ends-replaced-at-scene-end', two([C, SPLIT], [C]), two([C, SPLIT1, SPLIT2], [C])),
    // The run's two revisions again, with a thread on every paragraph a new one follows: the worst the rule can meet.
    files('round2-a-thread-before-every-new', draft('back-1'), draft('marked-2'), threadsBeforeNew(draft('back-1'), draft('marked-2')), SUBMISSION),
    files('round3-a-thread-before-every-new', draft('back-2'), draft('marked-3'), threadsBeforeNew(draft('back-2'), draft('marked-3')), SUBMISSION),
    // The title page's count, changed since the base: a submission, the base saying 1,200 words.
    files('title-count', one(A, C), one(A, B, C), [], { submission: { name: 'Elin Ashgrove', contact: 'elin.ashgrove@example.com', wordCount: 'about 1,300 words' } }, 'about 1,200 words'),
  ]
  // The run's own two files, as the writer sent them, with their threads: against the remade base and book.
  for (const [n, file] of [['round2', 'round2-from-writer.docx'], ['round3', 'round3-from-writer.docx']] as const) {
    for (const part of ['base', 'book']) writeFileSync(join(dir, `${n}-as-sent-${part}.docx`), readFileSync(join(dir, `${n}-${part}.docx`)))
    writeFileSync(join(dir, `${n}-as-sent-marked.docx`), readFileSync(join(loop, file)))
    cases.push(`${n}-as-sent`)
  }
  /*
    Each form of a new paragraph's mark where it goes wrong, forced by hand on a
    file the export now writes the other way (T8.4):
    - Word's, the mark on the break before, after a paragraph with a thread;
    - the mark on the new paragraph's own break, after a paragraph that ends
      in words put in.
  */
  {
    const MARK = /<w:pPr><w:rPr>(<w:ins [^>]*\/>)<\/w:rPr><\/w:pPr>/
    const reform = async (from: string, to: string, change: (before: string, fresh: string, mark: string) => [string, string]) => {
      const zip = await readZip(new Uint8Array(readFileSync(join(dir, `${from}-marked.docx`))))
      const doc = new TextDecoder().decode(zip.get('word/document.xml'))
      const paras = [...doc.matchAll(/<w:p>.*?<\/w:p>/gs)]
      // The first new paragraph: all of its words put in. And the paragraph before it.
      const k = paras.findIndex((m) => /<w:ins [^>]*><w:r>/.test(m[0]) && !/<w:t[ >]/.test(m[0].replace(/<w:pPr>.*?<\/w:pPr>/s, '').replace(/<w:ins [^>]*>.*?<\/w:ins>/gs, '')))
      const mark = MARK.exec(paras[k - 1][0]) ?? MARK.exec(paras[k][0])
      if (k < 1 || !mark) throw new Error(`no new paragraph with a marked break in ${from}`)
      const [before, fresh] = change(paras[k - 1][0].replace(MARK, ''), paras[k][0].replace(MARK, ''), `<w:pPr><w:rPr>${mark[1]}</w:rPr></w:pPr>`)
      const parts = new Map(zip)
      parts.set('word/document.xml', new TextEncoder().encode(doc.slice(0, paras[k - 1].index) + before + fresh + doc.slice(paras[k].index! + paras[k][0].length)))
      writeFileSync(join(dir, `${to}-marked.docx`), zipStore([...parts].map(([name, data]) => ({ name, data }))))
      for (const part of ['base', 'book']) writeFileSync(join(dir, `${to}-${part}.docx`), readFileSync(join(dir, `${from}-${part}.docx`)))
      cases.push(to)
    }
    const marked = (p: string, mark: string) => p.replace('<w:p>', `<w:p>${mark}`)
    await reform('new-after-commented-middle', 'FORCED-words-form-after-a-thread', (before, fresh, mark) => [marked(before, mark), fresh])
    await reform('ends-put-in', 'FORCED-own-break-after-words-put-in', (before, fresh, mark) => [before, marked(fresh, mark)])
  }
  const all = cases.flatMap((n) => [`${n}-base.docx`, `${n}-book.docx`, `${n}-marked.docx`]).map((f) => join(dir, f))
  // And each marked file saved by LibreOffice, for the app's own reader to read as it would coming back.
  execFileSync('soffice', [`-env:UserInstallation=file://${join(dir, 'profile-save')}`, '--headless', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', join(dir, 'saved'), ...cases.map((n) => join(dir, `${n}-marked.docx`))], { stdio: 'ignore', timeout: 600_000 })
  execFileSync('python3', [join(__dirname, 'lo-views.py'), join(dir, 'profile'), '2031', ...all], { stdio: 'ignore', timeout: 900_000 })

  const lines = (file: string, view: string) => readFileSync(join(dir, `${file}.docx.${view}.txt`), 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, '').replace(/\n+$/, '').split('\n')
  /** What `got` has that `want` has not, and the other way: by line, in order. */
  const against = (gotAll: string[], wantAll: string[]) => {
    // From the first chapter's heading: the run's files have a title page the remade ones have not.
    const body = (ls: string[]) => ls.slice(Math.max(0, ls.findIndex((l) => l.startsWith('Ch. 1'))))
    const got = body(gotAll)
    const want = body(wantAll)
    const extraEmpty = got.filter((l) => !l.trim()).length - want.filter((l) => !l.trim()).length
    const g = got.filter((l) => l.trim())
    const w = want.filter((l) => l.trim())
    const differing = g.length === w.length ? g.filter((l, i) => l !== w[i]).length : Math.abs(g.length - w.length)
    return { same: extraEmpty === 0 && differing === 0, extraEmpty, differing, firstDiff: g.find((l, i) => l !== w[i])?.slice(0, 60) }
  }
  /*
    Saved by LibreOffice and read by the app, as a file coming back is: every
    scene's text with the changes rejected and accepted, and with the writer's
    own made (`withChangesMade`), which is how bringing a marked file in reads it.
  */
  const { docScenes, withChangesMade } = await import('../src/lib/docxEdits')
  const { rendered } = await import('../src/lib/docxImport')
  const plain = (t: string) => rendered(t).replace(/[*_]/g, '')
  const byApp = async (n: string) => {
    const doc = await readEditedDocx(new Uint8Array(readFileSync(join(dir, 'saved', `${n}-marked.docx`))))
    const text = async (f: string) => docScenes(await readEditedDocx(new Uint8Array(readFileSync(join(dir, `${f}.docx`))))).map((p) => plain(p.edited)).join('\n\n#\n\n')
    const scenes = (parts: Array<{ original: string; edited: string }>, view: 'original' | 'edited') => parts.map((p) => plain(p[view])).join('\n\n#\n\n')
    const parts = docScenes(doc)
    return {
      rejected: scenes(parts, 'original') === await text(`${n}-base`),
      accepted: scenes(parts, 'edited') === await text(`${n}-book`),
      writersMade: scenes(docScenes(withChangesMade(doc, 'Elin Ashgrove')), 'original') === await text(`${n}-book`),
    }
  }
  const table: Array<{ case: string; rejectedIsBase: ReturnType<typeof against>; acceptedIsBook: ReturnType<typeof against>; savedReadByApp: Awaited<ReturnType<typeof byApp>> | null }> = []
  for (const n of cases) {
    table.push({
      case: n,
      rejectedIsBase: against(lines(`${n}-marked`, 'rejected'), lines(`${n}-base`, 'accepted')),
      acceptedIsBook: against(lines(`${n}-marked`, 'accepted'), lines(`${n}-book`, 'accepted')),
      // The run's files as sent hold the run's own older marks and threads; the app reads those in `markedRunFiles.test.ts`.
      savedReadByApp: n.endsWith('-as-sent') ? null : await byApp(n),
    })
  }
  const ok = (r: (typeof table)[number]) => r.rejectedIsBase.same && r.acceptedIsBook.same && (!r.savedReadByApp || (r.savedReadByApp.rejected && r.savedReadByApp.accepted && r.savedReadByApp.writersMade))
  process.stdout.write(`\nVIEWS-PROBE ${dir}\n${table.map((r) => `${ok(r) ? 'ok ' : 'NO '} ${r.case.padEnd(38)} rejected: ${JSON.stringify(r.rejectedIsBase)}  accepted: ${JSON.stringify(r.acceptedIsBook)}  saved, read by the app: ${JSON.stringify(r.savedReadByApp)}`).join('\n')}\n`)
  // The title page, which the comparison above leaves out: its first line, each way.
  const first = (view: string) => lines('title-count-marked', view)[0]
  process.stdout.write(`TITLE-COUNT rejected: ${JSON.stringify(first('rejected'))} (the base: ${JSON.stringify(lines('title-count-base', 'accepted')[0])})  accepted: ${JSON.stringify(first('accepted'))} (the book: ${JSON.stringify(lines('title-count-book', 'accepted')[0])})\n`)
})

/*
  A comment made in LibreOffice with nothing selected (round-trip-plan-3.md, T9.1).

  Word puts every comment on a range of words. Asked what LibreOffice does:
  it saves such a comment as a reference alone, with no range, and saves one
  made on words with its range. The app's reader placed a comment by its range,
  so the first kind never came in. `scripts/lo-comment.py` makes both, in the
  second loop's first file, and this says what is in each and how the app reads it.
*/
test('a comment made in LibreOffice with nothing selected', async () => {
  const { docScenes } = await import('../src/lib/docxEdits')
  const dir = mkdtempSync(join(tmpdir(), 'marked-comment-'))
  const book = join(__dirname, '../src/lib/__tests__/fixtures/docx/run-2026-11-12-loop2/round1-from-writer.docx')
  const made: Record<string, unknown> = {}
  for (const [name, port, ...how] of [['nothing-selected', '2036', 'point'], ['on-its-words', '2037']]) {
    const out = join(dir, `${name}.docx`)
    execFileSync('python3', [join(__dirname, 'lo-comment.py'), join(dir, `profile-${name}`), port, book, out, 'with his watch open', 'A comment.', ...how], { stdio: 'ignore', timeout: 300_000 })
    const bytes = new Uint8Array(readFileSync(out))
    const xml = new TextDecoder().decode((await readZip(bytes)).get('word/document.xml'))
    const doc = await readEditedDocx(bytes)
    const scene = docScenes(doc).find((s) => s.comments.length > 0)
    made[name] = {
      inTheFile: { references: (xml.match(/<w:commentReference /g) ?? []).length, rangeStarts: (xml.match(/<w:commentRangeStart /g) ?? []).length, rangeEnds: (xml.match(/<w:commentRangeEnd /g) ?? []).length },
      readByTheApp: scene ? scene.comments.map((c) => ({ on: scene.edited.slice(c.start, c.end), before: scene.edited.slice(c.start, c.start + 19) })) : 'not read',
    }
  }
  process.stdout.write(`\nCOMMENT-PROBE ${dir}\n${JSON.stringify(made, null, 2)}\n`)
})
