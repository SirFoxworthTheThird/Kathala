import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { makePdf } from '@/lib/pdfExport'
import { readPdf, printProblems } from '@/lib/pdfCheck'
import { TRIM_SIZES } from '@/lib/pdfLayout'
import type { BuiltManuscript } from '@/lib/manuscriptCompile'

/*
  The PDF export, end to end in Node (issue #701): the real fonts, the real
  writer, the file read back from its own bytes (`pdfCheck`) for its pages,
  their sizes, its fonts, its text and its metadata, as a printer would.
*/

const scene = (eventId: string, text: string) => ({ eventId, title: eventId, text, wordCount: text.split(/\s+/).length, written: true, status: 'draft' as const })
const prose = (n: number) => Array.from({ length: n }, (_, i) => `Paragraph ${i + 1}: the ferry waited at the _salt_ road, and nobody spoke of the river or of what it had taken from them that spring.`).join('\n\n')

const manuscript = (chapters: number): BuiltManuscript => ({
  totalWords: 0, totalScenes: chapters * 2, writtenScenes: chapters * 2,
  chapters: Array.from({ length: chapters }, (_, i) => ({
    id: `c${i}`, number: i + 1, title: `The Ford ${i + 1}`, synopsis: '', wordCount: 0, wordGoal: null, writtenScenes: 2,
    scenes: [scene(`e${i}a`, prose(14 + i * 5)), scene(`e${i}b`, `She ticked the list ✓ and went on. Ἀχιλλεύς, ſo it ran. ${prose(6)}`)],
  })),
})

const headings = (n: number) => Array.from({ length: n }, (_, i) => `Chapter ${['One', 'Two', 'Three', 'Four', 'Five'][i]}`)

describe('a PDF made from the book', () => {
  it('a print interior: the trim on every page, every font embedded, each chapter on a right-hand page with no head above it', async () => {
    const trim = TRIM_SIZES.find((t) => t.id === '5.5x8.5')!
    const made = await makePdf(manuscript(4), {
      kind: 'print', trim: trim.id, title: 'The Salt Road', author: 'Anna Vell', chapterHeading: 'chapter-words',
      front: { copyright: '© 2026 Anna Vell', dedication: 'For B.' }, back: [{ title: 'About the Author', text: 'Anna Vell lives by a river.' }],
    })
    const r = await readPdf(made.data)
    expect(r.pages).toHaveLength(made.pages)
    expect(printProblems(r, { width: trim.width, height: trim.height, headings: headings(4) })).toEqual([])
    expect(r.fonts.map((f) => f.name).join(' ')).toMatch(/EBGaramond-Regular.*EBGaramond-Italic.*DejaVuSans/)
    expect(r.title).toBe('The Salt Road')
    expect(r.author).toBe('Anna Vell')
    // Every character has a face: the tick from the fallback, Greek and the long s from EB Garamond.
    expect(made.missing).toBe(0)
    const text = r.pages.flatMap((p) => p.lines.map((l) => l.text))
    expect(text.join(' ')).toContain('She ticked the list ✓ and went on. Ἀχιλλεύς, ſo it ran.')
    // The front matter, and the back.
    expect(r.pages[0].lines.map((l) => l.text)).toEqual(['The Salt Road', 'Anna Vell'])
    expect(r.pages[1].lines.map((l) => l.text)).toEqual(['© 2026 Anna Vell'])
    expect(r.pages[2].lines.map((l) => l.text)).toEqual(['For B.'])
    expect(text).toContain('About the Author')
    // And its running heads: the author over a left page, the title over a right one.
    const body = r.pages.filter((p, i) => i > 4 && p.lines.length > 3 && !p.lines.some((l) => /^Chapter /.test(l.text)))
    const headOf = (p: (typeof r.pages)[number]) => [...p.lines].sort((a, b) => b.y - a.y)[0].text
    expect(new Set(body.map((p) => `${r.pages.indexOf(p) % 2 === 0 ? 'recto' : 'verso'} ${headOf(p)}`))).toEqual(new Set(['recto The Salt Road', 'verso Anna Vell']))
  }, 60_000)

  it('a reading copy, on A4 or Letter: chapters on new pages but not held to right-hand ones, which the print check says', async () => {
    for (const [paper, w, h] of [['a4', 595.28, 841.89], ['letter', 612, 792]] as const) {
      const made = await makePdf(manuscript(5), { kind: 'reading', paper, title: 'The Salt Road', author: 'Anna Vell', chapterHeading: 'chapter-words' })
      const r = await readPdf(made.data)
      expect(r.pages[0].width).toBeCloseTo(w, 1)
      expect(r.pages[0].height).toBeCloseTo(h, 1)
      expect(r.pages[0].lines.map((l) => l.text)).toEqual(['The Salt Road', 'Anna Vell'])
      // The same check a print interior passes finds what a reading copy does not do, so it can tell.
      expect(printProblems(r, { width: w, height: h, headings: headings(5) }).some((p) => p.includes('a left-hand page'))).toBe(true)
    }
  }, 60_000)

  it('a submission in Times’ metrics or Courier’s, as the Word file names them, with its header from page 2', async () => {
    const times = await makePdf(manuscript(2), { kind: 'submission', title: 'The Salt Road', chapterHeading: 'chapter-words', submission: { name: 'Anna Vell', contact: 'anna@example.invalid', paper: 'letter', font: 'times' } })
    const courier = await makePdf(manuscript(2), { kind: 'submission', title: 'The Salt Road', submission: { name: 'Anna Vell', paper: 'a4', font: 'courier' } })
    const t = await readPdf(times.data)
    const c = await readPdf(courier.data)
    expect(t.fonts.map((f) => f.name).join(' ')).toMatch(/LiberationSerif/)
    expect(c.fonts.map((f) => f.name).join(' ')).toMatch(/LiberationMono/)
    expect(t.pages[0].width).toBe(612)
    expect(c.pages[0].width).toBeCloseTo(595.28, 1)
    expect(t.pages[0].lines.map((l) => l.text)).toEqual(expect.arrayContaining(['Anna Vell', 'anna@example.invalid', 'The Salt Road', 'by Anna Vell']))
    expect(t.pages[1].lines.map((l) => l.text)).toContain('Vell / THE SALT ROAD / 2')
    // The last line of the book, the lowest on its last page: END.
    expect([...t.pages.at(-1)!.lines].sort((a, b) => a.y - b.y)[0].text).toBe('END')
    // Courier sets fewer words to the line, so the same book takes more pages.
    expect(courier.pages).toBeGreaterThan(times.pages)
  }, 60_000)

  it('says what it came to: no widows, orphans or stranded headings, and the time it took', async () => {
    const made = await makePdf(manuscript(5), { kind: 'print', trim: '6x9', title: 'The Salt Road', author: 'Anna Vell' })
    expect([made.widows, made.orphans, made.stranded]).toEqual([0, 0, 0])
    expect(made.ms).toBeGreaterThan(0)
  }, 60_000)
})

describe('ligatures', () => {
  it('set the letters they join, which read back as those letters', async () => {
    const text = 'The office was first to fill, and the officer filed his affidavit in the offing.'
    const m: BuiltManuscript = { totalWords: 15, totalScenes: 1, writtenScenes: 1, chapters: [
      { id: 'c', number: 1, title: 'One', synopsis: '', wordCount: 15, wordGoal: null, writtenScenes: 1, scenes: [scene('e', text)] },
    ] }
    const r = await readPdf((await makePdf(m, { kind: 'reading', title: 'T' })).data)
    expect(r.pages[1].lines.map((l) => l.text)).toContain(text)
  }, 60_000)
})

describe('justified lines', () => {
  it('end at the right margin, measured from the glyphs the file draws: ligatures included', async () => {
    // One long paragraph, thick with ligatures: what the layout measures must be what is drawn.
    const text = Array.from({ length: 12 }, () => 'The officer filed his affidavit at the office first, and fifty flagons followed.').join(' ')
    const m: BuiltManuscript = { totalWords: 150, totalScenes: 1, writtenScenes: 1, chapters: [
      { id: 'c', number: 1, title: 'One', synopsis: '', wordCount: 150, wordGoal: null, writtenScenes: 1, scenes: [scene('e', text)] },
    ] }
    const r = await readPdf((await makePdf(m, { kind: 'reading', paper: 'a4', title: 'T' })).data)
    const right = 595.28 - 72
    const body = r.pages[1].lines.filter((l) => l.text.includes('f'))
    expect(body.length).toBeGreaterThan(8)
    // Every line of the paragraph but its last.
    for (const l of body.slice(0, -1)) expect(Math.abs(l.end - right), l.text).toBeLessThan(0.5)
    expect(body.at(-1)!.end).toBeLessThan(right - 1)
  }, 60_000)
})

describe('a character no bundled font has', () => {
  it('is drawn as the replacement mark, and counted', async () => {
    const m: BuiltManuscript = { totalWords: 3, totalScenes: 1, writtenScenes: 1, chapters: [
      { id: 'c', number: 1, title: 'One', synopsis: '', wordCount: 3, wordGoal: null, writtenScenes: 1, scenes: [scene('e', 'The sign said 漢 and nothing else.')] },
    ] }
    const made = await makePdf(m, { kind: 'reading', title: 'T' })
    expect(made.missing).toBe(1)
    const text = (await readPdf(made.data)).pages.flatMap((p) => p.lines.map((l) => l.text)).join(' ')
    expect(text).toContain('The sign said \uFFFD and nothing else.')
  }, 60_000)
})

describe('the print check', () => {
  it('finds a running head, or anything, above a chapter’s heading on its opening page', async () => {
    const opening = async (head: boolean) => {
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const page = doc.addPage([432, 648])
      if (head) page.drawText('The Salt Road', { x: 100, y: 620, size: 9, font })
      page.drawText('Chapter One', { x: 100, y: 500, size: 12, font })
      return readPdf(await doc.save())
    }
    const clean = await opening(false)
    expect(printProblems(clean, { width: 432, height: 648, headings: ['Chapter One'] }).filter((p) => p.includes('above'))).toEqual([])
    const headed = await opening(true)
    expect(printProblems(headed, { width: 432, height: 648, headings: ['Chapter One'] })).toContain('page 1, which "Chapter One" opens, has a line above its heading')
  })

  it('finds a page off the trim, and a font not embedded', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([432, 650])
    page.drawText('Chapter One', { x: 100, y: 500, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) })
    const r = await readPdf(await doc.save())
    const problems = printProblems(r, { width: 432, height: 648, headings: ['Chapter One'] })
    expect(problems).toContain('page 1 is 432.00 × 650.00 pt, not the trim')
    expect(problems).toContain('Helvetica is not embedded')
    // Within the hundredth-inch tolerance, the page passes.
    expect(printProblems(r, { width: 432, height: 649.5, headings: [] }).some((p) => p.includes('not the trim'))).toBe(false)
  })
})
