import type { NotePlace } from '@/lib/noteAnchor'
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
  author: NoteAuthorKind | 'all'
}

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
    const sceneId = place?.eventId ?? (chapterOf(note.eventId) !== null ? note.eventId : null)
    return { note, place, sceneId, chapterId: sceneId ? chapterOf(sceneId) : null }
  })
  return rows
    .filter((r) => filter.status === 'all' || r.note.status === filter.status)
    .filter((r) => filter.chapterId === 'all' || r.chapterId === filter.chapterId)
    .filter((r) => filter.author === 'all' || r.note.author.kind === filter.author)
    .sort((a, b) => {
      // Placed first, in the book's order and then down the scene; unplaced after, oldest first.
      if (!a.place !== !b.place) return a.place ? -1 : 1
      if (a.place && b.place) {
        return order(a.place.eventId) - order(b.place.eventId) || a.place.from - b.place.from || a.note.createdAt - b.note.createdAt
      }
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
