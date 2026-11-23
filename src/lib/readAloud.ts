import { plainScene, sentences } from '@/lib/proseChecks/text'

/*
  Reading the prose aloud (issue #704): what is spoken, in what order. Pure;
  the player (`ReadAloud.tsx`) speaks it and marks it on the page. The
  decisions are in `docs/records/read-aloud-plan.md`.
*/

/** What read aloud needs of a book: its chapters in order, and their written scenes. */
export interface AloudChapter {
  id: string
  number: number
  title: string
  scenes: ReadonlyArray<{ eventId: string; text: string; written: boolean }>
}

export type AloudItem =
  /** A chapter's heading, announced. */
  | { kind: 'heading'; chapterId: string; say: string[] }
  /**
   * A sentence: where it is on the page — its scene, its paragraph (`data-p`),
   * and its stretch of that paragraph's text — and what is spoken, in parts.
   */
  | { kind: 'sentence'; chapterId: string; eventId: string; paragraph: number; from: number; to: number; text: string; say: string[] }
  /** A pause: a scene break, or a divider with nothing to say (D-3). */
  | { kind: 'pause'; chapterId: string; eventId: string | null; ms: number }

/** How long a scene break is. */
export const BREAK_MS = 900
/** How long a divider inside the prose is. */
export const DIVIDER_MS = 600
/** A sentence longer than this is spoken in parts (D-4). */
export const PART_CHARS = 300

/** Footnote markers: `[1]`, `[*]`, `[†]` and their kin. An editor's words in brackets are prose, and stay. */
const NOTE_MARKER = /\[(?:\d+|[*†‡§¶]+)\]/g

/**
 * A sentence as it is spoken (D-3): footnote markers out, any `_` or `*` left
 * by the italics out, and every run of space — verse line ends too — one
 * space. Empty where there is nothing to say.
 */
export function spokenText(text: string): string {
  return text.replace(NOTE_MARKER, '').replace(/[_*]/g, '').replace(/\s+/g, ' ').trim()
}

/** Whether a sentence says anything: a letter or a digit in it. */
export function hasWords(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

/**
 * A long sentence in parts (D-4): cut at the last `;`, `:` or dash before the
 * limit, else the last `,`, else the last space, so each part is one breath a
 * voice can take. A sentence within the limit is one part.
 */
export function speechParts(text: string, max = PART_CHARS): string[] {
  const out: string[] = []
  let rest = text.trim()
  while (rest.length > max) {
    const head = rest.slice(0, max + 1)
    const at = lastCut(head, /[;:—–]\s/g) ?? lastCut(head, /,\s/g) ?? lastCut(head, /\s/g)
    const cut = at && at > max / 3 ? at : max
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out
}

/** Where to cut after the last match: just past its punctuation. */
function lastCut(text: string, re: RegExp): number | null {
  let at: number | null = null
  for (const m of text.matchAll(re)) at = m.index + m[0].trimEnd().length
  return at && at > 0 ? at : null
}

/** A chapter's heading as it is announced: "Chapter 4. The Lizard on the Wall." */
export function headingSaid(number: number, title: string): string {
  const t = spokenText(title)
  if (!t) return `Chapter ${number}.`
  return `Chapter ${number}. ${t}${/[.!?…]$/.test(t) ? '' : '.'}`
}

/**
 * The book as it is read aloud, in order (D-3): each chapter with written
 * scenes, its heading, then its scenes' sentences, a pause between scenes, and
 * a pause for a divider. The sentences are the prose pass's (`sentences` over
 * `plainScene`), on the text the page shows, so the highlight lands on them.
 */
export function aloudQueue(chapters: readonly AloudChapter[]): AloudItem[] {
  const out: AloudItem[] = []
  for (const ch of chapters) {
    const scenes = ch.scenes.filter((s) => s.written)
    if (scenes.length === 0) continue
    out.push({ kind: 'heading', chapterId: ch.id, say: [headingSaid(ch.number, ch.title)] })
    scenes.forEach((s, i) => {
      if (i > 0) out.push({ kind: 'pause', chapterId: ch.id, eventId: s.eventId, ms: BREAK_MS })
      const plain = plainScene(s.text)
      const starts = plain.paragraphs.map((p) => p.start)
      for (const sen of sentences(plain.text)) {
        // The paragraph it is in: the last to start at or before it.
        let paragraph = 0
        while (paragraph + 1 < starts.length && starts[paragraph + 1] <= sen.start) paragraph++
        const text = plain.text.slice(sen.start, sen.end)
        const said = spokenText(text)
        if (!hasWords(said)) {
          out.push({ kind: 'pause', chapterId: ch.id, eventId: s.eventId, ms: DIVIDER_MS })
          continue
        }
        out.push({
          kind: 'sentence',
          chapterId: ch.id,
          eventId: s.eventId,
          paragraph,
          from: sen.start - starts[paragraph],
          to: sen.end - starts[paragraph],
          text,
          say: speechParts(said),
        })
      }
    })
  }
  return out
}

/**
 * Where reading starts (D-7): at the sentence holding `offset` in paragraph
 * `paragraph` of a scene — a selection — or at the scene's heading where it is
 * its chapter's first scene, else its first sentence. -1 where the scene has
 * nothing to read.
 */
export function startAt(queue: readonly AloudItem[], eventId: string, at?: { paragraph: number; offset: number }): number {
  if (at) {
    const i = queue.findIndex((q) => q.kind === 'sentence' && q.eventId === eventId && q.paragraph === at.paragraph && at.offset < q.to)
    if (i >= 0) return i
  }
  // Its first sentence: not the break before it, which belongs to it too.
  const first = queue.findIndex((q) => q.kind === 'sentence' && q.eventId === eventId)
  if (first < 0) return -1
  const before = queue[first - 1]
  return before?.kind === 'heading' ? first - 1 : first
}

/** The next sentence or heading after `i`, or -1: what *Next* goes to. Pauses are stepped over. */
export function nextSpoken(queue: readonly AloudItem[], i: number): number {
  for (let j = i + 1; j < queue.length; j++) if (queue[j].kind !== 'pause') return j
  return -1
}

/** The sentence or heading before `i`, or `i` itself where there is none: what *Previous* goes to. */
export function previousSpoken(queue: readonly AloudItem[], i: number): number {
  for (let j = i - 1; j >= 0; j--) if (queue[j].kind !== 'pause') return j
  return Math.max(0, i)
}
