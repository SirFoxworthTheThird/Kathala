import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { readDraftDocx, DraftDocxError, type DraftDocx } from '@/lib/docxDraft'
import { zipStore } from '@/lib/zip'
import { emphasisSpans } from '@/lib/proseEmphasis'

/*
  A writer's own Word draft, read for Import Manuscript (issue #697). The ten
  drafts of the measure (docs/records/docx-import-measure.md), each beside what
  it holds, then small drafts built here for each rule.
*/

const F = path.join(__dirname, 'fixtures/docx/import')
interface Truth { chapters: Array<{ title: string; scenes: Array<{ words: number; italics: string[] }> }> }
const truth = (name: string) => JSON.parse(readFileSync(path.join(F, `${name}.truth.json`), 'utf8')) as Truth
const read = (name: string) => readDraftDocx(new Uint8Array(readFileSync(path.join(F, `${name}.docx`))))
const words = (s: string) => s.replace(/[_*]/g, '').split(/\s+/).filter(Boolean).length
const shape = (d: DraftDocx) => d.manuscript.chapters.map((c) => c.scenes.length)
const total = (d: DraftDocx) => d.manuscript.chapters.reduce((n, c) => n + c.scenes.reduce((k, s) => k + words(s.text), 0), 0)
const wanted = (t: Truth) => t.chapters.reduce((n, c) => n + c.scenes.reduce((k, s) => k + s.words, 0), 0)
const italicsOf = (d: DraftDocx) => d.manuscript.chapters.flatMap((c) => c.scenes.flatMap((s) => emphasisSpans(s.text).filter((x) => x.em).map((x) => x.text)))
const unmarked = (d: DraftDocx) => d.manuscript.chapters.flatMap((c) => [c.title, ...c.scenes.flatMap((s) => [s.text, s.title ?? ''])]).every((t) => !/[-]/.test(t))

describe('the ten drafts measured: each comes in as it holds', () => {
  for (const [name, titles] of [
    ['01-heading-styles', null],
    ['03-localised-style-ids', ['O Ramalhete e a história dos Maias', 'A ruína de Pedro da Maia', 'A educação em Santa Olávia', 'Coimbra, medicina e regresso', 'A vida no Ramalhete']],
    ['04-own-style-blank-breaks', ['The Science of Deduction', 'The Statement of the Case', 'In Quest of a Solution', 'The Story of the Bald-Headed Man', 'The Tragedy of Pondicherry Lodge', 'Sherlock Holmes Gives a Demonstration']],
    ['07-emphasis-style-tabs', ['Down the Rabbit-Hole', 'The Pool of Tears', 'A Caucus-Race and a Long Tale', 'The Rabbit Sends in a Little Bill', 'Advice from a Caterpillar']],
    ['09-libreoffice-from-html', ['Peter Breaks Through', 'The Shadow', 'Come Away, Come Away!', 'The Flight', 'The Island Come True']],
  ] as const) {
    it(`${name}: every chapter and scene, every word, every italic span`, async () => {
      const d = await read(name)
      const t = truth(name)
      expect(shape(d)).toEqual(t.chapters.map((c) => c.scenes.length))
      expect(total(d)).toBe(wanted(t))
      // "Chapter I" names only a number: the chapter's number carries it, as Markdown's import has always done.
      expect(d.manuscript.chapters.map((c) => c.title)).toEqual(titles ?? t.chapters.map(() => ''))
      expect(italicsOf(d)).toEqual(t.chapters.flatMap((c) => c.scenes.flatMap((s) => s.italics)))
      expect(unmarked(d)).toBe(true)
    })
  }

  it('01: the book’s title from Word’s Title style', async () => {
    expect((await read('01-heading-styles')).manuscript.title).toBe('Persuasion')
  })

  it('02: chapters by bold lines after page breaks, with no heading style; a heading on two lines is one chapter', async () => {
    const d = await read('02-bold-lines-page-breaks')
    const t = truth('02-bold-lines-page-breaks')
    expect(shape(d)).toEqual(t.chapters.map((c) => c.scenes.length))
    expect(total(d)).toBe(wanted(t))
    // CHAPTER ONE, then the book's own PROLOGUE under it: one chapter, titled by the second line.
    expect(d.manuscript.chapters[0].title).toBe('PROLOGUE')
    expect(d.leftOut.formatting).toBe(true)
  })

  it('05: parts are not chapters; the chapters under them are, each part given to the chapter it begins (D-3)', async () => {
    const d = await read('05-parts-and-chapters')
    expect(shape(d)).toEqual(truth('05-parts-and-chapters').chapters.map((c) => c.scenes.length))
    expect(total(d)).toBe(wanted(truth('05-parts-and-chapters')))
    expect(d.manuscript.chapters.slice(0, 4).map((c) => c.title)).toEqual(['Letter I', 'Letter II', 'Letter III', 'Letter IV'])
    expect(d.parts).toEqual([{ chapter: 0, name: 'Part One' }, { chapter: 3, name: 'Part Two' }])
  })

  it('06: standard manuscript format: the title page out and listed, its title the book’s, END dropped (D-4)', async () => {
    const d = await read('06-manuscript-format')
    expect(d.manuscript.title).toBe('KIDNAPPED')
    expect(d.leftOut.lines.sort()).toEqual(['12 Any Street', 'About 9,000 words', 'END', 'Jane Writer', 'by Jane Writer'])
    expect(d.manuscript.chapters[0].scenes[0].text).not.toContain('Jane Writer')
    // Six, where the book holds five: its first chapter's text has the book's own "CHAPTER I" in it, after a dedication and a preface.
    expect(shape(d)).toEqual([1, 3, 3, 3, 3, 3])
    expect(d.manuscript.chapters.flatMap((c) => c.scenes).some((s) => /\bEND\b\s*$/.test(s.text))).toBe(false)
  })

  it('08: tracked changes as accepted, and each comment on its words (D-1, D-2)', async () => {
    const d = await read('08-tracked-and-comments')
    expect(d.tracked).toBe(12)
    const t = truth('08-tracked-and-comments')
    expect(shape(d)).toEqual(t.chapters.map((c) => c.scenes.length))
    // The truth file counts the text before its changes: six insertions of two words each are its twelve more.
    expect(total(d)).toBe(wanted(t) + 12)
    const text = d.manuscript.chapters.flatMap((c) => c.scenes.map((s) => s.text)).join('\n')
    expect(text.match(/Added later\./g)).toHaveLength(6)
    expect(text).not.toContain('Cut since.')
    expect(d.comments).toHaveLength(6)
    expect(d.comments[0]).toMatchObject({ chapter: 0, scene: 0, quote: 'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.' })
    for (const c of d.comments) {
      const scene = d.manuscript.chapters[c.chapter].scenes[c.scene].text
      expect(scene.slice(c.from, c.to)).toBe(c.quote)
      expect(c.comment.text).toBe('Check this against chapter one.')
    }
  })

  it('10: Kathala’s own export comes back as it went: title, chapters by their titles, every scene and word', async () => {
    const d = await read('10-kathala-export')
    const t = truth('10-kathala-export')
    expect(d.manuscript.title).toBe('The Salt Ledger')
    expect(d.manuscript.chapters.map((c) => c.title)).toEqual(t.chapters.map((c) => c.title))
    expect(shape(d)).toEqual(t.chapters.map((c) => c.scenes.length))
    expect(total(d)).toBe(wanted(t))
    expect(d.leftOut.lines).toContain('by Tamsin Hale')
  })
})

// ── Small drafts, one rule each ──────────────────────────────────────────────

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const STYLES = `<w:styles ${NS}><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>`
const r = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`
const p = (inner: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`
const h1 = (t: string) => p(r(t), 'Heading1')
function draft(body: string, comments?: string, styles = STYLES): Promise<DraftDocx> {
  const enc = new TextEncoder()
  const files = [
    { name: 'word/document.xml', data: enc.encode(`<w:document ${NS}><w:body>${body}</w:body></w:document>`) },
    { name: 'word/styles.xml', data: enc.encode(styles) },
    ...(comments ? [{ name: 'word/comments.xml', data: enc.encode(`<w:comments ${NS}>${comments}</w:comments>`) }] : []),
  ]
  return readDraftDocx(zipStore(files))
}
const comment = (id: string, text: string) => `<w:comment w:id="${id}" w:author="Jane"><w:p>${r(text)}</w:p></w:comment>`

describe('each rule, in a draft of its own', () => {
  it('with no heading styles, a short line at the top of a new page is a chapter; a sentence there is not', async () => {
    const newPage = (t: string) => `<w:p><w:pPr><w:pageBreakBefore/></w:pPr>${r(t)}</w:p>`
    const d = await draft(p(r('The Road')) + p(r('She walked.')) + `<w:p>${r('She stopped.')}<w:r><w:br w:type="page"/></w:r></w:p>` +
      p(r('The Sea')) + p(r('She swam.')) + newPage('She swam on, and on.') + newPage('The Shore') + p(r('She rested.')))
    expect(d.manuscript.chapters.map((c) => [c.title, c.scenes.map((s) => s.text)])).toEqual([
      ['', ['The Road\n\nShe walked.\n\nShe stopped.']],
      ['The Sea', ['She swam.\n\nShe swam on, and on.']],
      ['The Shore', ['She rested.']],
    ])
  })

  it('an italic run’s spaces at its edges are left outside its marks', async () => {
    const it_ = (t: string) => `<w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${t}</w:t></w:r>`
    const d = await draft(h1('One') + p(`${r('She read')}${it_(' Ivanhoe ')}${r('twice.')}`))
    // "_ Ivanhoe _" is no italic in Markdown: a mark must touch its words.
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('She read _Ivanhoe_ twice.')
  })

  it('a field inside another field’s instruction is part of the instruction: only the outer result is text', async () => {
    const fld = (t: string) => `<w:r><w:fldChar w:fldCharType="${t}"/></w:r>`
    const instr = (t: string) => `<w:r><w:instrText xml:space="preserve">${t}</w:instrText></w:r>`
    // { IF { PAGE } = 1 "first" "later" }, as Word writes it: the inner field's result, 1, is inside the outer instruction.
    const d = await draft(h1('One') + p(`${r('On the ')}${fld('begin')}${instr(' IF ')}${fld('begin')}${instr(' PAGE ')}${fld('separate')}${r('1')}${fld('end')}${instr(' = 1 "first" "later" ')}${fld('separate')}${r('first')}${fld('end')}${r(' page.')}`))
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('On the first page.')
  })

  it('a deleted run is gone whole: its words, written as text by a converter rather than as deleted text, and its footnote and image', async () => {
    const d = await draft(h1('One') + p(`${r('She stayed.')}<w:del w:id="9" w:author="J"><w:r><w:t> She left.</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:drawing/></w:r></w:del>`))
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('She stayed.')
    expect(d.leftOut).toMatchObject({ images: 0, footnotes: 0 })
    expect(d.tracked).toBe(1)
  })

  it('a style of the writer’s own at an outline level is a heading of that level, with no heading style anywhere', async () => {
    const own = STYLES.replace('</w:styles>',
      '<w:style w:type="paragraph" w:styleId="ChapterTitle"><w:name w:val="Chapter Title"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>')
    const d = await draft(p(r('The Road'), 'ChapterTitle') + p(r('She walked.')) + p(r('The Sea'), 'ChapterTitle') + p(r('She swam.')), undefined, own)
    expect(d.manuscript.chapters.map((c) => [c.title, c.scenes[0].text])).toEqual([['The Road', 'She walked.'], ['The Sea', 'She swam.']])
  })

  it('a style of the writer’s own based on a heading style is that heading, through each style it is based on', async () => {
    const own = STYLES.replace('</w:styles>',
      '<w:style w:type="paragraph" w:styleId="Chap"><w:name w:val="Chapter Head"/><w:basedOn w:val="Heading1"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ChapBig"><w:name w:val="Chapter Head Big"/><w:basedOn w:val="Chap"/></w:style></w:styles>')
    const d = await draft(p(r('The Road'), 'Chap') + p(r('She walked.')) + p(r('The Sea'), 'ChapBig') + p(r('She swam.')), undefined, own)
    expect(d.manuscript.chapters.map((c) => [c.title, c.scenes[0].text])).toEqual([['The Road', 'She walked.'], ['The Sea', 'She swam.']])
  })

  it('a deleted paragraph mark joins the two paragraphs, as Word shows the change accepted', async () => {
    const d = await draft(h1('One') + `<w:p><w:pPr><w:rPr><w:del w:id="1" w:author="J"/></w:rPr></w:pPr>${r('She waited')}</w:p>` + p(r(' until dark.')))
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('She waited until dark.')
    expect(d.tracked).toBe(1)
  })

  it('a field’s instruction is not text, its result is; and a field with no result leaves the rest of the paragraph', async () => {
    const fld = (t: string) => `<w:r><w:fldChar w:fldCharType="${t}"/></w:r>`
    const d = await draft(h1('One') + p(`${r('Page ')}${fld('begin')}<w:r><w:instrText> PAGE </w:instrText></w:r>${fld('separate')}${r('7')}${fld('end')}${r(' of it.')}`) +
      p(`${fld('begin')}<w:r><w:instrText> TC "x" </w:instrText></w:r>${fld('end')}${r('Still here.')}`))
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('Page 7 of it.\n\nStill here.')
  })

  it('images, tables, footnotes and endnotes are left out and counted', async () => {
    const d = await draft(h1('One') + p(`${r('A picture.')}<w:r><w:drawing/></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:r><w:endnoteReference w:id="2"/></w:r>`) +
      `<w:tbl><w:tr><w:tc>${p(r('In a table.'))}</w:tc></w:tr></w:tbl>` + p(r('After it.')))
    expect(d.leftOut).toMatchObject({ images: 1, tables: 1, footnotes: 1, endnotes: 1 })
    expect(d.manuscript.chapters[0].scenes[0].text).toBe('A picture.\n\nAfter it.')
  })

  it('a comment on a heading is on the heading; one on the title page is the title page’s; one with no range is at its point', async () => {
    const d = await draft(
      p(`<w:commentRangeStart w:id="1"/>${r('The Long Book')}<w:commentRangeEnd w:id="1"/>`, 'Title') +
      p(`<w:commentRangeStart w:id="2"/>${r('Chapter 1: The Road')}<w:commentRangeEnd w:id="2"/>`, 'Heading1') +
      p(`${r('She walked on.')}<w:r><w:commentReference w:id="3"/></w:r>${r(' Then she slept.')}`),
      comment('1', 'A better title?') + comment('2', 'Too plain.') + comment('3', 'Why?'))
    const by = (text: string) => d.comments.find((c) => c.comment.text === text)!
    expect(by('A better title?')).toMatchObject({ outside: 'title page', quote: 'The Long Book' })
    expect(by('Too plain.')).toMatchObject({ outside: 'heading', quote: 'The Road', chapter: 0 })
    const point = by('Why?')
    expect(point.outside).toBeUndefined()
    expect(d.manuscript.chapters[0].scenes[0].text.slice(0, point.from)).toBe('She walked on.')
    expect(unmarked(d)).toBe(true)
  })

  it('a comment on a scene break goes on with the first words after it, and the break is still a break', async () => {
    const d = await draft(h1('One') + p(r('Before.')) + p(`<w:commentRangeStart w:id="5"/>${r('* * *')}<w:commentRangeEnd w:id="5"/>`) + p(r('After.')), comment('5', 'Needed?'))
    expect(d.manuscript.chapters[0].scenes.map((s) => s.text)).toEqual(['Before.', 'After.'])
    expect(d.comments[0]).toMatchObject({ chapter: 0, scene: 1, from: 0 })
  })

  it('a draft whose only headings are parts, with no level under them, is in chapters: the parts are its chapters', async () => {
    const d = await draft(h1('Part One: The Road') + p(r('She walked.')) + h1('Part Two: The Sea') + p(r('She swam.')))
    expect(d.manuscript.chapters.map((c) => [c.title, c.scenes[0].text])).toEqual([['The Road', 'She walked.'], ['The Sea', 'She swam.']])
    expect(d.parts).toEqual([])
  })

  it('one Part heading among chapters is not a part: parts only where the top level is all parts', async () => {
    const d = await draft(h1('Part One') + p(r('Prose of part one.')) + h1('The Second') + p(r('More.')))
    expect(d.parts).toEqual([])
    expect(d.manuscript.chapters.map((c) => c.title)).toEqual(['', 'The Second'])
  })

  it('a draft that spaces its paragraphs with one empty one: two are a break, one is not', async () => {
    const e = p('')
    const d = await draft(h1('One') + p(r('A.')) + e + p(r('B.')) + e + e + p(r('C.')) + e + p(r('D.')))
    expect(d.manuscript.chapters[0].scenes.map((s) => s.text)).toEqual(['A.\n\nB.', 'C.\n\nD.'])
  })

  it('a file that is not a Word document, or a damaged one, is refused with a plain reason', async () => {
    await expect(readDraftDocx(new TextEncoder().encode('not a zip at all'))).rejects.toBeInstanceOf(DraftDocxError)
    await expect(readDraftDocx(zipStore([{ name: 'hello.txt', data: new TextEncoder().encode('hi') }]))).rejects.toThrow(/no document/)
    await expect(readDraftDocx(zipStore([{ name: 'word/document.xml', data: new TextEncoder().encode('<w:document') }]))).rejects.toThrow(/damaged/)
  })
})

describe('a long book', () => {
  it('120,000 words in under 10 seconds', async () => {
    const para = p(r('The tide came in over the flats and the lamps went out one by one along the wall, slowly. '.repeat(6)))
    const chapter = (k: number) => h1(`Chapter ${k + 1}`) + Array.from({ length: 20 }, () => para).join('') + p(r('* * *')) + Array.from({ length: 20 }, () => para).join('')
    const body = Array.from({ length: 30 }, (_, k) => chapter(k)).join('')
    const started = performance.now()
    const d = await draft(body)
    const took = performance.now() - started
    expect(total(d)).toBeGreaterThanOrEqual(120_000)
    expect(took).toBeLessThan(10_000)
  }, 30_000)
})
