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
  - in its own scene, by the words either side of it, still standing, with
    words put in between them (`bySurroundings`).
  Past that the words have been rewritten, and the note is unplaced: still a
  note, with the quote it was made on, but nowhere on the page.
*/

/** How much of the text either side is kept, to tell repeats apart. */
export const CONTEXT_CHARS = 32
/** The share of a passage's characters that may have changed while it is still the same passage. */
export const MAX_EDIT_SHARE = 0.25
/** A passage shorter than this is found exactly or not at all: a quarter of a short one is a different word. */
export const MIN_FUZZY_CHARS = 16
/**
 * How many characters of a change's surroundings must still be beside its
 * words for a place to be its place (round-trip-plan-2.md, T7.1). Measured on both writer and editor runs' four
 * files: every change, applied in either order, had at least 32 where it
 * belonged (326 placements); every other copy of its words, once its sentence
 * was rewritten, had at most 21 (932). An accept that found the next "looked
 * at" with 3 wrote *she raised his eyes to him* into the climax (writer run
 * 2026-11-10, R2-1).
 */
export const MIN_CONTEXT_CHARS = 24

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
 * Text as it is compared: case, curly quotes, dashes, a non-breaking space and
 * a line end set aside, one character for one so a match's place in it is its
 * place in the prose.
 *
 * A line end is a space: a single one in prose is one in every reading of the
 * book, and in the Word file an editor's words come back in, so the scene has
 * `the\nroad` where the file's change was made against `the road`
 * (`paragraphBlocks`; round-trip-plan-3.md, T12.1). Two, a paragraph's end,
 * are two spaces, and still match only two.
 */
export function fold(s: string): string {
  let out = ''
  for (const ch of s) {
    let c = ch
    if (c === '’' || c === '‘') c = "'"
    else if (c === '“' || c === '”') c = '"'
    else if (c === '—' || c === '–') c = '-'
    else if (c === ' ' || c === '\n') c = ' '
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

const WORD = /[\p{L}\p{N}]/u
const isWord = (c: string | undefined) => c !== undefined && WORD.test(c)

/** Whether `pos` is inside a word of `text`: a letter either side of it. */
const insideWord = (text: string, pos: number) => isWord(text[pos - 1]) && isWord(text[pos])

/**
 * Every place `quote` is exactly in `text`, both folded — as words: not
 * starting or ending inside one, unless the passage did (`bestInWindow`). A
 * note on "art" is not on the middle of "party".
 */
function exactIn(text: string, quote: string, cuts: { start: boolean; end: boolean }): Candidate[] {
  const out: Candidate[] = []
  for (let at = text.indexOf(quote); at >= 0 && out.length < 200; at = text.indexOf(quote, at + 1)) {
    if (!cuts.start && insideWord(text, at)) continue
    if (!cuts.end && insideWord(text, at + quote.length)) continue
    out.push({ from: at, to: at + quote.length, distance: 0 })
  }
  return out
}

/** Whether `a` is a better stretch for `quote` than `b`: fewer edits, then ending as it does, then nearer its length. */
function closerTo(text: string, quote: string) {
  const last = quote[quote.length - 1]
  return (a: Candidate, b: Candidate): boolean => {
    if (a.distance !== b.distance) return a.distance < b.distance
    const endsA = text[a.to - 1] === last ? 0 : 1
    const endsB = text[b.to - 1] === last ? 0 : 1
    if (endsA !== endsB) return endsA < endsB
    return Math.abs(a.to - a.from - quote.length) < Math.abs(b.to - b.from - quote.length)
  }
}

/**
 * The best place in `text[lo, hi)` for `quote` with at most `max` characters
 * changed: the fewest edits from the quote to any stretch of the window
 * (Sellers' semi-global alignment), and where that stretch starts.
 *
 * A stretch neither starts nor ends inside a word, unless the passage the
 * note was made on did (`cuts`: the writer chose half a word). Without that,
 * "look back." retyped as "look behind." was found as "look b": stopping
 * inside the new word changed fewer characters than taking all of it.
 */
function bestInWindow(text: string, quote: string, lo: number, hi: number, max: number, cuts: { start: boolean; end: boolean }): Candidate | null {
  const m = quote.length
  const never = m + max + 1
  const startOk = (pos: number) => cuts.start || !insideWord(text, pos)
  const endOk = (pos: number) => cuts.end || !insideWord(text, pos)
  const closer = closerTo(text, quote)
  // dist[i]: edits for quote[0, i) to end at the current text position; start[i]: where that stretch began.
  let dist = new Int32Array(m + 1)
  let start = new Int32Array(m + 1)
  const opening = startOk(lo) ? 0 : never
  for (let i = 0; i <= m; i++) { dist[i] = opening + i; start[i] = lo }
  let best: Candidate | null = null
  for (let j = lo; j < hi; j++) {
    const nextDist = new Int32Array(m + 1)
    const nextStart = new Int32Array(m + 1)
    // A match may begin after any character that leaves it starting a word.
    nextDist[0] = startOk(j + 1) ? 0 : never
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
    /*
      Between stretches as close: the one ending on the quote's own last
      character — its full stop — and then the one nearest its length.
      Dropping a retyped word, or the stop after it, costs as much as taking
      it, and the passage is all of it.
    */
    if (dist[m] <= max && endOk(j + 1)) {
      const here = { from: start[m], to: j + 1, distance: dist[m] }
      if (!best || closer(here, best)) best = here
    }
  }
  return best
}

/**
 * Where `quote` is in `text` with a few characters changed, both folded:
 * windows around the places where a piece of it is still exactly there, each
 * searched for the closest stretch. A passage none of whose pieces survives
 * has been rewritten, not edited.
 */
function fuzzyIn(text: string, quote: string, cuts: { start: boolean; end: boolean }): Candidate[] {
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
  return merged.flatMap(([lo, hi]) => bestInWindow(text, quote, lo, hi, max, cuts) ?? [])
}

const WORDS = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu

/**
 * How much of `quote` `text` keeps as words, in order: the longest common
 * run of whole words, each counted by its letters. Words, not characters: any
 * two sentences share half their letters in order, and *twenty-two thousand*
 * rewritten as *a hundred and forty thousand* kept enough of them to pass.
 */
function keptWords(quote: string, text: string): { kept: number; of: number } {
  const q = quote.match(WORDS) ?? []
  const t = text.match(WORDS) ?? []
  let row = new Int32Array(t.length + 1)
  for (let i = 1; i <= q.length; i++) {
    const next = new Int32Array(t.length + 1)
    for (let j = 1; j <= t.length; j++) {
      next[j] = q[i - 1] === t[j - 1] ? row[j - 1] + q[i - 1].length : Math.max(row[j], next[j - 1])
    }
    row = next
  }
  return { kept: row[t.length], of: q.reduce((n, w) => n + w.length, 0) }
}

/**
 * Where a passage is by its surroundings, words having gone into it
 * (round-trip-plan-3.md, T11.3): the words before it and the words after it
 * both stand, in that order, and what is between keeps its words — at most a
 * quarter of them dropped or changed, by their letters, any number put in — at
 * no more than twice its length. Five words put into the middle of *folded small inside the left
 * one* were more than a quarter of it changed, and the note was unplaced with
 * its surroundings intact either side.
 *
 * An empty side is the scene's start or end. Between two places as good,
 * neither. Counted by words, a short passage needs no rule of its own: a
 * word retyped in it, *ferry* as *berry*, is the whole of a one-word passage.
 */
function bySurroundings(text: string, quote: string, prefix: string, suffix: string): Candidate | null {
  const max = Math.floor(quote.length * MAX_EDIT_SHARE)
  const starts: number[] = []
  if (!prefix) starts.push(0)
  else for (let at = text.indexOf(prefix); at >= 0 && starts.length < 20; at = text.indexOf(prefix, at + 1)) starts.push(at + prefix.length)
  let best: Candidate | null = null
  let tied = false
  for (const from of starts) {
    const to = suffix ? text.indexOf(suffix, from) : text.length
    if (to < 0) continue
    const between = text.slice(from, to)
    if (between.length < quote.length - max || between.length > 2 * quote.length) continue
    const { kept, of } = keptWords(quote, between)
    const dropped = of - kept
    if (!of || dropped > Math.floor(of * MAX_EDIT_SHARE)) continue
    const here = { from, to, distance: dropped + (between.length - quote.length) }
    if (best && here.distance === best.distance) tied = true
    if (!best || here.distance < best.distance) { best = here; tied = false }
  }
  return tied ? null : best
}

/**
 * Where a note is now: in the scenes' prose as it is, or null where its words
 * are no longer there. `scenes` is the book — the note's own scene is looked
 * in first, and the rest only where its words are not there exactly.
 *
 * In another scene only the exact words are followed — a split, a join, a
 * passage moved — never a near-match: that is a different sentence that reads
 * alike (round-trip-plan-2.md, T7.2; writer run 2026-11-10, R2-3). `strict` is
 * for a change rather than a note (`applyHunk`, T7.1): a note follows its
 * words wherever they went, and a change is to those words where they stood,
 * so it is placed only where enough of its surroundings are still beside them
 * (`MIN_CONTEXT_CHARS`), since "looked at" is in every scene, and nowhere if
 * they cannot choose between two places.
 */
export function placeNote(
  anchor: NoteAnchor,
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
  strict = false,
  /** Whether it may be placed by its surroundings (`bySurroundings`): a note's words may have had words put in; a change's may not. */
  asNote = !strict,
): NotePlace | null {
  const quote = fold(anchor.quote)
  if (!quote.trim()) return null
  const prefix = fold(anchor.prefix)
  const suffix = fold(anchor.suffix)
  const room = prefix.length + suffix.length
  // Whether the passage itself began or ended inside a word.
  const cuts = { start: isWord(prefix[prefix.length - 1]) && isWord(quote[0]), end: isWord(quote[quote.length - 1]) && isWord(suffix[0]) }

  /*
    Each candidate is costed: the characters changed, a step for being in
    another scene, and up to two for surroundings that do not match. So the
    passage exactly where it was beats it exactly elsewhere, and a repeat in
    the right surroundings beats one in the wrong; and the passage with one
    word retyped in its own scene beats the same words, untouched, in a scene
    it was never in.
  */
  // A change's surroundings must still be beside it (`MIN_CONTEXT_CHARS`); a note's need not.
  const need = strict ? MIN_CONTEXT_CHARS : 0
  let best: { place: NotePlace; cost: number } | null = null
  let tied = false
  const consider = (eventId: string, text: string, c: Candidate, own: boolean) => {
    const before = sharedEnd(text.slice(Math.max(0, c.from - prefix.length), c.from), prefix)
    const after = sharedStart(text.slice(c.to, c.to + suffix.length), suffix)
    const shared = before + after
    /*
      A scene's start or end is as good as words: a change made against it,
      and still against it, has the rest of its surroundings there. Without
      that, a change at a scene's end had only the words before it, and a word
      retyped among them refused it.
    */
    const edges = (prefix.length < CONTEXT_CHARS && before === prefix.length && c.from === prefix.length ? CONTEXT_CHARS - prefix.length : 0)
      + (suffix.length < CONTEXT_CHARS && after === suffix.length && c.to + suffix.length === text.length ? CONTEXT_CHARS - suffix.length : 0)
    if (shared + edges < need) return
    const context = room ? shared / room : 1
    const cost = c.distance + (own ? 0 : 2) + 2 * (1 - context)
    if (best && cost === best.cost) tied = true
    if (!best || cost < best.cost) { best = { place: { eventId, from: c.from, to: c.to, exact: c.distance === 0 }, cost }; tied = false }
  }

  const own = scenes.find((s) => s.eventId === anchor.eventId)
  const others = scenes.filter((s) => s.eventId !== anchor.eventId)
  const folded = new Map<string, string>()
  const textOf = (s: { eventId: string; text: string }) => {
    let t = folded.get(s.eventId)
    if (t === undefined) { t = fold(s.text); folded.set(s.eventId, t) }
    return t
  }

  if (own) for (const c of exactIn(textOf(own), quote, cuts)) consider(own.eventId, textOf(own), c, true)
  const placedHere = best !== null
  for (const s of others) for (const c of exactIn(textOf(s), quote, cuts)) consider(s.eventId, textOf(s), c, false)
  /*
    Retyped words: in the note's own scene only, wherever its exact words are
    not placed there — an exact copy in the wrong surroundings does not count
    — and the costs then decide between a word retyped here and the same words
    untouched in another scene. Never retyped words in another scene: a
    near-match there is another sentence that reads alike.
  */
  if (quote.length >= MIN_FUZZY_CHARS && own && !placedHere) for (const c of fuzzyIn(textOf(own), quote, cuts)) consider(own.eventId, textOf(own), c, true)
  /*
    Words put into it: in its own scene, where nothing else placed it, by the
    words either side still standing (`bySurroundings`). A note only: a change
    is to the words as they stood, and its mark on the Page would strike the
    words put in as its own.
  */
  if (asNote && !best && own) {
    const c = bySurroundings(textOf(own), quote, prefix, suffix)
    if (c) best = { place: { eventId: own.eventId, from: c.from, to: c.to, exact: false }, cost: 0 }
  }
  // A change whose surroundings cannot choose between two places is made in neither.
  if (strict && tied) return null
  return best ? (best as { place: NotePlace }).place : null
}

/**
 * Where each of a book's notes is now (`placeNote`), by note id: null for one
 * unplaced. Every note is looked for in its own scene first, so the book is
 * read in full only for those whose words have left it.
 */
export function placeNotes(
  notes: ReadonlyArray<NoteAnchor & { id: string; outside?: string }>,
  scenes: ReadonlyArray<{ eventId: string; text: string }>,
): Map<string, NotePlace | null> {
  const byId = new Map(scenes.map((s) => [s.eventId, s]))
  const out = new Map<string, NotePlace | null>()
  for (const note of notes) {
    // On a heading or the title page: its words are that line's, and are not looked for in the prose (T9.4).
    if (note.outside) { out.set(note.id, null); continue }
    const own = byId.get(note.eventId)
    const here = own ? placeNote(note, [own]) : null
    out.set(note.id, here?.exact ? here : placeNote(note, scenes))
  }
  return out
}
