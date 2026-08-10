import type { WorldEvent } from '@/types'
import { EVENT_STATUSES, eventStatusConfig } from './eventStatus'

/**
 * What a chapter contains, rolled up from its scenes (TL-4, CB-4).
 *
 * The timeline row and the corkboard column both need the same three numbers,
 * and both had only the chapter's own title and synopsis to show — prose the
 * author already wrote, rather than the state of the work.
 */
export interface ChapterProgress {
  scenes: number
  words: number
  /**
   * The least-advanced status among the chapter's scenes; null when it has
   * none. A chapter is only as finished as its least-finished scene, so a
   * chapter of four Final scenes and one Idea rolls up to Idea rather than to
   * an average that would describe neither.
   */
  status: string | null
  /** True when the scenes do not all carry `status`. */
  mixed: boolean
}

/** The status a scene has when it carries none, matching the corkboard card. */
export const DEFAULT_EVENT_STATUS = 'draft'

/**
 * How advanced a status is. Unrecognised strings rank below every known status:
 * a `.pwk` can carry any string at all (see `eventStatusConfig`), and the one
 * thing we cannot claim about a status we do not know is that it is finished.
 */
function rank(status: string): number {
  return (EVENT_STATUSES as readonly string[]).indexOf(status)
}

export function chapterProgress(
  events: WorldEvent[],
  wordsByEvent: Map<string, number>,
): ChapterProgress {
  if (events.length === 0) return { scenes: 0, words: 0, status: null, mixed: false }

  let words = 0
  const seen = new Set<string>()
  for (const e of events) {
    words += wordsByEvent.get(e.id) ?? 0
    seen.add(e.status ?? DEFAULT_EVENT_STATUS)
  }

  const lowest = [...seen].reduce((a, b) => (rank(b) < rank(a) ? b : a))
  return { scenes: events.length, words, status: lowest, mixed: seen.size > 1 }
}

/**
 * The roll-up as a line of text: `3 scenes · 1,240 words`.
 *
 * A chapter with no prose yet says only how many scenes it holds — "0 words" on
 * a freshly outlined chapter is noise, since the outlining is the work that has
 * been done. An empty chapter says so, because a collapsed row that showed
 * nothing would be indistinguishable from one that is full.
 */
export function describeProgress(p: ChapterProgress): string {
  if (p.scenes === 0) return 'No scenes'
  const scenes = `${p.scenes} ${p.scenes === 1 ? 'scene' : 'scenes'}`
  if (p.words === 0) return scenes
  return `${scenes} · ${p.words.toLocaleString()} ${p.words === 1 ? 'word' : 'words'}`
}

/**
 * How much board there is, for the corkboard's header (CB-2). Chapters rather
 * than scenes lead, because chapters are the columns — the thing that runs off
 * the right-hand edge.
 */
export function describeBoard(chapters: number, scenes: number): string {
  const c = `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`
  if (scenes === 0) return c
  return `${c} · ${scenes} ${scenes === 1 ? 'scene' : 'scenes'}`
}

/**
 * What the rolled-up status pill means, in a sentence, for its tooltip. A pill
 * reading *Idea* on a chapter of five scenes is otherwise ambiguous between
 * "all five are ideas" and "one of them is".
 *
 * The mixed branch can only be reached with at least two scenes — `mixed` is
 * set from a set of two or more distinct statuses — so "scenes" needs no
 * singular form there.
 */
export function describeStatus(p: ChapterProgress): string | null {
  if (p.status === null) return null
  const label = eventStatusConfig(p.status).label
  return p.mixed
    ? `Least advanced of ${p.scenes} scenes: ${label}`
    : `Every scene is ${label}`
}
