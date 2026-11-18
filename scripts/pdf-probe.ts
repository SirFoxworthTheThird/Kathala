import { test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManuscript } from '../src/lib/manuscriptCompile'
import { makePdf, type PdfOptions } from '../src/lib/pdfExport'
import { readPdf, printProblems } from '../src/lib/pdfCheck'
import { chapterHeadingLines } from '../src/lib/chapterHeading'
import { TRIM_SIZES } from '../src/lib/pdfLayout'
import { LIBRARY } from './proseLibrary'

/*
  The PDF export against Library books (issue #701): each made as a print
  interior, a reading copy and a submission, timed, counted for widows, orphans,
  stranded headings and loose lines, and the interior read back and checked as
  a printer would (`printProblems`). The e2e keeps the counts for three of them;
  this prints them for any.

    KATHALA_LIBRARY=… PDF_BOOKS=pride-and-prejudice,the-odyssey npm run probe:pdf
*/
const BOOKS = (process.env.PDF_BOOKS ?? 'pride-and-prejudice,the-odyssey,the-cold-choir').split(',')

test('the PDF export on Library books', async () => {
  for (const name of BOOKS) {
    const w = JSON.parse(readFileSync(join(LIBRARY, `${name}.pwk`), 'utf8'))
    const m = buildManuscript({ chapters: w.chapters, events: w.events, sceneTextByEvent: new Map(w.sceneTexts.map((t: { eventId: string }) => [t.eventId, t])) })
    const title = w.world.name as string
    for (const kind of ['print', 'reading', 'submission'] as const) {
      const o: PdfOptions = { kind, title, author: 'The Author', chapterHeading: 'chapter-words', trim: '6x9', paper: 'a4', submission: { name: 'The Author', paper: 'letter' } }
      const made = await makePdf(m, o)
      let check = ''
      if (kind === 'print') {
        const r = await readPdf(made.data)
        const trim = TRIM_SIZES.find((t) => t.id === '6x9')!
        const headings = m.chapters.filter((c) => c.scenes.some((s) => s.written)).map((c) => chapterHeadingLines('chapter-words', c.number, c.title)[0])
        const problems = printProblems(r, { width: trim.width, height: trim.height, headings })
        check = ` | ${r.fonts.length} fonts, all embedded: ${r.fonts.every((f) => f.embedded)} | problems ${problems.length}${problems.length ? ': ' + problems.slice(0, 3).join('; ') : ''}`
      }
      console.log(`${name} ${kind}: ${made.pages} pages, ${made.ms} ms, ${Math.round(made.data.length / 1024)} KB | widows ${made.widows}, orphans ${made.orphans}, stranded ${made.stranded}, loose ${made.loose}, missing ${made.missing}${check}`)
    }
  }
})
