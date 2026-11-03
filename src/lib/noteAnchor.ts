/*
  Where a note on the prose is (editorial-plan.md, R1).

  A note is pinned to words, not to a position: its anchor is the passage it
  was made on, with a little of the text either side — the W3C Web
  Annotation's TextQuoteSelector — and the scene it was made in. It is looked
  for again in the prose as it is now, every time it is shown, as the AI
  audit's quotes are (`auditReply.ts`). So it follows its words through an edit
  anywhere else, a scene split or joined, a scene moved, and Find & replace,
  and nothing has to rewrite it as the prose changes: an edit to the prose
  is not an edit to the note.

  Looked for, in order of preference:
  - the passage exactly, in its own scene; between repeats, the one whose
    surroundings match the note's;
  - the passage exactly, in another scene — a split or a join moved it;
  - the passage with a few characters changed — a word retyped inside it.
    Up to a quarter of its characters, and only for a passage long enough
    for a quarter to leave something to recognise.
  Past that the words have been rewritten, and the note is unplaced: still a
  note, with the quote it was made on, but nowhere on the page.
*/

/** How much of the text either side is kept, to tell repeats apart. */
export const CONTEXT_CHARS = 32
/** The share of a passage's characters that may have changed while it is still the same passage. */
export const MAX_EDIT_SHARE = 0.25
/** A passage shorter than this is found exactly or not at all: a quarter of a short one is a different word. */
export const MIN_FUZZY_CHARS = 16

export interface NoteAnchor {
  /** The scene the note was made in. */
  eventId: string
  /** The words it is on. */
  quote: string
  /** What came just before them, and just after. */
  prefix: string
  suffix: string
}

export interface NotePlace {
  eventId: string
  /** Where the words are now, in the scene's prose. */
  from: number
  to: number
  /** Whether they are exactly the words the note was made on. */
  exact: boolean
}

/**
 * The anchor for a passage of a scene's prose, `from`–`to`. White space at
 * either end of the selection is not part of what was meant, and is left out.
 * Null for a selection with nothing in it but space.
 */
export function anchorFrom(eventId: string, text: string, from: number, to: number): NoteAnchor | null {
  let a = Math.max(0, Math.min(from, to))
  let b = Math.min(text.length, Math.max(from, to))
  while (a < b && /\s/.test(text[a])) a++
  while (b > a && /\s/.test(text[b - 1])) b--
  if (a === b) return null
  return {
    eventId,
    quote: text.slice(a, b),
    prefix: text.slice(Math.max(0, a - CONTEXT_CHARS), a),
    suffix: text.slice(b, b + CONTEXT_CHARS),
  }
}

/**
 * Text as it is compared: case, curly quotes, dashes and a non-breaking space
 * set aside, one character for one so a match's place in it is its place in
 * the prose.
 */
export function fold(s: string): string {
  let out = ''
  for (const ch of s) {
    let c = ch
    if (c === '’' || c === '‘') c = "'"
    else if (c === '“' || c === '”') c = '"'
    else if (c === '—' || c === '–') c = '-'
    else if (c === ' ') c = ' '
    else {
      const lower = c.toLowerCase()
      if (lower.length === c.length) c = lower
    }
    out += c
  }
  return out
}

/** How many characters `a` and `b` share at their ends: `a`'s end against `b`'s end. */
function sharedEnd(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}

/** How many characters `a` and `b` share at their starts. */
function sharedStart(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

interface Candidate { from: number; to: number; distance: number }

/** Every place `quote` is exactly in `text`, both folded. */
function exactIn(text: string, quote: string): Candidate[] {
  const out: Candidate[] = []
  for (let at = text.indexOf(quote); at >= 0 && out.length < 200; at = text.indexOf(quote, at + 1)) {
    out.push({ from: at, to: at + quote.length, distance: 0 })
  }
  return out
}

/**
 * The best place in `text[lo, hi)` for `quote` with at most `max` characters
 * changed: the fewest edits from the quote to any stretch of the window
 * (Sellers' semi-global alignment), and where that stretch starts.
 */
function bestInWindow(text: string, quote: string, lo: number, hi: number, max: number): Candidate | null {
  const m = quote.length
  // dist[i]: edits for quote[0, i) to end at the current text position; start[i]: where that stretch began.
  let dist = new Int32Array(m + 1)
  let start = new Int32Array(m + 1)
  for (let i = 0; i <= m; i++) { dist[i] = i; start[i] = lo }
  let best: Candidate | null = null
  for (let j = lo; j < hi; j++) {
    const nextDist = new Int32Array(m + 1)
    const nextStart = new Int32Array(m + 1)
    // A match may start anywhere: free to begin after any character.
    nextDist[0] = 0
    nextStart[0] = j + 1
    const c = text[j]
    for (let i = 1; i <= m; i++) {
      const sub = dist[i - 1] + (quote[i - 1] === c ? 0 : 1)
      const del = dist[i] + 1 // a character of the text not in the quote
      const ins = nextDist[i - 1] + 1 // a character of the quote not in the text
      if (sub <= del && sub <= ins) { nextDist[i] = sub; nextStart[i] = start[i - 1] }
      else if (del <= ins) { nextDist[i] = del; nextStart[i] = start[i] }
      else { nextDist[i] = ins; nextStart[i] = nextStart[i - 1] }
    }
    dist = nextDist
    start = nextStart
    if (dist[m] <= max && (!best || dist[m] < best.distance)) best = { from: start[m], to: j + 1, distance: dist[m] }
  }
  return best
}

/**
 * Where `quote` is in `text` with a few characters changed, both folded:
 * windows around the places where a piece of it is still exactly there, each
 * searched for the closest stretch. A passage none of whose pieces survives
 * has been rewritten, not edited.
 */
function fuzzyIn(text: string, quote: string): Candidate[] {
  const max = Math.floor(quote.length * MAX_EDIT_SHARE)
  const pieces = Math.max(2, Math.min(6, Math.floor(quote.length / 8)))
  const size = Math.floor(quote.length / pieces)
  const windows: Array<[number, number]> = []
  for (let p = 0; p < pieces; p++) {
    const offset = p * size
    const piece = quote.slice(offset, p === pieces - 1 ? quote.length : offset + size)
    if (piece.trim().length < 4) continue
    for (let at = text.indexOf(piece), n = 0; at >= 0 && n < 20; at = text.indexOf(piece, at + 1), n++) {
      const lo = Math.max(0, at - offset - max)
      const hi = Math.min(text.length, at - offset + quote.length + max)
      windows.push([lo, hi])
    }
  }
  // Windows that overlap are one search.
  windows.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const w of windows) {
    const last = merged[merged.length - 1]
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1])
    else merged.push([w[0], w[1]])
  }
  return merged.flatMap(([lo, hi]) => bestInWindow(text, quote, lo, hi, max) ?? [])
}

/**
 * Where a note is now: in the scenes' prose as it is, or null where its words
 * are no longer there. `scenes` is the book — the note's own scene is looked
 * in first, and the rest only where its words are not there exactly.
 */
export function placeNote(anchor: NoteAnchor, scenes: ReadonlyArray<{ eventId: string; text: string }>): NotePlace | null {
  const quote = fold(anchor.quote)
  if (!quote.trim()) return null
  const prefix = fold(anchor.prefix)
  const suffix = fold(anchor.suffix)
  const room = prefix.length + suffix.length

  /*
    Each candidate is costed: the characters changed, a step for being in
    another scene, and up to two for surroundings that do not match. So the
    passage exactly where it was beats it exactly elsewhere, and a repeat in
    the right surroundings beats one in the wrong; and the passage with one
    word retyped in its own scene beats the same words, untouched, in a scene
    it was never in.
  */
  let best: { place: NotePlace; cost: number } | null = null
  const consider = (eventId: string, text: string, c: Candidate, own: boolean) => {
    const context = room ? (sharedEnd(text.slice(Math.max(0, c.from - prefix.length), c.from), prefix) + sharedStart(text.slice(c.to, c.to + suffix.length), suffix)) / room : 1
    const cost = c.distance + (own ? 0 : 2) + 2 * (1 - context)
    if (!best || cost < best.cost) best = { place: { eventId, from: c.from, to: c.to, exact: c.distance === 0 }, cost }
  }

  const own = scenes.find((s) => s.eventId === anchor.eventId)
  const others = scenes.filter((s) => s.eventId !== anchor.eventId)
  const folded = new Map<string, string>()
  const textOf = (s: { eventId: string; text: string }) => {
    let t = folded.get(s.eventId)
    if (t === undefined) { t = fold(s.text); folded.set(s.eventId, t) }
    return t
  }

  const ownExact = own ? exactIn(textOf(own), quote) : []
  for (const c of ownExact) consider(own!.eventId, textOf(own!), c, true)
  let anyExact = ownExact.length > 0
  for (const s of others) {
    const found = exactIn(textOf(s), quote)
    anyExact ||= found.length > 0
    for (const c of found) consider(s.eventId, textOf(s), c, false)
  }
  /*
    Retyped words: in the note's own scene wherever its exact words are not
    there — the costs then decide between a word retyped here and the same
    words untouched in a scene it was never in — and elsewhere only where the
    exact words are nowhere at all.
  */
  if (quote.length >= MIN_FUZZY_CHARS) {
    if (own && ownExact.length === 0) for (const c of fuzzyIn(textOf(own), quote)) consider(own.eventId, textOf(own), c, true)
    if (!anyExact) for (const s of others) for (const c of fuzzyIn(textOf(s), quote)) consider(s.eventId, textOf(s), c, false)
  }
  return best ? (best as { place: NotePlace }).place : null
}
