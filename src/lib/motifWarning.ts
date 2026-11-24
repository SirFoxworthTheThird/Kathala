import { isDormant } from '@/lib/threadContinuity'
import type { TagCadenceRow } from '@/lib/tagCadence'

/**
 * What the dashboard says of a motif's cadence, or null where nothing is amiss.
 *
 * A motif going quiet mid-story is judged as a thread is (`isDormant`): at
 * least five quiet chapters and more than a third of its span. It was any
 * three, and six of *Dracula*'s seven motifs were amber, four of them for
 * "vanishes for 3 chapters" or 4 — a warning on nearly every row stops telling
 * one row from another (UX-2-18, D-10). Fading out at the end is unchanged.
 */
export function motifWarning(r: Pick<TagCadenceRow<unknown>, 'eventCount' | 'trailingGap' | 'lastChapterNumber' | 'longestDormancy' | 'firstChapterNumber'>): string | null {
  if (r.eventCount === 0) return 'no scenes tagged yet'
  if (r.trailingGap >= 3) return `fades out — last seen Ch. ${r.lastChapterNumber}, absent ${r.trailingGap} chapters`
  if (isDormant(r)) return `vanishes for ${r.longestDormancy} chapters mid-story`
  return null
}

