/*
  Stated gaps between scenes (run-10 plan, Part 4): a scene that opens "Three
  weeks later" or "The next morning" says how long it has been since the scene
  before it. Where both scenes are dated, the dates say so too, and the two can
  be compared. Only a scene's *opening* is read — a gap stated there is about
  the cut between scenes; one met mid-scene is about anything at all.
*/

/** How long a scene's opening says it has been, in days, and how far off the dates may be before it is a contradiction. */
export interface StatedGap {
  days: number
  /** Days either way still consistent with the words: "three weeks" is not exactly 21. */
  tolerance: number
  /** The words, as the scene has them. */
  quote: string
}

const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
}

/** The calendar's lengths, for months and years: an Earth year where the book has no calendar. */
export interface GapCalendar { daysPerYear: number; monthsPerYear: number }
const EARTH: GapCalendar = { daysPerYear: 365, monthsPerYear: 12 }

/**
 * The first sentence of a scene's prose: past a header block, a heading in
 * capitals, and a dateline set in italics, which open many scenes and say
 * nothing about the cut.
 */
export function openingSentence(text: string): string {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const prose = paragraphs.find((p) =>
    !/^\[[\s\S]*\]$/.test(p)
    && !/^_[^_]+_\.?$/.test(p)
    && !/^\(?_[^_]+_\)?\.?$/.test(p)
    && !(p.length < 80 && p === p.toUpperCase() && /[A-Z]/.test(p))
    && !/^#/.test(p))
  if (!prose) return ''
  const m = /^[\s\S]*?[.!?](?=\s|$|["”’])/.exec(prose)
  return (m ? m[0] : prose).replace(/\s+/g, ' ').trim()
}

/** The gap a scene's opening sentence states, or null where it states none this can be sure of. */
export function statedGap(text: string, cal: GapCalendar = EARTH): StatedGap | null {
  const s = openingSentence(text).replace(/^["“'‘(]+/, '')
  // "The next morning", "The following day", "Next morning".
  const next = /^(?:the\s+)?(?:next|following)\s+(?:morning|day|evening|night|afternoon)\b/i.exec(s)
  if (next) return { days: 1, tolerance: 1, quote: next[0] }
  // "Three weeks later", "A fortnight after", "Nine days had passed".
  const n = Object.keys(NUMBERS).join('|')
  /*
    "After" only where it looks back at the scene before — "after this", "after
    the scene we have just described" — or ends the phrase. "A year after Louis
    XVIII. was restored" counts from something else.
  */
  const later = new RegExp(`^(${n}|\\d{1,3})\\s+(day|week|fortnight|month|year)s?\\s+(?:later|afterwards?|had\\s+passed|passed|went\\s+by|after(?=\\s*[,.;:—–-]|\\s+(?:this|that|these|the\\s+scene)\\b))`, 'i').exec(s)
  if (!later) return null
  const count = /^\d/.test(later[1]) ? Number(later[1]) : NUMBERS[later[1].toLowerCase()]
  const unit = later[2].toLowerCase()
  const month = cal.daysPerYear / Math.max(1, cal.monthsPerYear)
  switch (unit) {
    case 'day': return { days: count, tolerance: 1, quote: later[0] }
    case 'week': return { days: count * 7, tolerance: Math.max(2, count), quote: later[0] }
    case 'fortnight': return { days: count * 14, tolerance: 2, quote: later[0] }
    case 'month': return { days: Math.round(count * month), tolerance: Math.round(count * 3 + 4), quote: later[0] }
    default: return { days: count * cal.daysPerYear, tolerance: Math.round(count * 30 + 30), quote: later[0] }
  }
}

/**
 * Whether the dated gap between two scenes contradicts the gap stated at the
 * second's opening: only where the dates make it *shorter*. A scene is dated by
 * where it begins, and "the next morning" counts from where the scene before
 * it ended, which may be days on; so a longer dated gap can be the scene before
 * running long. A shorter one cannot be anything but the two disagreeing.
 */
export function contradicts(stated: StatedGap, datedDays: number): boolean {
  return datedDays < stated.days - stated.tolerance
}
