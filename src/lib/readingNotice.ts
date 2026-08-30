/**
 * What reading mode is currently doing, said on the screen a reader lands on
 * (RD-3).
 *
 * The dashboard is where the Library drops you and it was the one screen that
 * never used the words "reading mode": the mode was inferable only from a
 * changed theme and sublabels like *you have met so far*. Every roster explains
 * itself; the landing screen did not, and did not say how to leave either.
 */
export interface HiddenCounts {
  characters: number
  items: number
  locations: number
}

/**
 * The groups being held back, as a phrase — `12 characters, 4 places and 2
 * items`. Null when nothing is hidden, so the caller can say so instead.
 *
 * Groups with none of their kind are left out rather than reported as zero: a
 * reader who has met every character does not need to be told there are no
 * characters left to meet.
 */
export function describeHidden(counts: HiddenCounts): string | null {
  const parts: string[] = []
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  add(counts.characters, 'character', 'characters')
  add(counts.locations, 'place', 'places')
  add(counts.items, 'item', 'items')

  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Where the reader is, in one sentence.
 *
 * A null chapter number means the whole book has been revealed, which is the
 * only way the gate reports no position — so there is no case here for "no
 * position but things still hidden": revealing everything is what clears the
 * cursor in the first place.
 */
export function describeReadingPosition(
  chapterNumber: number | null,
  counts: HiddenCounts,
): string {
  if (chapterNumber === null) {
    return 'You have revealed the whole book, so nothing is being held back.'
  }
  const hidden = describeHidden(counts)
  if (!hidden) {
    return `You are reading up to chapter ${chapterNumber}. Nothing is being held back yet.`
  }
  return `You are reading up to chapter ${chapterNumber}, so ${hidden} you have not met stay hidden until you reach them.`
}
