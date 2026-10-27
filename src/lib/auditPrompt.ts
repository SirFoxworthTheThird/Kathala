import type { Chapter, Character, KnowledgeFact, SceneText, Timeline, World, WorldEvent } from '@/types'
import { dayLabel, dateToDayNumber, formatInWorldDate } from './calendar'
import { inBookChapterOrder } from './timelineOrder'

/*
  The AI audit's prompt (run-10 plan, Part 5). Run 10's errors were found by
  AI auditors with the book in front of them; the app's own checks cannot read
  prose that closely. So the book is handed out — by the writer, who copies
  this and pastes it into an assistant of their choosing; nothing leaves the
  device otherwise (Decision 3) — with what the app knows and the prose does
  not say: each chapter's era and dates, when the reader is to learn each
  fact, and birth dates. The reply comes back through `auditReply.ts`.

  The rules for what counts are the experiment's own, which its two auditors
  per book were held to.
*/

export interface AuditBook {
  title: string
  chapters: Array<{
    number: number
    title: string
    /** The chapter's timeline, which in a book braided from eras is its era. */
    era: string | null
    /** Its dates on the book's calendar: "2 Longdark, 1 BL", or a range. */
    when: string | null
    scenes: Array<{ title: string; text: string }>
  }>
  /** When the reader is to learn each fact. */
  facts: Array<{ title: string; toldInChapter: number | null }>
  births: Array<{ name: string; born: string }>
}

/**
 * The prompt for the whole book, or — with `focus`, a chapter's number — for
 * that chapter against the book so far (next-plan.md, Part F3): the chapters
 * up to it in reading order, and only contradictions it takes part in.
 */
export function auditPrompt(book: AuditBook, focus?: number): string {
  const upTo = focus === undefined ? -1 : book.chapters.findIndex((c) => c.number === focus)
  const read = upTo >= 0 ? book.chapters.slice(0, upTo + 1) : book.chapters
  const chapters = read.map((c) => {
    const head = [`Chapter ${c.number}: ${c.title || 'Untitled'}`, c.era && `era: ${c.era}`, c.when && `date: ${c.when}`].filter(Boolean).join(' · ')
    const scenes = c.scenes
      .filter((s) => s.text.trim())
      .map((s) => `## ${s.title || 'Untitled scene'}\n\n${s.text.trim()}`)
      .join('\n\n')
    return `# ${head}\n\n${scenes}`
  }).join('\n\n')
  const facts = book.facts.length
    ? book.facts.map((f) => `- "${f.title}" — the reader learns it in chapter ${f.toldInChapter ?? '?'}`).join('\n')
    : '(none recorded)'
  const births = book.births.length
    ? book.births.map((b) => `- ${b.name}: born ${b.born}`).join('\n')
    : '(none recorded)'

  const scope = upTo >= 0
    ? `You are auditing chapter ${focus} of a novel, "${book.title}", for continuity errors, against the book so far: the chapters below are every chapter up to and including chapter ${focus}, in reading order. Report only contradictions that chapter ${focus} takes part in — at least one quote must come from chapter ${focus}; the chapters before it are there to check it against. Then output a single JSON object listing them.`
    : `You are auditing a novel, "${book.title}", for continuity errors. Read the whole book below, then output a single JSON object listing every contradiction you find.`
  return `${scope}
Output ONLY the raw JSON — no explanation, no markdown fences.

WHAT TO LOOK FOR
- Numbers and time that contradict each other: ages, dates, elapsed time ("three weeks later", "twelve hours after"), counts, distances, durations.
- Early reveals: the book saying something before the chapter in which the reader is meant to learn it (see THE FACT SCHEDULE).
- Any other fact the book states in two ways that cannot both be true.

WHAT COUNTS
- Count it: the book's own facts clash — in narration, or in precise facts within a scene, including a character's statement about their own life.
- Do not count it: a character's estimate, rounding, rhetoric or belief; in-world myth; anything ambiguous, or explainable in one line.

QUOTES
Every finding must quote the book's exact words on EACH side of the contradiction — at least two quotes, copied character for character from the text below. Do not paraphrase, do not fix spelling, do not join words from different sentences. You may shorten a quote with "…" between two exact pieces. Every quote is checked against the book, and a finding whose quotes are not in it is thrown away.

OUTPUT FORMAT
{
  "findings": [
    {
      "title": "One line naming the contradiction",
      "severity": "serious" | "minor" | "trivial",
      "quotes": ["exact words from one side", "exact words from the other side"],
      "why": "Why both cannot be true, with the arithmetic where there is some."
    }
  ]
}
If you find nothing, output {"findings": []}.

THE FACT SCHEDULE
${facts}

BIRTH DATES
${births}

THE BOOK
${chapters}

Output ONLY the JSON object, starting with { and ending with }.`
}

/**
 * The book as the prompt gives it, from the world's records: chapters in the
 * book's order, each with its era (where there is more than one timeline) and
 * the dates of its scenes; the fact schedule; and birth dates on the book's
 * calendar.
 */
export function auditBookFrom({ world, chapters, events, sceneTexts, timelines, facts, characters, dayOf }: {
  world: Pick<World, 'name' | 'calendar'>
  chapters: ReadonlyArray<Pick<Chapter, 'id' | 'number' | 'title' | 'timelineId'>>
  events: ReadonlyArray<Pick<WorldEvent, 'id' | 'chapterId' | 'sortOrder' | 'title'>>
  sceneTexts: ReadonlyArray<Pick<SceneText, 'eventId' | 'text'>>
  timelines: ReadonlyArray<Pick<Timeline, 'id' | 'name' | 'position' | 'createdAt'>>
  facts: ReadonlyArray<Pick<KnowledgeFact, 'title' | 'readerLearnsAtEventId'>>
  characters: ReadonlyArray<Pick<Character, 'name' | 'birthDate'>>
  /** A scene's day on the book's clock (`Story.dayOf`). */
  dayOf: (sceneId: string) => number | null
}): AuditBook {
  const cal = world.calendar ?? null
  const text = new Map(sceneTexts.map((t) => [t.eventId, t.text]))
  const timelineName = new Map(timelines.map((t) => [t.id, t.name]))
  const chapterNumber = new Map(chapters.map((c) => [c.id, c.number]))
  const sceneChapter = new Map(events.map((e) => [e.id, e.chapterId]))
  return {
    title: world.name,
    chapters: inBookChapterOrder(chapters, timelines).map((c) => {
      const scenes = events.filter((e) => e.chapterId === c.id).sort((a, b) => a.sortOrder - b.sortOrder)
      const days = scenes.map((s) => dayOf(s.id)).filter((d): d is number => d !== null)
      const first = days.length ? Math.min(...days) : null
      const last = days.length ? Math.max(...days) : null
      const when = first === null || last === null ? null
        : dayLabel(cal, first) === dayLabel(cal, last) ? dayLabel(cal, first) : `${dayLabel(cal, first)} – ${dayLabel(cal, last)}`
      return {
        number: c.number,
        title: c.title,
        era: timelines.length > 1 ? timelineName.get(c.timelineId) ?? null : null,
        when,
        scenes: scenes.map((s) => ({ title: s.title, text: text.get(s.id) ?? '' })),
      }
    }),
    facts: facts
      .filter((f) => f.readerLearnsAtEventId)
      .map((f) => ({ title: f.title, toldInChapter: chapterNumber.get(sceneChapter.get(f.readerLearnsAtEventId!) ?? '') ?? null })),
    births: cal
      ? characters.filter((c) => c.birthDate).map((c) => ({ name: c.name, born: formatInWorldDate(cal, dateToDayNumber(cal, c.birthDate!)) }))
      : [],
  }
}
