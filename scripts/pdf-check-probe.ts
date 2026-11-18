import { test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readPdf, printProblems } from '../src/lib/pdfCheck'
import { TRIM_SIZES } from '../src/lib/pdfLayout'

/*
  A PDF checked as a print service would check an interior (issue #701): its
  pages against the trim, every font embedded and none of Type 3, and, given
  the chapters' headings, each opening on a right-hand page with nothing above
  its heading. Fails, listing what it found, where anything is wrong.

    PDF=book.pdf TRIM=6x9 HEADINGS='Chapter One|Chapter Two' npm run check:pdf
*/
test('the PDF passes a printer’s checks', async () => {
  const file = process.env.PDF
  if (!file) throw new Error('Say which file: PDF=book.pdf')
  const trim = TRIM_SIZES.find((t) => t.id === (process.env.TRIM ?? '6x9'))
  if (!trim) throw new Error(`No trim ${process.env.TRIM}: one of ${TRIM_SIZES.map((t) => t.id).join(', ')}`)
  const r = await readPdf(new Uint8Array(readFileSync(file)))
  const headings = (process.env.HEADINGS ?? '').split('|').filter(Boolean)
  const problems = printProblems(r, { width: trim.width, height: trim.height, headings })
  console.log(`${file}: ${r.pages.length} pages, ${r.fonts.map((f) => `${f.name} (${f.subtype}${f.embedded ? ', embedded' : ', NOT embedded'})`).join(', ')}`)
  for (const p of problems) console.log('  ' + p)
  expect(problems).toEqual([])
})
