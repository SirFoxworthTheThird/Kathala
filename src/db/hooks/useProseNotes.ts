import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import { journalCreate, journalDelete, journalUpdate } from './useOperations'
import { generateId } from '@/lib/id'
import type { NoteAnchor } from '@/lib/noteAnchor'
import type { NoteAuthor, NoteKind, ProseNote, Reaction } from '@/types'

/*
  Notes on the prose (editorial-plan.md, R1). Each write is journalled, so a
  note made, answered or resolved is one undo step and travels with the world
  like any other record; a note deleted leaves a tombstone, so a merge on
  another device does not bring it back.
*/

const ME: NoteAuthor = { kind: 'me' }

/** A world's notes, oldest first. */
export function useProseNotes(worldId: string | null): ProseNote[] {
  return useLiveQuery(
    () => (worldId ? db.proseNotes.where('worldId').equals(worldId).sortBy('createdAt') : []),
    [worldId],
    [] as ProseNote[],
  )
}

export async function addProseNote(data: {
  worldId: string
  anchor: NoteAnchor
  body: string
  kind?: NoteKind
  author?: NoteAuthor
  /** A beta reader's reaction (R7). */
  reaction?: Reaction
}): Promise<ProseNote> {
  const now = Date.now()
  const note: ProseNote = {
    id: generateId(),
    worldId: data.worldId,
    ...data.anchor,
    kind: data.kind ?? 'note',
    author: data.author ?? ME,
    body: data.body.trim(),
    status: 'open',
    replies: [],
    ...(data.reaction ? { reaction: data.reaction } : {}),
    createdAt: now,
    updatedAt: now,
  }
  return journalCreate('proseNote', db.proseNotes, note)
}

/**
 * Change what a note says or what kind it is. `anchor`, where given, moves it
 * to the words it is found on now: a writer answering a note on words they
 * have since edited is answering it there.
 */
export async function updateProseNote(id: string, changes: { body?: string; kind?: NoteKind; anchor?: NoteAnchor }): Promise<void> {
  const { anchor, ...rest } = changes
  const data: Record<string, unknown> = { ...rest, updatedAt: Date.now() }
  if (rest.body !== undefined) data.body = rest.body.trim()
  if (anchor) {
    Object.assign(data, { eventId: anchor.eventId, quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix })
    // The words it was made on, kept the first time it moves off them: the record of what was asked about.
    const note = await db.proseNotes.get(id)
    if (note && note.madeOn === undefined && note.quote !== anchor.quote) data.madeOn = note.quote
  }
  await journalUpdate('proseNote', db.proseNotes, id, data)
}

/** Resolve a note, or open it again. A resolved note is kept: it is the record of the review. */
export async function setProseNoteResolved(id: string, resolved: boolean): Promise<void> {
  const now = Date.now()
  await journalUpdate('proseNote', db.proseNotes, id, resolved
    ? { status: 'resolved', resolvedAt: now, updatedAt: now }
    : { status: 'open', resolvedAt: undefined, updatedAt: now })
}

/** Answer a note. */
export async function replyToProseNote(id: string, body: string, author: NoteAuthor = ME): Promise<void> {
  const note = await db.proseNotes.get(id)
  const text = body.trim()
  if (!note || !text) return
  const now = Date.now()
  await journalUpdate('proseNote', db.proseNotes, id, {
    replies: [...note.replies, { id: generateId(), author, body: text, createdAt: now }],
    updatedAt: now,
  })
}

export async function deleteProseNote(id: string): Promise<void> {
  await journalDelete('proseNote', db.proseNotes, id, async () => {
    await db.proseNotes.delete(id)
  })
}
