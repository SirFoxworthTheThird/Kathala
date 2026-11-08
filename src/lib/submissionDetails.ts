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
  /** Which layout Word export was last set to. */
  layout: 'book' | 'submission'
}

export const EMPTY_DETAILS: SubmissionDetails = { name: '', legalName: '', contact: '', font: 'times', paper: 'letter', layout: 'book' }

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
      font: v.font === 'courier' ? 'courier' : 'times',
      paper: v.paper === 'a4' ? 'a4' : 'letter',
      layout: v.layout === 'submission' ? 'submission' : 'book',
    }
  } catch {
    return EMPTY_DETAILS
  }
}

export function keepSubmissionDetails(worldId: string, details: SubmissionDetails): void {
  try { localStorage.setItem(key(worldId), JSON.stringify(details)) } catch { /* private window, storage full: the export still works */ }
}
