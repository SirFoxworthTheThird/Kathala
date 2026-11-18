import type { SubmissionOptions } from '@/lib/manuscriptExport'

/*
  What a Word export knows about the writer (editorial-plan.md, R2): the name
  on the byline, a legal name, contact details, and how a submission is set.
  Remembered per book, so the next export starts from it — on this device
  only. A world's own records travel in its `.pwk`, and a `.pwk` is what goes
  to a beta reader; a home address and telephone number should not go with
  it. So these are not on the world: they are in this browser, and in the
  exported file, and nowhere else (`readLocalStorageExtras` does not carry
  them).
*/

export interface SubmissionDetails extends Required<Pick<SubmissionOptions, 'name' | 'font' | 'paper'>> {
  legalName: string
  contact: string
  /** The title page's word count, where the writer says it; empty for the count, rounded. */
  wordCount: string
  /** Which layout Word export was last set to. */
  layout: 'book' | 'submission'
  /** Whether Word export marks the file for an editor's changes to come back (R4). */
  forEditing: boolean
  /** Which PDF the PDF export was last set to (issue #701). */
  pdfLayout: 'reading' | 'print' | 'submission'
  /** A print interior's trim, by id (`TRIM_SIZES`). */
  trim: string
  /** A reading copy's paper. */
  readingPaper: 'a4' | 'letter'
  /** A print interior's front and back matter: the copyright page, the dedication, and a page about the author. */
  copyright: string
  dedication: string
  about: string
}

export const EMPTY_DETAILS: SubmissionDetails = {
  name: '', legalName: '', contact: '', wordCount: '', font: 'times', paper: 'letter', layout: 'book', forEditing: false,
  pdfLayout: 'reading', trim: '6x9', readingPaper: 'a4', copyright: '', dedication: '', about: '',
}

const TRIMS = ['5x8', '5.25x8', '5.5x8.5', '6x9', 'a5', 'b-format']
const str = (v: unknown) => (typeof v === 'string' ? v : '')

const key = (worldId: string) => `kathala-submission:${worldId}`

export function readSubmissionDetails(worldId: string): SubmissionDetails {
  try {
    const raw = localStorage.getItem(key(worldId))
    if (!raw) return EMPTY_DETAILS
    const v = JSON.parse(raw) as Partial<SubmissionDetails>
    return {
      name: typeof v.name === 'string' ? v.name : '',
      legalName: typeof v.legalName === 'string' ? v.legalName : '',
      contact: typeof v.contact === 'string' ? v.contact : '',
      wordCount: typeof v.wordCount === 'string' ? v.wordCount : '',
      font: v.font === 'courier' ? 'courier' : 'times',
      paper: v.paper === 'a4' ? 'a4' : 'letter',
      layout: v.layout === 'submission' ? 'submission' : 'book',
      forEditing: v.forEditing === true,
      pdfLayout: v.pdfLayout === 'print' || v.pdfLayout === 'submission' ? v.pdfLayout : 'reading',
      trim: TRIMS.includes(str(v.trim)) ? str(v.trim) : '6x9',
      readingPaper: v.readingPaper === 'letter' ? 'letter' : 'a4',
      copyright: str(v.copyright),
      dedication: str(v.dedication),
      about: str(v.about),
    }
  } catch {
    return EMPTY_DETAILS
  }
}

export function keepSubmissionDetails(worldId: string, details: SubmissionDetails): void {
  try { localStorage.setItem(key(worldId), JSON.stringify(details)) } catch { /* private window, storage full: the export still works */ }
}
