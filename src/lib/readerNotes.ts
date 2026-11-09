import type { ProseNote, Reaction } from '@/types'

/*
  A beta reader's notes, as a file sent to the author (editorial-plan.md, R7,
  decision D-3): the book's id, the reader's name, their notes, and how far
  they had read. Never the book or its prose — the notes carry only the few
  words each is on — so it stays small, and a reader's copy cannot overwrite
  the writer's book by being brought in.
*/

export const READER_NOTES_KIND = 'kathala-reader-notes'
export const READER_NOTES_VERSION = 1

export const REACTIONS: Reaction[] = ['lost', 'slow', 'loved', 'unconvinced', 'where']
export const REACTION_LABEL: Record<Reaction, string> = {
  lost: 'Lost',
  slow: 'Slow',
  loved: 'Loved it',
  unconvinced: 'Didn’t believe it',
  where: 'Where am I?',
}

export interface ReaderNote {
  eventId: string
  quote: string
  prefix: string
  suffix: string
  reaction?: Reaction
  body: string
  createdAt: number
}

export interface ReaderNotesFile {
  kind: typeof READER_NOTES_KIND
  version: number
  worldId: string
  /** The book's name, for the writer to see which book a file is about. */
  book: string
  reader: string
  /** Where the reader's place in the book was when they sent it. */
  readTo: { eventId: string; chapter: number | null; scene: string } | null
  sentAt: number
  notes: ReaderNote[]
}

export function readerNotesFile(args: {
  worldId: string
  book: string
  reader: string
  readTo: ReaderNotesFile['readTo']
  notes: readonly ProseNote[]
  sentAt: number
}): ReaderNotesFile {
  return {
    kind: READER_NOTES_KIND,
    version: READER_NOTES_VERSION,
    worldId: args.worldId,
    book: args.book,
    reader: args.reader.trim(),
    readTo: args.readTo,
    sentAt: args.sentAt,
    notes: args.notes.map((n) => ({
      eventId: n.eventId, quote: n.quote, prefix: n.prefix, suffix: n.suffix,
      ...(n.reaction ? { reaction: n.reaction } : {}),
      body: n.body, createdAt: n.createdAt,
    })),
  }
}

/** A file's name: the book's and the reader's, so a folder of them sorts. */
export function readerNotesFileName(file: Pick<ReaderNotesFile, 'book' | 'reader'>): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'untitled'
  return `${slug(file.book)}-notes-from-${slug(file.reader)}.json`
}

const str = (v: unknown): v is string => typeof v === 'string'

/** Read a file that says it is a reader's notes, or say plainly what is wrong with it. */
export function parseReaderNotes(text: string): ReaderNotesFile {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('This is not a reader’s notes file.') }
  const d = data as Partial<ReaderNotesFile> | null
  if (!d || d.kind !== READER_NOTES_KIND) throw new Error('This is not a reader’s notes file.')
  if (typeof d.version !== 'number' || d.version > READER_NOTES_VERSION) throw new Error('These notes were sent from a newer Kathala. Update it to bring them in.')
  if (!str(d.worldId) || !str(d.reader) || !d.reader.trim() || !Array.isArray(d.notes)) throw new Error('This reader’s notes file is damaged.')
  const notes: ReaderNote[] = []
  for (const n of d.notes as unknown[]) {
    const x = n as Partial<ReaderNote>
    if (!x || !str(x.eventId) || !str(x.quote) || !x.quote.trim() || !str(x.prefix) || !str(x.suffix) || !str(x.body)) throw new Error('This reader’s notes file is damaged.')
    notes.push({
      eventId: x.eventId, quote: x.quote, prefix: x.prefix, suffix: x.suffix, body: x.body,
      createdAt: typeof x.createdAt === 'number' ? x.createdAt : 0,
      ...(x.reaction && REACTIONS.includes(x.reaction) ? { reaction: x.reaction } : {}),
    })
  }
  const r = d.readTo as ReaderNotesFile['readTo'] | undefined
  return {
    kind: READER_NOTES_KIND,
    version: d.version,
    worldId: d.worldId,
    book: str(d.book) ? d.book : '',
    reader: d.reader.trim(),
    readTo: r && str(r.eventId) ? { eventId: r.eventId, chapter: typeof r.chapter === 'number' ? r.chapter : null, scene: str(r.scene) ? r.scene : '' } : null,
    sentAt: typeof d.sentAt === 'number' ? d.sentAt : 0,
    notes,
  }
}

/** Whether two names are one reader's: a second file from them replaces the first. */
export function sameReader(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}
