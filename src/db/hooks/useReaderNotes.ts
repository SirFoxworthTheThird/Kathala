import { db } from '@/db/database'
import { addProseNote, deleteProseNote } from './useProseNotes'
import { journalGroup } from './useOperations'
import { inOneWrite } from './useSceneStructure'
import { parseReaderNotes, readerNotesFile, sameReader, type ReaderNotesFile } from '@/lib/readerNotes'
import type { NoteAnchor } from '@/lib/noteAnchor'
import type { BetaReader, ProseNote, Reaction } from '@/types'

/*
  Notes from beta readers (editorial-plan.md, R7).

  A reader, reading the book in reading mode, reacts to words or a paragraph:
  each reaction is a note on them (R1), by a reader not yet named. Sending
  them writes a file of those notes alone (`readerNotes.ts`). The writer
  brings the file in: its notes become notes by that reader, on the same
  words, and the reader is recorded on the book with how far they had read. A
  second file from the same reader replaces the first: the reader sends all
  their notes each time, so the newest file is the whole of them.
*/

/** The reader's own notes, in their copy: by a reader, and not yet anyone's by name. */
export function isOwnReaderNote(n: ProseNote): boolean {
  return n.author.kind === 'reader' && !n.author.name
}

export async function addReaction(worldId: string, anchor: NoteAnchor, reaction: Reaction, body = ''): Promise<ProseNote> {
  return addProseNote({ worldId, anchor, body, reaction, author: { kind: 'reader' } })
}

/** The file of a reader's notes on a book, to send to its author. */
export async function readerNotesFor(worldId: string, reader: string, readTo: ReaderNotesFile['readTo'], now = Date.now()): Promise<ReaderNotesFile> {
  const world = await db.worlds.get(worldId)
  const notes = (await db.proseNotes.where('worldId').equals(worldId).toArray()).filter(isOwnReaderNote).sort((a, b) => a.createdAt - b.createdAt)
  return readerNotesFile({ worldId, book: world?.name ?? '', reader, readTo, notes, sentAt: now })
}

export interface ReaderNotesImport {
  reader: string
  notes: number
  /** How many notes from an earlier file from the same reader were replaced. */
  replaced: number
}

/**
 * Bring a reader's notes file in: their earlier notes, if any, replaced by
 * these, in one write and one step of undo. Refuses notes on another book.
 */
export async function importReaderNotes(worldId: string, text: string, now = Date.now()): Promise<ReaderNotesImport> {
  const file = parseReaderNotes(text)
  if (file.worldId !== worldId) throw new Error(`These notes are on another book${file.book ? `, ${file.book}` : ''}. Open that book to bring them in.`)
  return journalGroup(() => inOneWrite(async () => {
    const earlier = (await db.proseNotes.where('worldId').equals(worldId).toArray())
      .filter((n) => n.author.kind === 'reader' && n.author.name && sameReader(n.author.name, file.reader))
    for (const n of earlier) await deleteProseNote(n.id)
    for (const n of file.notes) {
      await addProseNote({
        worldId,
        anchor: { eventId: n.eventId, quote: n.quote, prefix: n.prefix, suffix: n.suffix },
        body: n.body,
        author: { kind: 'reader', name: file.reader },
        ...(n.reaction ? { reaction: n.reaction } : {}),
      })
    }
    const world = await db.worlds.get(worldId)
    const entry: BetaReader = { name: file.reader, readTo: file.readTo, notes: file.notes.length, sentAt: file.sentAt, receivedAt: now }
    const readers = [...(world?.betaReaders ?? []).filter((r) => !sameReader(r.name, file.reader)), entry]
    await db.worlds.update(worldId, { betaReaders: readers, updatedAt: now })
    return { reader: file.reader, notes: file.notes.length, replaced: earlier.length }
  }), { label: `Bring in ${file.reader}’s notes`, quiet: true })
}
