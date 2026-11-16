import type { NotePlace } from '@/lib/noteAnchor'
import { plural } from '@/lib/plural'
import type { NoteAuthorKind, ProseNote } from '@/types'

/*
  The Notes panel's list (editorial-plan.md, R1): a book's notes in reading
  order, each with where it is now, filtered by status, chapter and who wrote
  it. A note that is unplaced keeps the chapter of the scene it was made in,
  where that scene still exists, so filtering by chapter still finds it; it
  comes after the placed notes, which can be gone to.
*/

export interface NoteFilter {
  status: 'open' | 'resolved' | 'all'
  /** A chapter's id, or every chapter. */
  chapterId: string | 'all'
  /** Who wrote them: anyone, a kind of author, or one beta reader by name (`reader:Ana`). */
  author: NoteAuthorKind | 'all' | `reader:${string}`
  /**
   * Only the threads an edited file answered or resolved, open or resolved
   * alike (round-trip-plan-3.md, T9.5): what bringing it in said it did.
   * `name` is the file's, to say so.
   */
  fromFile?: { importId: string; name: string }
}

/** Whether an edited file answered a note, or resolved it. */
export const answeredIn = (note: ProseNote, importId: string): boolean =>
  note.resolvedIn === importId || note.replies.some((r) => r.broughtIn === importId)

/**
 * When a reply was made, as a reply shows it (T9.5): the day and the month,
 * and the year where it is not this one. The month named, not numbered, as
 * `relativeTime` does: 4/7 is April or July depending on the reader.
 */
export function replyDate(at: number, now: number = Date.now()): string {
  const d = new Date(at)
  const thisYear = d.getFullYear() === new Date(now).getFullYear()
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) })
}

/** The filter value for one beta reader's notes. */
export const readerFilter = (name: string): `reader:${string}` => `reader:${name}`

export const DEFAULT_NOTE_FILTER: NoteFilter = { status: 'open', chapterId: 'all', author: 'all' }

export interface NoteRow {
  note: ProseNote
  /** Where its words are now, or null. */
  place: NotePlace | null
  /** The scene it is in now, or was made in; null where neither exists. */
  sceneId: string | null
  chapterId: string | null
}

export function noteRows(
  notes: readonly ProseNote[],
  places: ReadonlyMap<string, NotePlace | null>,
  chapterOf: (sceneId: string) => string | null,
  /** A scene's place in the book's reading order, every timeline. */
  order: (sceneId: string) => number,
  filter: NoteFilter,
): NoteRow[] {
  const rows = notes.map((note): NoteRow => {
    const place = places.get(note.id) ?? null
    // One on the title page is in no scene and no chapter: its `eventId` only says which book (T9.4).
    const sceneId = note.outside === 'title page' ? null : place?.eventId ?? (chapterOf(note.eventId) !== null ? note.eventId : null)
    return { note, place, sceneId, chapterId: sceneId ? chapterOf(sceneId) : null }
  })
  return rows
    // An edited file's threads are shown whatever their status: most it answered, it also resolved.
    .filter((r) => (filter.fromFile ? answeredIn(r.note, filter.fromFile.importId) : filter.status === 'all' || r.note.status === filter.status))
    .filter((r) => filter.chapterId === 'all' || r.chapterId === filter.chapterId)
    .filter((r) => {
      const a = filter.author
      if (a === 'all') return true
      if (a.startsWith('reader:')) return r.note.author.kind === 'reader' && r.note.author.name === a.slice('reader:'.length)
      return r.note.author.kind === a
    })
    .sort((a, b) => {
      /*
        Placed first, in the book's order and then down the scene; unplaced
        after, oldest first. One on a chapter's heading stands where the
        heading does, before its chapter's first note, and one on the title
        page before them all (T9.4).
      */
      const at = (r: NoteRow): [number, number] | null => {
        if (r.note.outside === 'title page') return [-1, -1]
        if (r.note.outside === 'heading') return r.sceneId ? [order(r.sceneId), -1] : null
        return r.place ? [order(r.place.eventId), r.place.from] : null
      }
      const x = at(a)
      const y = at(b)
      if (!x !== !y) return x ? -1 : 1
      if (x && y) return x[0] - y[0] || x[1] - y[1] || a.note.createdAt - b.note.createdAt
      return a.note.createdAt - b.note.createdAt
    })
}

/** How many open notes there are: what the Notes button says. */
export function openCount(notes: readonly ProseNote[]): number {
  return notes.filter((n) => n.status === 'open').length
}

export const NOTE_KIND_LABEL: Record<ProseNote['kind'], string> = {
  note: 'Note',
  query: 'Query',
  cut: 'Cut',
  check: 'Check a fact',
  praise: 'Praise',
}

export const NOTE_AUTHOR_LABEL: Record<NoteAuthorKind, string> = {
  me: 'Me',
  editor: 'Editor',
  reader: 'Reader',
  check: 'A check',
}

/** Who wrote a note, as the panel says it. */
export function authorLabel(author: ProseNote['author']): string {
  return author.name ? `${author.name} (${NOTE_AUTHOR_LABEL[author.kind].toLowerCase()})` : NOTE_AUTHOR_LABEL[author.kind]
}

/** What an edited file said in threads already in the book (T9.5): "7 replies were added to your notes, and 1 thread was resolved." Null for neither. */
export function answeredSentence(replies: number, resolved: number): string | null {
  const added = replies > 0 ? `${plural(replies, 'reply', 'replies')} ${replies === 1 ? 'was' : 'were'} added to your notes` : ''
  const closed = resolved > 0 ? `${plural(resolved, 'thread')} ${resolved === 1 ? 'was' : 'were'} resolved` : ''
  if (!added && !closed) return null
  const said = added && closed ? `${added}, and ${closed}` : added || closed
  return `${said[0].toUpperCase()}${said.slice(1)}.`
}
